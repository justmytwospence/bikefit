import { event } from './analytics';
import type { LinkId } from './linkIds';
import { ui } from '../state.svelte';

/** What the drawing shows: the hovered or focused number, else the pinned one. */
export const focus = (): LinkId | null => ui.hover ?? ui.pin;

/** Tapping a linked number keeps it on the drawing until it is tapped again or another is. */
export function togglePin(id: LinkId) {
  ui.pin = ui.pin === id ? null : id;
  if (ui.pin) event('Linked', { what: id });
}

/** Finds a linked number's field in the panel, opens what hides it and scrolls it into view. */
export function reveal(id: LinkId) {
  const el = document.querySelector<HTMLElement>(`[data-link="${id}"]`);
  if (!el) return;
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) d.open = true;
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

let seq = 0;
type Arg = LinkId | { id: LinkId; pin?: boolean } | undefined;
const parse = (a: Arg) => (a === undefined ? null : typeof a === 'string' ? { id: a, pin: false } : { id: a.id, pin: !!a.pin });

/**
 * Svelte action linking a number in the panel to the drawing: while it is hovered or focused the drawing shows
 * what it measures, and with `pin` a tap keeps it there. The drawing outlines it back while it is shown.
 */
export function link(node: HTMLElement, initial: Arg) {
  let cur = parse(initial);
  const on = (e: Event) => {
    if (!cur || (e instanceof PointerEvent && e.pointerType === 'touch')) return;
    seq++;
    ui.hover = cur.id;
  };
  // Deferred: focusout also fires when Svelte removes a focused control mid-update (a knob
  // moving between Fit sections), where writing state would throw state_unsafe_mutation.
  // The sequence number keeps a later pointerenter from being undone.
  const off = () => {
    const was = cur?.id;
    const at = seq;
    queueMicrotask(() => {
      if (seq === at && ui.hover === was) ui.hover = null;
    });
  };
  const click = () => {
    if (cur?.pin) togglePin(cur.id);
  };
  const key = (e: KeyboardEvent) => {
    if (!cur?.pin || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    togglePin(cur.id);
  };
  const tag = () => {
    if (cur) node.dataset.link = cur.id;
    else delete node.dataset.link;
  };
  tag();
  node.addEventListener('pointerenter', on);
  node.addEventListener('focusin', on);
  node.addEventListener('pointerleave', off);
  node.addEventListener('focusout', off);
  node.addEventListener('click', click);
  node.addEventListener('keydown', key);
  $effect(() => {
    const shown = !!cur && focus() === cur.id;
    node.classList.toggle('linked', shown);
    if (cur?.pin) node.setAttribute('aria-pressed', String(!!cur && ui.pin === cur.id));
  });
  return {
    update(next: Arg) {
      off();
      cur = parse(next);
      tag();
    },
    destroy() {
      off();
      node.removeEventListener('pointerenter', on);
      node.removeEventListener('focusin', on);
      node.removeEventListener('pointerleave', off);
      node.removeEventListener('focusout', off);
      node.removeEventListener('click', click);
      node.removeEventListener('keydown', key);
      node.classList.remove('linked');
    },
  };
}
