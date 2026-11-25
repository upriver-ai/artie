# Artie

**Share Codex and Claude Code HTML artifacts with your team.**

Your agent made a report, dashboard, or demo. Artie gives the HTML file a stable
browser link behind your Vercel team login. Publish a new version at the same URL.
It works with any tool that produces a self-contained HTML file.

## How it works

```mermaid
flowchart LR
    accTitle: How Artie publishes an HTML artifact
    accDescr: Artie publishes a local HTML file through GitHub and Vercel. The default link requires Vercel sign-in. Public publishing uses a separate repository and project and adds noindex.
    artifact["HTML from Codex<br/>or Claude Code"] --> cli["artie publish"]
    cli -->|Default| teamRepo["Private GitHub repo"]
    teamRepo --> teamHost["Vercel project<br/>Sign-in required"]
    teamHost --> teamLink(["Team link"])
    cli -.->|"--public"| publicRepo["Separate private GitHub repo"]
    publicRepo --> publicHost["Separate Vercel project"]
    publicHost --> publicLink(["Public link · noindex"])
```

## Quickstart

Set up one private GitHub repo and one Vercel project for your team. The GitHub
repo stores published pages. Vercel hosts them and controls who can open them.

### Install Artie

Install Node.js 22+, Git, the [GitHub CLI](https://cli.github.com/), and the
[Vercel CLI](https://vercel.com/docs/cli). Sign in with `gh auth login` and
`vercel login`. Artie commits from temporary checkouts, so use a Git name and
email available outside your authoring repo. Use an email associated with the
GitHub account linked to Vercel.

From the repo where you create artifacts:

```sh
npm install --save-dev 'github:upriver-ai/artie#v0.1.0'
```

### Team destination

1. Create the private content repo. Replace the GitHub owner, Vercel team slug,
   project name, and domain with yours.

   ```sh
   npm exec --no -- artie init \
     --repo your-org/team-artifacts --scope your-vercel-team \
     --project team-artifacts --url https://team-artifacts.vercel.app \
     --create-repo
   ```

   Artie seeds the repo and saves the destination in `artie.json`. Omit
   `--create-repo` when connecting an existing Artie content repo.

2. In Vercel, [import the content repo](https://vercel.com/docs/git/vercel-for-github)
   into your team and grant the Vercel GitHub App access to it. Use **Other**
   as the framework preset, the repository root as **Root Directory**, and
   **main** as the production branch. Connecting a private GitHub organization
   repo requires Vercel Pro or Enterprise.

3. Under **Security → Deployment Protection**, enable **Vercel Authentication**
   for **All Deployments**. Give teammates project access and keep public share
   links and protection exceptions off. Confirm the production URL in
   **Domains**. If it differs from the URL you entered, rerun step 1 with the
   correct URL and omit `--create-repo`.
   [Vercel Authentication](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan)

4. Once Vercel finishes the first deployment, check the setup and publish.

   ```sh
   npm exec --no -- artie doctor
   npm exec --no -- artie publish report.html --slug monthly-report
   ```

   Share the returned URL with teammates who have Vercel project access. To
   check the deployment again, run `npm exec --no -- artie status monthly-report`.

Share `artie.json` with teammates who need to publish to the same destination.
Publishers need GitHub write access and Vercel project access. Readers only
need Vercel project access.

### Public destination (optional)

Use a separate private GitHub repo, Vercel project, and production domain.

```sh
npm exec --no -- artie init --public \
  --repo your-org/public-artifacts --scope your-vercel-team \
  --project public-artifacts --url https://public-artifacts.vercel.app \
  --create-repo
```

Import the repo with the same build settings as above. Set Deployment Protection
to **Standard Protection** so the production domain opens signed out. Once the
first deployment is ready, run:

```sh
npm exec --no -- artie doctor
npm exec --no -- artie publish report.html --public
```

Anyone with the public URL can open it. Artie adds a `noindex` response header
to ask compliant search engines to omit it. Each page displays its audience as
**Team only** or **Public · noindex**.

### Give your agent the skill

```sh
npx skills add upriver-ai/artie@v0.1.0 --skill artie --agent codex claude-code
```

Then ask Codex or Claude Code: “Publish this HTML artifact for the team with Artie.”

[Troubleshooting](docs/setup.md#publishing-and-troubleshooting) · [Example artifact](examples/report.html) ·
[MIT license](LICENSE)
