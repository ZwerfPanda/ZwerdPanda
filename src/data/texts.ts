/**
 * His own wording for texts on the site. Every edit is keyed by the text as
 * the site has it (trimmed), so the same words read the same everywhere they
 * appear, and the same edit made on two phones of his stays one edit.
 */

export const TEXT_FROM_MAX = 1000;
export const TEXT_TO_MAX = 2000;
export const TEXTS_LIMIT = 1000;

/** The text without the surrounding whitespace and with runs of spaces as one. */
export function textKeyOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** A short, stable id for an original text (FNV-1a, 2×32 bits). */
export function textId(from: string): string {
  const key = textKeyOf(from);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 13);
  }
  return `text-${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}
