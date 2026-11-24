#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { configName, findConfig, loadConfig, saveConfig, targetConfig, validateConfig } from '../lib/config.mjs';
import { audienceLabel, renderPage, slugFor } from '../lib/page.mjs';
import { checkDestination, createContentRepo, desiredBlob, livePage, pageUrl, pushPage, waitForPage } from '../lib/publish.mjs';

const help = `Artie publishes self-contained HTML to your Vercel projects.

  artie init --repo OWNER/REPO --scope SCOPE --project PROJECT --url https://HOST
             [--create-repo] [--public]
  artie publish FILE [--slug SLUG] [--public] [--wait SECONDS] [--json]
  artie status SLUG [--json]
  artie doctor [--json]

Publishing defaults to Team only. Public · noindex requires --public.
Use --wait 0 for one verification attempt (the default is 180 seconds).`;

const option = {
  repo: { type: 'string' }, scope: { type: 'string' }, project: { type: 'string' },
  url: { type: 'string' }, 'create-repo': { type: 'boolean' },
  public: { type: 'boolean' }, slug: { type: 'string' }, wait: { type: 'string' },
  json: { type: 'boolean' },
};

function argumentsFor(args, names, positionals = 0) {
  const parsed = parseArgs({
    args,
    options: Object.fromEntries(names.map((name) => [name, option[name]])),
    allowPositionals: positionals > 0,
  });
  if (parsed.positionals.length !== positionals) {
    throw new Error(positionals === 1 ? 'Supply exactly one file or slug. See artie --help.' : 'See artie --help.');
  }
  return [parsed.values, parsed.positionals[0]];
}

function configuredTargets() {
  const targets = loadConfig(findConfig());
  if (!targets.team) throw new Error('Set up the team destination with artie init.');
  return targets;
}

function resultLine(result) {
  const details = result.error ? ` · ${result.error}` : '';
  console.log(`${result.audience} · ${result.state} · ${result.url}${details}`);
}

async function init(args) {
  const [values] = argumentsFor(args, ['repo', 'scope', 'project', 'url', 'create-repo', 'public']);
  const audience = values.public ? 'public' : 'team';
  const path = resolve(configName);
  const prior = existsSync(path) ? loadConfig(path) : {};
  const target = targetConfig({ ...values, repository: values.repo }, audience);
  const config = validateConfig({ ...prior, [audience]: target });
  if (values['create-repo']) await createContentRepo(target, audience);
  saveConfig(path, config);
  console.log(`Saved ${audienceLabel(audience)} destination in ${configName}.`);
  console.log('Import the content repo in Vercel, then run artie doctor.');
}

async function publish(args) {
  const [values, file] = argumentsFor(args, ['public', 'slug', 'wait', 'json'], 1);
  const audience = values.public ? 'public' : 'team';
  const target = configuredTargets()[audience];
  if (!target) throw new Error('Set up a separate public destination with artie init --public.');
  const extension = extname(file);
  if (!/^\.html?$/i.test(extension) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Choose a readable .html or .htm file.');
  }
  if (values.wait !== undefined && (!/^\d+$/.test(values.wait) || Number(values.wait) > 600)) {
    throw new Error('Use --wait with a whole number from 0 to 600 seconds.');
  }
  const seconds = Number(values.wait ?? 180);
  const slug = slugFor(values.slug ?? basename(file, extension));
  const source = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file));
  const content = Buffer.from(renderPage(source, audience));
  const projectId = await checkDestination(target, audience);
  const { state, sha, url } = await pushPage(target, audience, slug, content);
  const result = { audience: audienceLabel(audience), state, url, verified: false };
  console.error(`Git ${state}. Checking ${target.project}'s stable URL…`);
  try {
    result.verified = await waitForPage(target, projectId, audience, slug, sha, seconds);
    if (!result.verified) result.error = 'Deployment verification pending. Run artie status.';
  } catch (error) {
    result.error = error.message;
  }
  if (values.json) console.log(JSON.stringify(result));
  else resultLine({ ...result, state: result.verified ? `${state}, verified` : `${state}, unverified` });
  if (!result.verified) process.exitCode = 2;
}

async function inspect(args, doctor) {
  const [values, input] = argumentsFor(args, ['json'], doctor ? 0 : 1);
  const slug = doctor ? null : slugFor(input);
  const results = [];
  for (const [audience, target] of Object.entries(configuredTargets())) {
    const result = {
      audience: audienceLabel(audience),
      url: doctor ? target.url : pageUrl(target, slug),
      verified: false,
    };
    try {
      const projectId = await checkDestination(target, audience);
      if (doctor) {
        result.verified = true;
        result.state = 'Ready';
      } else {
        const sha = desiredBlob(target, slug);
        result.verified = sha !== null && await livePage(target, projectId, audience, slug, sha);
        result.state = result.verified ? 'Live, verified' : sha ? 'Unverified' : 'Not published';
      }
    } catch (error) {
      result.state = 'Unverified';
      result.error = error.message;
    }
    results.push(result);
  }
  if (values.json) console.log(JSON.stringify(results));
  else results.forEach(resultLine);
  if (results.some(({ state }) => state === 'Unverified')) process.exitCode = 2;
}

async function main([command, ...args]) {
  if (!command || command === 'help' || command === '--help' || args.includes('--help')) {
    console.log(help);
    return;
  }
  if (command === '--version') {
    console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
    return;
  }
  switch (command) {
    case 'init': await init(args); break;
    case 'publish': await publish(args); break;
    case 'status': await inspect(args, false); break;
    case 'doctor': await inspect(args, true); break;
    default: throw new Error(`Unknown command ${command}. See artie --help.`);
  }
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(`Artie: ${error.message}`);
  process.exitCode = 1;
}
