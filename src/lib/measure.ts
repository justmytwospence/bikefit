import { ui } from '../state.svelte';

export type MeasureId = 'saddleHeight' | 'setback' | 'cleat' | 'spacers' | 'stem' | 'crank';

/** Svelte action: while the control is hovered or focused, the drawing shows what it measures. */
export function measure(node: HTMLElement, initial: MeasureId) {
  let id = initial;
  const on = () => (ui.measure = id);
  const off = () => {
    if (ui.measure === id) ui.measure = null;
  };
  node.addEventListener('pointerenter', on);
  node.addEventListener('focusin', on);
  node.addEventListener('pointerleave', off);
  node.addEventListener('focusout', off);
  return {
    update(next: MeasureId) {
      off();
      id = next;
    },
    destroy() {
      off();
      node.removeEventListener('pointerenter', on);
      node.removeEventListener('focusin', on);
      node.removeEventListener('pointerleave', off);
      node.removeEventListener('focusout', off);
    },
  };
}
