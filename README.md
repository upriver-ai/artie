# Artie

An open-source alternative to Claude Artifacts for sharing HTML. Publish a report,
prototype, or dashboard from any coding agent to a stable URL on your Vercel
project. Team only by default.

```sh
artie publish report.html
artie publish report.html --slug monthly-report
artie status monthly-report
```

GitHub stores the files and their history. Vercel serves the pages and handles
access. The CLI accepts UTF-8 HTML documents and fragments. Inline your CSS,
JavaScript, and assets so the page can travel as one file.

## Quickstart

Install Node.js 22+, Git, the [GitHub CLI](https://cli.github.com/), and
the [Vercel CLI](https://vercel.com/docs/cli). Sign in with `gh auth login` and
`vercel login`. Use a Git commit email associated with the GitHub account linked
to your Vercel account. Team publishing from a private GitHub organization repo
requires [Vercel Pro or Enterprise](https://vercel.com/docs/git).

From the codebase where you make artifacts, install the pinned CLI:

```sh
npm install --save-dev 'github:upriver-ai/artie#v0.1.0'
npm exec -- artie --help
```

Use `npm exec -- artie …` for the commands below, or install the same release
globally with `npm install --global 'github:upriver-ai/artie#v0.1.0'`. A one-off
run works with `npx --package='github:upriver-ai/artie#v0.1.0' artie --help`.

### Set up a team destination

1. Pick a Vercel scope and a project name. The production domain can be the
   project's `.vercel.app` domain or a custom domain you own.
2. In your authoring repo, create `artie.json` and a **separate private** content
   repo seeded with a static hosting template. Replace the example values:

   ```sh
   artie init --repo your-org/your-team-pages --scope your-team \
     --project your-team-pages --url https://your-team-pages.vercel.app \
     --create-repo
   ```

3. In Vercel, [import the private GitHub repo](https://vercel.com/docs/git/vercel-for-github)
   into your chosen scope. Grant the GitHub app access to that repo when prompted.
   Use the repository root, framework preset **Other**, and production branch
   **main**. The deployment uses the checked-in static configuration.
4. In the Vercel project, choose **Security → Deployment Protection → Vercel
   Authentication → All Deployments**. Give teammates project access. Keep
   deployment protection exceptions and public share links disabled for this
   project. Select the verified production domain under **Domains**.
   If Vercel assigned a different domain, rerun `artie init` with that URL and
   omit `--create-repo`. [Vercel Authentication](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan)
5. Run `artie doctor`, then `artie publish report.html`. The [example report](examples/report.html)
   is safe to use as a first publish. Open the URL while
   signed in to Vercel and in a private window to verify the recipient experience.

Commit `artie.json` to the authoring repo if the team should share its settings.
It stores destination identifiers. GitHub and Vercel CLI sessions handle credentials.
To connect an already seeded Artie content repo, omit `--create-repo`.

### Add public publishing

Run `artie init --public --create-repo` with a **separate** private GitHub
repo, Vercel project, and production domain. Import that repo into Vercel with
the same static settings. Set Deployment Protection to **Standard Protection** so
the public production domain opens signed out. Then:

```sh
artie doctor
artie publish report.html --public
artie status report
```

Public pages carry `X-Robots-Tag: noindex, nofollow`. Anyone with the URL can
read them. The site has no page directory or sitemap, and the header asks
compliant search engines to omit the page. [Google's noindex documentation](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

### Add the agent skill

Run this inside your authoring repo:

```sh
npx skills add upriver-ai/artie@v0.1.0 --skill artie --agent codex claude-code
```

You can also copy [the skill folder](skills/artie) into `.agents/skills/artie`
for Codex or `.claude/skills/artie` for Claude Code.

## Publishing behavior

- A file named `report.html` defaults to `/p/report`. Publishing the same slug to
  the same destination updates the URL. Identical rendered content skips a Git push.
  The team and public copies of a slug are independent.
- Every page carries a **Team only** or **Public · noindex** label. The CLI checks
  the Vercel project, domain, repo, and anonymous access before pushing.
- Public verification fetches the page and checks its bytes and robots header.
  Team verification checks for the Vercel login gate and confirms the active
  production deployment's Git commit contains the expected page.
- If the push succeeds and verification times out, the CLI returns exit code 2.
  Run `artie status <slug>` to check again. Use `--json` for automation.
- Publish HTML from trusted authors. Your browser runs its JavaScript on the
  destination origin. Keep secrets out of HTML and Git history.

## Contributing

Run `npm test` on Node.js 22 or newer. The project is MIT licensed.
