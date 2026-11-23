import sanitizeHtml from 'sanitize-html';

/**
 * XSS 보안 방어를 위한 허용 목록(Allowlist) 기반 HTML 정제기
 * - script, style, svg, form, iframe, object, embed 등 위험 태그 원천 제거
 * - on* 인라인 이벤트 핸들러 및 style 속성 원천 제거
 * - javascript:, data:, vbscript: 등의 악성 URL 스키마 차단 (http, https, mailto, tel만 허용)
 */
export function sanitizeNoticeHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  return sanitizeHtml(dirtyHtml, {
    allowedTags: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div',
      'img', 'a', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr'
    ],
    allowedAttributes: {
      'a': ['href', 'target', 'rel', 'class'],
      'img': ['src', 'alt', 'class', 'loading'],
      'table': ['class'],
      'th': ['colspan', 'rowspan', 'class'],
      'td': ['colspan', 'rowspan', 'class'],
      '*': ['class'], // style 속성 차단 (CSS expression, background:url(javascript:...) 방지)
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      'a': (tagName, attribs) => {
        let href = attribs.href || '';
        // 혹시 모를 javascript:, data: 스킴 2중 방어
        if (href.trim().toLowerCase().startsWith('javascript:') || href.trim().toLowerCase().startsWith('data:')) {
          href = '#';
        }
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            href,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        };
      },
    },
  });
}
