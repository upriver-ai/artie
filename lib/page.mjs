import { createHash } from 'node:crypto';

export const markerFile = 'artie-check.txt';
export const marker = (audience) => `Artie: ${audience}\n`;
export const audienceLabel = (audience) => audience === 'team' ? 'Team only' : 'Public · noindex';

export const hostingConfig = JSON.stringify({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null,
  buildCommand: null,
  installCommand: null,
  outputDirectory: 'public',
  cleanUrls: true,
  headers: [{
    source: '/(.*)',
    headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ],
  }],
}, null, 2) + '\n';

export function slugFor(text) {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || slug.length > 100) throw new Error('Use a slug with 1–100 letters, digits, or hyphens.');
  return slug;
}

export function gitBlob(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

export function renderPage(source, audience) {
  const html = source.replace(/^\uFEFF/, '');
  const banner = `<aside role="note" data-artie-audience="${audience}" style="all:initial;display:block;padding:8px 14px;background:#f3f4f6;color:#172033;font:600 13px/1.4 system-ui,sans-serif;box-sizing:border-box">${audienceLabel(audience)}</aside>`;
  // Match complete tags, including quoted attributes. Skip raw text so an
  // example string inside a script or style cannot be mistaken for the body.
  const tags = /<!--[^]*?(?:-->|$)|<\/?([a-z][a-z0-9:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  let headEnd = null;
  let htmlEnd = null;
  let tag;
  while ((tag = tags.exec(html)) !== null) {
    const name = tag[1]?.toLowerCase();
    if (name === 'body' && !tag[0].startsWith('</')) {
      const position = tag.index + tag[0].length;
      return html.slice(0, position) + '\n' + banner + '\n' + html.slice(position);
    }
    if (name === 'head' && tag[0].startsWith('</')) headEnd = tag.index + tag[0].length;
    if (name === 'html' && !tag[0].startsWith('</')) htmlEnd = tag.index + tag[0].length;
    if (name === 'script' || name === 'style' || name === 'textarea' || name === 'title') {
      if (!tag[0].startsWith('</')) {
        const closing = new RegExp(`</${name}\\s*>`, 'gi');
        closing.lastIndex = tags.lastIndex;
        const rawEnd = closing.exec(html);
        if (!rawEnd) break;
        tags.lastIndex = closing.lastIndex;
      }
    }
  }
  return wrapWithBanner(html, banner, headEnd, htmlEnd);
}

function wrapWithBanner(html, banner, headEnd, htmlEnd) {
  // Retain an existing document's metadata when its body tag is omitted.
  if (headEnd !== null || htmlEnd !== null) {
    const at = headEnd ?? htmlEnd;
    return html.slice(0, at) + '\n' + banner + '\n' + html.slice(at);
  }
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Shared artifact</title>\n' +
    `</head>\n<body>\n${banner}\n${html.replace(/^\s*<!doctype[^>]*>/i, '')}\n</body>\n</html>\n`;
}
