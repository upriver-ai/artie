import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { git, github, run, vercel, withCheckout } from './system.mjs';
import { gitBlob, hostingConfig, marker, markerFile } from './page.mjs';

const branch = 'main';
const ref = `refs/heads/${branch}`;
const refspec = `HEAD:${ref}`;
const remote = ({ repository }) => `https://github.com/${repository}.git`;
const pageFile = (slug) => `public/p/${slug}.html`;
export const pageUrl = ({ url }, slug) => `${url}/p/${slug}`;

function privateRepo(target, optional = false) {
  const repo = github(`repos/${target.repository}`, { optional });
  if (repo && (repo.visibility !== 'private' || repo.fork || repo.archived ||
      repo.full_name?.toLowerCase() !== target.repository)) {
    throw new Error(`${target.repository} must be a private, writable GitHub repo created for Artie.`);
  }
  return repo;
}

export async function createContentRepo(target, audience) {
  await withCheckout((directory) => {
    const existing = privateRepo(target, true);
    if (existing && git(directory, 'ls-remote', '--heads', remote(target))) {
      throw new Error(`${target.repository} already contains branches. For an existing Artie repo, run init without --create-repo.`);
    }
    git(directory, 'init', '-q', '-b', branch);
    mkdirSync(join(directory, 'public'));
    writeFileSync(join(directory, 'public', markerFile), marker(audience));
    writeFileSync(join(directory, 'public/index.html'),
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>Artie</title>' +
      '<body><h1>Artie</h1><p>Open the specific link you were given.</p></body></html>\n');
    writeFileSync(join(directory, 'vercel.json'), hostingConfig);
    git(directory, 'add', '--', 'public', 'vercel.json');
    git(directory, 'commit', '-qm', 'Initialize Artie hosting');
    if (!existing) run('gh', ['repo', 'create', target.repository, '--private']);
    privateRepo(target);
    git(directory, 'push', remote(target), refspec);
  });
}

async function anonymous(url) {
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12_000) });
}

async function authWall(response) {
  if (response.headers.get('server')?.toLowerCase() !== 'vercel') return false;
  if ([302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location || !URL.canParse(location)) return false;
    const { hostname, pathname, protocol } = new URL(location);
    return protocol === 'https:' && hostname === 'vercel.com' &&
      (pathname.startsWith('/sso-api') || pathname === '/login');
  }
  return response.status === 401 && /authentication required/i.test(await response.text());
}

function hasNoindex(response) {
  return /(?:^|,\s*)noindex(?:\s*,|$)/i.test(response.headers.get('x-robots-tag')?.trim() ?? '');
}

function gitFileSha(target, path, commit = branch) {
  const data = github(`repos/${target.repository}/contents/${path}?ref=${commit}`, {
    optional: true,
    fields: ['-H', 'Accept: application/vnd.github.object+json', '--jq', '{sha, type}'],
  });
  return data?.type === 'file' ? data.sha : null;
}

export async function checkDestination(target, audience) {
  const repo = privateRepo(target);
  const projectPath = `/v9/projects/${target.project}`;
  const project = vercel(target.scope, projectPath);
  const hostname = new URL(target.url).hostname;
  const domain = vercel(target.scope, `${projectPath}/domains/${hostname}`);

  if (repo.default_branch !== branch || project.link?.type !== 'github' ||
      String(project.link.repoId) !== String(repo.id) ||
      project.link.productionBranch !== branch ||
      (project.rootDirectory && project.rootDirectory !== '.')) {
    throw new Error('Link the Vercel project to the configured GitHub repo, with main as production and the repository root as Root Directory.');
  }
  if (!domain.verified || domain.name !== hostname || domain.redirect || domain.gitBranch ||
      domain.customEnvironmentId) {
    throw new Error(`${hostname} must be a verified Vercel production domain for this project.`);
  }
  if (audience === 'team' && project.ssoProtection?.deploymentType !== 'all') {
    throw new Error('Enable Vercel Authentication for All Deployments on the team project.');
  }
  const expectedConfig = gitBlob(Buffer.from(hostingConfig));
  if (gitFileSha(target, 'vercel.json') !== expectedConfig ||
      gitFileSha(target, `public/${markerFile}`) !== gitBlob(Buffer.from(marker(audience)))) {
    throw new Error('The content repo must contain the Artie hosting scaffold for this audience.');
  }
  const response = await anonymous(`${target.url}/${markerFile}`);
  if (audience === 'team') {
    if (!await authWall(response)) throw new Error('The team domain did not require Vercel login.');
  } else if (!response.ok || !hasNoindex(response) || await response.text() !== marker(audience)) {
    throw new Error('The public project must serve its Artie check file with X-Robots-Tag: noindex.');
  }
  return project.id;
}

