import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function run(command, args, { cwd, missing } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 45_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.error?.code === 'ENOENT') throw new Error(`Install ${command} and try again.`);
  if (result.error) throw new Error(`${command} failed: ${result.error.message}`);
  if (result.status === 0) return result.stdout.trim();
  if (missing?.test(result.stderr)) return null;
  throw new Error(`${command} ${args[0]} failed: ${result.stderr.trim() || result.stdout.trim()}`);
}

export function github(path, { optional, fields = [] } = {}) {
  const raw = run('gh', ['api', path, ...fields], {
    missing: optional ? /\(HTTP 404\)/ : undefined,
  });
  return raw === null ? null : JSON.parse(raw);
}

export function vercel(scope, path, { optional } = {}) {
  const raw = run('vercel', ['api', path, '--raw', '--scope', scope, '--non-interactive'], {
    missing: optional ? /\(404\)/ : undefined,
  });
  return raw === null ? null : JSON.parse(raw);
}

export function git(cwd, ...args) {
  return run('git', ['-c', 'core.autocrlf=false', '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...args], { cwd });
}

export async function withCheckout(callback) {
  const directory = mkdtempSync(join(tmpdir(), 'artie-'));
  try {
    return await callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
