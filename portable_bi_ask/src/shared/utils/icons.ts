import { html, type HTMLTemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { IconNode, SVGProps } from 'lucide';

export function icon(iconNode: IconNode, attrs: SVGProps = {}): HTMLTemplateResult {
  const size = attrs.size ?? attrs.width ?? 24;
  const strokeWidth = attrs.strokeWidth ?? 2;
  const customClass = attrs.class ? ` ${String(attrs.class)}` : '';

  const children = iconNode.map(([tag, elemAttrs]) => {
    const attrStrings = Object.entries(elemAttrs).map(([k, v]) =>
      v === undefined ? '' : `${k}="${v}"`,
    );
    return `<${tag} ${attrStrings.filter(Boolean).join(' ')} />`;
  });

  const svg = `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${size}"
    height="${size}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="${strokeWidth}"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="lucide${customClass}"
    aria-hidden="true"
  >
    ${children.join('')}
  </svg>`;

  return html`${unsafeHTML(svg)}`;
}
