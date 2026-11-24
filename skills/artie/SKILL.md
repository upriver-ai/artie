---
name: artie
description: Publish a local HTML report, prototype, or artifact to an Artie team or public Vercel link. Use when the user requests a browser link and the project has an artie.json configuration.
---

# Publish with Artie

- Use a self-contained UTF-8 HTML file with its CSS, scripts, and assets inline. Publishing sends the file to the configured GitHub and Vercel destination.
- For a team link use `artie publish <file.html> --json`. Reuse a slug for an update only when the user intends to replace that page.
- Pass `--public` only when the user explicitly asks for public access. Any visitor can open that URL. The response asks crawlers to omit it from search results.
- Use the project's pinned CLI where available, such as `npm exec -- artie publish <file.html> --json`. The [Artie quickstart](https://github.com/upriver-ai/artie#quickstart) has the version-pinned GitHub install.
- Report the returned audience and URL when `verified` is true. If a commit was pushed and verification is pending, report that status and check `artie status <slug>`. Use `artie doctor` for configuration errors.
