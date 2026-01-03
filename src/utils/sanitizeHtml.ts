import sanitizeHtml from 'sanitize-html';

export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'b',
      'i',
      'u',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'a',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'br',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
