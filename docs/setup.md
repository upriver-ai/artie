# Artie setup and troubleshooting

## Team destination

Follow the [team setup in the README](../README.md#team-destination).

## Public destination

Follow the [public setup in the README](../README.md#public-destination-optional).

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
