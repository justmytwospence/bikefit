import { ui, type Peek } from '../state.svelte';

/** How long the pointer rests before the drawing follows, so sweeping across a list does not flicker. */
const DWELL = 150;
type Owner = object;

const stack: { owner: Owner; make: () => Peek | null }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

const keyOf = (p: Peek | null): string =>
  !p ? '' : p.kind === 'setup' ? `s:${p.label}:${JSON.stringify(p.params)}`
    : p.kind === 'bike' ? `b:${p.row.frameId}:${p.other?.row.frameId ?? ''}` : `y:${p.styleId}`;

function sync() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const top = stack.at(-1);
    const p = top ? top.make() : null;
    if (keyOf(p) !== keyOf(ui.peek)) {
      ui.peek = p;
      ui.animate = true;
    }
  }, DWELL);
}

function drop(owner: Owner) {
  const i = stack.findIndex((s) => s.owner === owner);
  if (i >= 0) stack.splice(i, 1);
}

/** The drawing shows what `make` returns until `leavePeek`; the most recent owner wins. */
export function enterPeek(owner: Owner, make: () => Peek | null) {
  drop(owner);
  stack.push({ owner, make });
  sync();
}

export function leavePeek(owner: Owner) {
  drop(owner);
  sync();
}

export function clearPeek() {
  stack.length = 0;
  clearTimeout(timer);
  if (ui.peek) {
    ui.peek = null;
    ui.animate = true;
  }
}

/** Svelte action: while a mouse or pen is over the node, the drawing shows what `make` returns. */
export function peek(node: Element, make: () => Peek | null) {
  let cur = make;
  const owner = {};
  const on = (e: Event) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    enterPeek(owner, () => cur());
  };
  const off = () => leavePeek(owner);
  node.addEventListener('pointerenter', on);
  node.addEventListener('pointerleave', off);
  return {
    update(next: () => Peek | null) { cur = next; },
    destroy() {
      node.removeEventListener('pointerenter', on);
      node.removeEventListener('pointerleave', off);
      leavePeek(owner);
    },
  };
}
