import { textKeyOf } from '../../data/texts';
import type { TextEdit } from '../../data/types';

/*
 * His own wording, shown everywhere on the site. Every text on the page is a
 * text node; when one matches a text he changed, it shows his version instead.
 * The original is remembered, so taking an edit back restores it, and React
 * keeps working as usual: it only ever writes the original, which we then
 * swap again.
 */

/** Never touched: form fields, code, and our own editor. */
const EXCLUDE =
  'script,style,noscript,textarea,input,select,option,code,pre,[contenteditable],[data-no-retext]';

interface Shown {
  /** What the site wrote. */
  from: string;
  /** What we show instead. */
  shown: string;
}

const swapped = new WeakMap<Text, Shown>();
let wording = new Map<string, string>();
let observer: MutationObserver | null = null;

const isExcluded = (node: Text) => {
  const el = node.parentElement;
  return !el || Boolean(el.closest(EXCLUDE));
};

/** The text as the site wrote it, even while it shows his version. */
export function originalText(node: Text): string {
  const value = node.nodeValue ?? '';
  const s = swapped.get(node);
  return s && value === s.shown ? s.from : value;
}

function apply(node: Text) {
  if (isExcluded(node)) return;
  const value = node.nodeValue ?? '';
  const s = swapped.get(node);
  const ours = Boolean(s && value === s.shown);
  const from = ours ? s!.from : value;
  const to = wording.get(textKeyOf(from));
  if (to === undefined) {
    // No (longer an) edit for this text: show the site's own words again.
    if (ours && value !== from) node.nodeValue = from;
    swapped.delete(node);
    return;
  }
  // Keep the spaces around it, so words don't run into each other.
  const lead = /^\s*/.exec(from)![0];
  const trail = from.length > lead.length ? /\s*$/.exec(from)![0] : '';
  const shown = lead + to + trail;
  swapped.set(node, { from, shown });
  if (value !== shown) node.nodeValue = shown;
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return apply(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) apply(n as Text);
}

/** Show these edits from now on (an empty list puts every text back). */
export function setWording(edits: TextEdit[]) {
  if (typeof document === 'undefined') return;
  const next = new Map<string, string>();
  // The newest edit of a text wins (two of his phones could each have made one).
  [...edits].sort((a, b) => a.at.localeCompare(b.at)).forEach((e) => next.set(e.from, e.to));
  const hadAny = wording.size > 0;
  wording = next;
  if (next.size && !observer) {
    observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') apply(r.target as Text);
        else r.addedNodes.forEach(walk);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (next.size || hadAny) walk(document.body);
  if (!next.size && observer) {
    observer.disconnect();
    observer = null;
  }
}

/** The text node under a tap, or the first real text inside what was tapped. */
export function textAt(x: number, y: number, target: Element): Text | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null | undefined = null;
  try {
    node = doc.caretPositionFromPoint
      ? doc.caretPositionFromPoint(x, y)?.offsetNode
      : doc.caretRangeFromPoint?.(x, y)?.startContainer;
  } catch {
    node = null;
  }
  const usable = (n: Node | null | undefined): n is Text =>
    Boolean(n) &&
    n!.nodeType === Node.TEXT_NODE &&
    Boolean(textKeyOf(n!.nodeValue ?? '')) &&
    !isExcluded(n as Text);
  if (usable(node) && target.contains(node)) return node;
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (usable(n)) return n;
  return null;
}
