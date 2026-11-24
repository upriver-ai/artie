import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const configName = 'artie.json';
const repoPattern = /^[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d_.-]{1,100}$/i;
const vercelName = /^[a-z\d][a-z\d_-]{0,99}$/;
const domain = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z][a-z\d-]{1,62}$/i;

export function targetConfig(value, audience) {
  const { repository, scope, project, url } = value ?? {};
  if (typeof repository !== 'string' || !repoPattern.test(repository) || /\/(?:\.|\.\.)$/.test(repository)) {
    throw new Error(`Set ${audience}.repository to a GitHub owner/repo.`);
  }
  if (typeof scope !== 'string' || typeof project !== 'string' ||
      !vercelName.test(scope) || !vercelName.test(project)) {
    throw new Error(`Set ${audience}.scope and ${audience}.project to the Vercel slugs.`);
  }
  if (typeof url !== 'string' || !url.startsWith('https://') ||
      !domain.test(url.slice(8).replace(/\/$/, ''))) {
    throw new Error(`Set ${audience}.url to an HTTPS origin without a path or port.`);
  }
  return { repository: repository.toLowerCase(), scope, project, url: new URL(url).origin };
}

export function validateConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('artie.json must contain a configuration object.');
  }
  const targets = {};
  if (raw.team) targets.team = targetConfig(raw.team, 'team');
  if (raw.public) targets.public = targetConfig(raw.public, 'public');
  if (targets.public && !targets.team) throw new Error('Set up the team destination first.');
  const { team, public: external } = targets;
  if (external && (team.repository === external.repository || team.url === external.url ||
      (team.project === external.project && team.scope === external.scope))) {
    throw new Error('Use a separate GitHub repo, Vercel project, and domain for public pages.');
  }
  return targets;
}

export function findConfig() {
  let directory = process.cwd();
  while (true) {
    const path = join(directory, configName);
    if (existsSync(path)) return path;
    if (existsSync(join(directory, '.git')) || dirname(directory) === directory) break;
    directory = dirname(directory);
  }
  throw new Error('No artie.json found. Run artie init in your project first.');
}

export function loadConfig(path) {
  return validateConfig(JSON.parse(readFileSync(path, 'utf8')));
}

export function saveConfig(path, config) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  renameSync(temporary, path);
}