function pathType(path) {
  return lstatSync(path, { throwIfNoEntry: false });
}

export async function pushPage(target, audience, slug, content) {
  const wanted = gitBlob(content);
  let firstSha;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await withCheckout((directory) => {
      git(directory, 'clone', '-q', '--depth', '1', '--single-branch', '--branch', branch,
        remote(target), '.');
      const base = git(directory, 'rev-parse', 'HEAD');
      const staticDirectory = join(directory, 'public');
      const pagesDirectory = join(staticDirectory, 'p');
      const destination = join(directory, pageFile(slug));
      const pagesInfo = pathType(pagesDirectory);
      const pageInfo = pathType(destination);
      if (!pathType(staticDirectory)?.isDirectory() ||
          (pagesInfo && !pagesInfo.isDirectory()) || (pageInfo && !pageInfo.isFile())) {
        throw new Error('The content repo uses an unexpected path for published pages.');
      }
      if (!pathType(join(directory, 'vercel.json'))?.isFile() ||
          !pathType(join(staticDirectory, markerFile))?.isFile() ||
          readFileSync(join(directory, 'vercel.json'), 'utf8') !== hostingConfig ||
          readFileSync(join(staticDirectory, markerFile), 'utf8') !== marker(audience)) {
        throw new Error('The hosting scaffold changed. Run artie doctor before publishing.');
      }
      const current = pageInfo ? gitBlob(readFileSync(destination)) : null;
      if (current === wanted) return 'unchanged';
      if (attempt === 0) firstSha = current;
      if (current !== firstSha) throw new Error(`Another publish updated ${slug}. Review it before retrying.`);
      mkdirSync(pagesDirectory, { recursive: true });
      writeFileSync(destination, content);
      git(directory, 'add', '--', pageFile(slug));
      git(directory, 'commit', '-qm', `Publish ${slug}`);
      try {
        git(directory, 'push', 'origin', refspec);
        return 'pushed';
      } catch (error) {
        const tip = git(directory, 'ls-remote', 'origin', ref).split(/\s+/)[0];
        if (!tip || tip === base) throw error;
        return 'retry';
      }
    });
    if (state !== 'retry') return { state, sha: wanted, url: pageUrl(target, slug) };
  }
  throw new Error('The content branch kept changing. Retry the publish.');
}

export function desiredBlob(target, slug) {
  return gitFileSha(target, pageFile(slug));
}

export async function livePage(target, projectId, audience, slug, sha) {
  const url = pageUrl(target, slug);
  const response = await anonymous(url);
  if (audience === 'public') {
    if (!response.ok) return false;
    if (!hasNoindex(response)) {
      throw new Error('The live public page is missing X-Robots-Tag: noindex.');
    }
    return gitBlob(Buffer.from(await response.arrayBuffer())) === sha;
  }
  if (!await authWall(response)) throw new Error('The team page did not require Vercel login.');

  // Confirm the stable domain is serving a production commit with these
  // bytes. The signed-out request alone cannot distinguish a gated 404.
  const hostname = new URL(target.url).hostname;
  const deployment = vercel(target.scope, `/v13/deployments/${hostname}`, { optional: true });
  const commit = deployment?.gitSource?.sha ?? deployment?.meta?.githubCommitSha;
  if (deployment?.readyState !== 'READY' || deployment.projectId !== projectId ||
      deployment.target !== 'production' || !/^[0-9a-f]{40}$/.test(commit ?? '')) return false;
  return gitFileSha(target, pageFile(slug), commit) === sha;
}

export async function waitForPage(target, projectId, audience, slug, sha, seconds) {
  const deadline = Date.now() + seconds * 1_000;
  while (true) {
    if (await livePage(target, projectId, audience, slug, sha)) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await delay(Math.min(5_000, remaining));
  }
}
