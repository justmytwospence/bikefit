import { ui } from '../state.svelte';

export type MeasureId = 'saddleHeight' | 'setback' | 'cleat' | 'spacers' | 'stem' | 'crank';

let seq = 0;

/** Svelte action: while the control is hovered or focused, the drawing shows what it measures. */
export function measure(node: HTMLElement, initial: MeasureId) {
  let id = initial;
  const on = () => {
    seq++;
    ui.measure = id;
  };
  // Deferred: focusout also fires when Svelte removes a focused control mid-update (a knob
  // moving between Fit sections), where writing state would throw state_unsafe_mutation.
  // The sequence number keeps a later pointerenter from being undone.
  const off = () => {
    const was = id;
    const at = seq;
    queueMicrotask(() => {
      if (seq === at && ui.measure === was) ui.measure = null;
    });
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
