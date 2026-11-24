# Set up Artie

Run these commands from the repo where you create HTML artifacts. Start with the
[README quickstart](../README.md#quickstart) to install Artie and sign in to
GitHub and Vercel. Artie commits from temporary checkouts. Set a Git identity
available outside your authoring repo, using an email associated with the
GitHub account linked to Vercel.

## Team destination

1. Choose a name for the private GitHub content repo and the Vercel project.
   In your authoring repo, run this with your GitHub owner and Vercel team slug.

   ```sh
   npm exec --no -- artie init \
     --repo your-org/team-artifacts --scope your-vercel-team \
     --project team-artifacts --url https://team-artifacts.vercel.app \
     --create-repo
   ```

   Artie creates the private repo with a static site template and saves the
   destination in `artie.json`.

2. [Import the content repo](https://vercel.com/docs/git/vercel-for-github) into
   that Vercel team. Grant the Vercel GitHub App access to the new repo when
   prompted. Select **Other** as the framework preset, the repository root
   as **Root Directory**, and **main** as the production branch.

3. Under **Security → Deployment Protection**, enable **Vercel Authentication**
   for **All Deployments**. Give teammates access to the Vercel project. Keep
   public share links and deployment protection exceptions off for this project.
   In **Domains**, confirm the production URL. If it differs from the URL you
   configured, rerun the command from step 1 with the correct URL and omit
   `--create-repo`.
   [Vercel Authentication](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan)

4. Once Vercel finishes the first deployment, check the setup and publish.

   ```sh
   npm exec --no -- artie doctor
   npm exec --no -- artie publish report.html --slug monthly-report
   ```

   Use the [example report](../examples/report.html) for a test publish. Open the
   link while signed in to Vercel and in a private browser window.

Commit `artie.json` if teammates should use the same destinations. It stores
destination identifiers. GitHub and Vercel CLI sessions provide credentials.
To connect an existing, seeded Artie content repo, omit `--create-repo`.

## Public destination

Choose a separate private GitHub repo, Vercel project, and production domain.

```sh
npm exec --no -- artie init --public \
  --repo your-org/public-artifacts --scope your-vercel-team \
  --project public-artifacts --url https://public-artifacts.vercel.app \
  --create-repo
```

Import the repo with the same static site settings. Choose **Standard
Protection** so the production domain opens signed out. Then run
`npm exec --no -- artie doctor` and publish with `--public`.

The public site has no directory or sitemap. Its response includes
`X-Robots-Tag: noindex, nofollow`, which asks compliant crawlers to leave the
page out of search results. Anyone with the URL can open it.
[Google’s noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

## Publishing and troubleshooting

- Artie accepts UTF-8 HTML files and fragments. Inline any assets, styles, or
  scripts the page needs.
- A slug is shared across a destination. `report.html` defaults to `/p/report`.
  Use a distinct `--slug` for a new page. Reuse a slug to replace that page at
  the same URL. Team and public destinations have independent slugs.
- Artie checks the configured destination before pushing. It checks the team
  URL for a Vercel login gate and confirms that the active deployment's Git commit
  contains the expected file. For a public URL, it checks the live bytes and
  `noindex` header.
- If a push succeeds but the link isn’t verified yet, Artie exits with code 2.
  Run `npm exec --no -- artie status <slug>` to check again. Use `--json` for automation.
- Review generated HTML before sharing. Pages on a destination share an origin,
  and browsers execute the JavaScript in them. Keep secrets out of HTML and Git
  history.

For a global CLI install, run
`npm install --global 'github:upriver-ai/artie#v0.1.0'`, then use `artie` directly.
