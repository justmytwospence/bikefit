# bikefit: agent guidance

A client-only Svelte app (no server, no secrets). See README.md for what it does and the commands.

## Branches and hosts

| Branch | Host | How it deploys |
| --- | --- | --- |
| `main` | https://bikefitter.app (production) | Vercel Git integration, on every push to `main` |
| `dev` | https://dev.bikefitter.app | Vercel preview, on every push to `dev` |
| feature branch `<branch>` | https://&lt;branch&gt;.bikefitter.app | Vercel preview, once `npm run preview:domain -- <branch>` has added the host |

Vercel project `bikefitter` (`prj_sErujeDNIBPNHFGADmQDs8FnNfht`), team `spencers-projects-19cee858` (`team_TwgeP3rwrsOV5S5i2hX1oJIx`); build settings are in `vercel.json`. DNS is at Cloudflare (zone `bikefitter.app`, DNS only, no proxy): the apex `A` records, `dev`, and a wildcard `*` `CNAME` point at Vercel, so a new branch host needs no DNS change. Previews (dev and branch hosts, and every `*.vercel.app` URL) sit behind Vercel's login (Standard Protection), so open them signed in to Vercel; only https://bikefitter.app is public. Each host is its own origin, so its saved rider and bikes (localStorage) are separate.

CI (`.github/workflows/ci.yml`, job `verify`) runs tests, svelte-check and the build on every push. Vercel builds independently, so a deployment going Ready is not proof that the tests passed: check both.

## Workflow

- Day-to-day work happens on `dev`, in the main checkout.
- Longer, more complicated, or concurrent work goes on a feature branch with a bare slug name (`size-walk`, not `feature/size-walk`), in a worktree at `.worktrees/<branch>` only when one is asked for. Start it from `dev`, run `npm run preview:domain -- <branch>` once so it gets `<branch>.bikefitter.app`, and rebase it onto `origin/dev` before it lands.
- **Push every commit on `dev` or a feature branch right away, without asking.** Spencer checks changes on the deployed host, so an unpushed commit is an unchecked one. After pushing, wait for CI (`gh run watch <id> --exit-status`) and give him the URL and the commit to check.
- A feature branch lands by fast-forwarding `dev` to it (`git push origin <branch>:dev` after rebasing), then `npm run preview:domain -- <branch> --remove`.
- **Production only on Spencer's explicit instruction.** Once he has checked dev: `git tidy` on `dev` (and `git push --force-with-lease origin dev` if it rewrote anything, then wait for CI again), then fast-forward main with `git push origin dev:main`. Never commit on `main` directly, never force-push it.
- Before pushing: `npm test`, `npm run check`, `npm run build`.
