import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { targetConfig, validateConfig } from '../lib/config.mjs';
import { gitBlob, hostingConfig, marker, renderPage, slugFor } from '../lib/page.mjs';
import { livePage, pushPage } from '../lib/publish.mjs';

const bin = fileURLToPath(new URL('../bin/artie.mjs', import.meta.url));
const team = { repository: 'sample/team', scope: 'sample', project: 'team', url: 'https://team.example.com' };
const external = { repository: 'sample/public', scope: 'sample', project: 'public', url: 'https://public.example.com' };

function temp(t) {
  const folder = mkdtempSync(join(tmpdir(), 'artie-test-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}

function cli(folder, ...args) {
  return spawnSync(process.execPath, [bin, ...args], { cwd: folder, encoding: 'utf8' });
}

test('config normalizes repository casing and keeps separate trust destinations', () => {
  assert.deepEqual(targetConfig({ ...team, repository: 'Sample/Team', url: team.url + '/' }, 'team'), team);
  for (const key of ['repository', 'project', 'url']) {
    assert.throws(() => validateConfig({ team, public: { ...external, [key]: team[key] } }), /separate/);
  }
  assert.throws(() => targetConfig({ ...team, url: team.url + '/p' }, 'team'), /HTTPS origin/);
  assert.throws(() => validateConfig({ public: external }), /team destination first/);
});

test('init writes config, which is discoverable from a project subdirectory', (t) => {
  const folder = temp(t);
  const initialized = cli(folder, 'init', '--repo', team.repository, '--scope', team.scope,
    '--project', team.project, '--url', team.url);
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(folder, 'artie.json'))), { team });
  const child = join(folder, 'docs');
  mkdirSync(child);
  const rejected = cli(child, 'publish', 'example.html', '--public');
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /separate public destination/);
});

test('slug normalization refuses empty or overlong slugs', () => {
  assert.equal(slugFor('  Q4 Report (Draft) '), 'q4-report-draft');
  assert.throws(() => slugFor('../'), /letters/);
  assert.throws(() => slugFor('x'.repeat(101)), /letters/);
});

test('render preserves a document and inserts the label into its real body', () => {
  const html = '<!doctype html><html><head><title>Report</title>' +
    '<script>const example = "<body>";</script></head><body class="a>b"><main>Report</main></body></html>';
  const result = renderPage(html, 'team');
  assert.ok(result.startsWith(html.slice(0, html.indexOf('<main>'))));
  assert.match(result, /<body class="a>b">\n<aside[^>]*>Team only<\/aside>\n<main>/);
});

test('fragments render as HTML with the correct access label', () => {
  const result = renderPage('<h1>Report</h1>', 'public');
  assert.match(result, /^<!doctype html>/);
  assert.match(result, /<body>\n<aside[^>]*>Public · noindex<\/aside>\n<h1>/);
});

test('checks public pages for matching content and signed-out noindex', async (t) => {
  const content = Buffer.from('<p>Hello world</p>');
  const sha = gitBlob(content);
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    new Response(content, { headers: { 'X-Robots-Tag': 'noindex, nofollow' } }));
  assert.equal(await livePage(external, 'public-id', 'public', 'hello', sha), true);
  assert.equal(fetch.mock.calls[0].arguments[0], 'https://public.example.com/p/hello');
  assert.equal(fetch.mock.calls[0].arguments[1].redirect, 'manual');
  assert.equal(await livePage(external, 'public-id', 'public', 'hello', 'older'), false);
  fetch.mock.mockImplementation(async () => new Response(content));
  await assert.rejects(livePage(external, 'public-id', 'public', 'hello', sha), /missing X-Robots-Tag/);
});

test('checks fail when a team URL responds signed out or redirects off Vercel', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('open'));
  await assert.rejects(livePage(team, 'team-id', 'team', 'hello', 'sha'), /did not require Vercel login/);
  fetch.mock.mockImplementation(async () => new Response(null, {
    status: 302,
    headers: { server: 'Vercel', location: 'https://example.com/login' },
  }));
  await assert.rejects(livePage(team, 'team-id', 'team', 'hello', 'sha'), /did not require Vercel login/);
});

test('publish updates one slug in an isolated checkout and skips identical content', async (t) => {
  const folder = temp(t);
  const bare = join(folder, 'remote.git');
  const working = join(folder, 'working');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(folder, 'init', '--bare', '--initial-branch=main', bare);
  git(folder, 'init', '--initial-branch=main', working);
  mkdirSync(join(working, 'public'));
  writeFileSync(join(working, 'public/artie-check.txt'), marker('team'));
  writeFileSync(join(working, 'vercel.json'), hostingConfig);
  git(working, 'add', '.');
  git(working, '-c', 'user.name=Artie Test', '-c', 'user.email=artie@example.com', 'commit', '-m', 'seed');
  git(working, 'push', bare, 'HEAD:main');

  const env = {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.file://${bare}.insteadOf`,
    GIT_CONFIG_VALUE_0: 'https://github.com/sample/team.git',
    GIT_AUTHOR_NAME: 'Artie Test',
    GIT_AUTHOR_EMAIL: 'artie@example.com',
    GIT_COMMITTER_NAME: 'Artie Test',
    GIT_COMMITTER_EMAIL: 'artie@example.com',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => previous === undefined ? delete process.env[key] : (process.env[key] = previous));
  }

  const original = Buffer.from(renderPage('<p>First version</p>', 'team'));
  const updated = Buffer.from(renderPage('<p>Updated</p>', 'team'));
  const first = await pushPage(team, 'team', 'quarterly', original);
  assert.equal(first.state, 'pushed');
  assert.equal(first.url, 'https://team.example.com/p/quarterly');
  const repeat = await pushPage(team, 'team', 'quarterly', original);
  assert.equal(repeat.state, 'unchanged');
  const second = await pushPage(team, 'team', 'quarterly', updated);
  assert.equal(second.url, first.url);
  assert.equal(second.state, 'pushed');
  assert.equal(git(bare, 'rev-list', '--count', 'main'), '3');
  assert.match(git(bare, 'show', 'main:public/p/quarterly.html'), /Updated/);

  git(working, 'pull', bare, 'main');
  const outside = join(folder, 'other-file');
  writeFileSync(outside, 'sensitive test data');
  symlinkSync(outside, join(working, 'public/p/elsewhere.html'));
  git(working, 'add', '.');
  git(working, 'commit', '-m', 'example symlink');
  git(working, 'push', bare, 'HEAD:main');
  await assert.rejects(pushPage(team, 'team', 'elsewhere', updated), /unexpected path/);
  assert.equal(readFileSync(outside, 'utf8'), 'sensitive test data');
});
