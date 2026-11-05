import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const md = new Marked({ gfm: true, breaks: true, async: false });

// Links in replies open in a new tab and never leak the opener.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * While a reply is streaming, an unfinished ``` fence would swallow the rest of the layout
 * (or flip once the closing fence arrives). Close it so partial code renders as a code block.
 */
export function closeOpenFence(src: string): string {
  const fences = src.match(/^ {0,3}(```|~~~)/gm);
  if (!fences || fences.length % 2 === 0) return src;
  const marker = fences[fences.length - 1]?.trim() === '~~~' ? '~~~' : '```';
  return src + (src.endsWith('\n') ? '' : '\n') + marker;
}

/** Markdown to sanitised HTML. The output is safe to bind with [innerHTML] (never bypass Angular's sanitiser for it). */
export function renderMarkdown(src: string): string {
  const html = md.parse(closeOpenFence(src)) as string;
  // No images/media and no remote `src`: a prompt-injected reply must not make the browser fetch attacker URLs.
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'img', 'picture', 'source', 'video', 'audio', 'track', 'iframe', 'embed', 'object', 'link'],
    FORBID_ATTR: ['style', 'src', 'srcset', 'poster', 'background', 'ping', 'action', 'formaction', 'longdesc', 'manifest', 'lowsrc', 'dynsrc'],
  });
}
