/**
 * Gives a feature branch its own preview hostname, <branch>.bikefitter.app, or takes it away.
 *
 *   npm run preview:domain -- <branch>            add the domain to the Vercel project for that branch
 *   npm run preview:domain -- <branch> --remove   remove it
 *   npm run preview:domain -- --build             from the Vercel build: add the building branch's
 *
 * DNS needs nothing per branch: Cloudflare has a DNS-only wildcard CNAME for *.bikefitter.app, and
 * bikefitter.app is on the Vercel team, so a new hostname is verified at once with no TXT record.
 * Adding one to a branch that already deployed points it at that deployment at once; later
 * deployments of the branch take it over as each becomes Ready.
 *
 * Credentials: PREVIEW_DOMAIN_TOKEN (a Vercel token, set for Preview builds), else VERCEL_TOKEN,
 * else the Vercel CLI's own login.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEAM_ID = 'team_TwgeP3rwrsOV5S5i2hX1oJIx';
const PROJECT = 'bikefitter';
const ZONE = 'bikefitter.app';
/** Hosts that are not feature branches: production, dev, and names a branch must not take. */
const RESERVED = ['main', 'dev', 'www', 'api', 'mail'];
/** Branches with a domain of their own, never a preview hostname. */
const OWN_DOMAIN = ['main', 'dev'];

/** The preview hostname of a branch: one DNS label, lowercase, at most 63 characters. */
export function previewHost(branch: string): string {
  const label = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
  if (!label) throw new Error(`branch ${JSON.stringify(branch)} makes no hostname`);
  if (RESERVED.includes(label)) throw new Error(`${label} is reserved`);
  return `${label}.${ZONE}`;
}

function vercelToken(): string {
  const env = process.env.PREVIEW_DOMAIN_TOKEN || process.env.VERCEL_TOKEN;
  if (env) return env;
  const dirs = [
    join(homedir(), 'Library/Application Support/com.vercel.cli'),
    join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'), 'com.vercel.cli'),
  ];
  for (const dir of dirs) {
    try {
      const token = JSON.parse(readFileSync(join(dir, 'auth.json'), 'utf8')).token;
      if (token) return token;
    } catch {
      /* try the next login */
    }
  }
  throw new Error('set VERCEL_TOKEN or log in with `vercel login`');
}

async function vercel(method: string, path: string, body?: unknown) {
  const url = new URL(path, 'https://api.vercel.com');
  url.searchParams.set('teamId', TEAM_ID);
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${vercelToken()}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = res.status === 204 ? {} : await res.json();
  return { status: res.status, json };
}

async function add(host: string, branch: string) {
  const added = await vercel('POST', `/v10/projects/${PROJECT}/domains`, { name: host, gitBranch: branch });
  let domain = added.json;
  if (added.status === 409) {
    domain = (await vercel('GET', `/v9/projects/${PROJECT}/domains/${host}`)).json;
    if (domain.gitBranch !== branch) throw new Error(`${host} already serves branch ${domain.gitBranch}`);
  } else if (added.status >= 300) {
    throw new Error(`Vercel add ${host}: ${JSON.stringify(added.json)}`);
  }
  if (domain.verified) return;
  throw new Error(`${host} added but Vercel wants it verified: ${JSON.stringify(domain.verification ?? [])}. Add that record in Cloudflare, then rerun.`);
}

async function remove(host: string) {
  const removed = await vercel('DELETE', `/v9/projects/${PROJECT}/domains/${host}`);
  if (removed.status >= 300 && removed.status !== 404) {
    throw new Error(`Vercel remove ${host}: ${JSON.stringify(removed.json)}`);
  }
}

/** The Vercel build's branch, or why it gets no preview hostname. */
export function buildBranch(env: NodeJS.ProcessEnv): { branch: string } | { skip: string } {
  if (env.VERCEL_ENV !== 'preview') return { skip: `a ${env.VERCEL_ENV ?? 'local'} build` };
  const branch = env.VERCEL_GIT_COMMIT_REF;
  if (!branch) return { skip: 'no Git branch' };
  if (OWN_DOMAIN.includes(branch)) return { skip: `${branch} has its own domain` };
  if (!env.PREVIEW_DOMAIN_TOKEN) return { skip: 'PREVIEW_DOMAIN_TOKEN is not set' };
  return { branch };
}

/** From the Vercel build: never fails it, a missing hostname is not worth a failed preview. */
async function fromBuild() {
  const target = buildBranch(process.env);
  if ('skip' in target) {
    console.log(`preview domain: skipped (${target.skip})`);
    return;
  }
  try {
    const host = previewHost(target.branch);
    await add(host, target.branch);
    console.log(`preview domain: https://${host}`);
  } catch (e) {
    console.warn(`preview domain: not added: ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--build')) return fromBuild();
  const branch = args.find((a) => !a.startsWith('--'));
  const removing = args.includes('--remove');
  if (!branch) throw new Error('usage: npm run preview:domain -- <branch> [--remove] | --build');
  const host = previewHost(branch);
  if (removing) {
    await remove(host);
    console.log(`removed https://${host}`);
  } else {
    await add(host, branch);
    console.log(`https://${host} serves the latest deployment of ${branch}`);
  }
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
