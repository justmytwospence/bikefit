<script lang="ts">
  import { event } from '../../lib/analytics';
  import { barsDrag, crankAngle, saddleDrag } from '../../lib/drag';
  import { reveal, togglePin } from '../../lib/link.svelte';
  import type { LinkId } from '../../lib/linkIds';
  import type { Impossible } from '../../model/limits';
  import type { RiderPose } from '../../model/pose';
  import type { Components, FitParams, Frame, Layout, ParamKey, PartOptions } from '../../model/types';
  import type { Vec2 } from '../../model/vec';
  import { app, setKnob, ui } from '../../state.svelte';

  /** Grab handles over the saddle, the bars and the pedal: dragging one changes the setting behind it. */
  let { layout, pose, frame, components, options, editable, whyImpossible }: {
    layout: Layout; pose: RiderPose; frame: Frame; components: Components; options: PartOptions;
    /** Whether the saddle and bars can be dragged (Fit my bike, on the setup being edited). */
    editable: boolean;
    whyImpossible: (p: FitParams) => Impossible | null;
  } = $props();

  type Kind = 'saddle' | 'bars' | 'crank';
  const handles = $derived<{ kind: Kind; id: LinkId; at: Vec2; text: string }[]>([
    ...(editable ? [
      { kind: 'saddle' as const, id: 'saddleHeight' as LinkId, at: layout.saddle, text: 'Drag to move the saddle' },
      { kind: 'bars' as const, id: 'stem' as LinkId, at: layout.clamp, text: 'Drag to move the bars' },
    ] : []),
    { kind: 'crank' as const, id: 'crank' as LinkId, at: pose.spindle, text: 'Drag to turn the cranks' },
  ]);

  let hot = $state<Kind | null>(null);
  let drag: { kind: Kind; from: Vec2; screen: Vec2; start: FitParams; moved: boolean } | null = null;

  /** The pointer in drawing coordinates (mm, y up): the circle's own screen matrix already includes the flip. */
  function model(e: PointerEvent): Vec2 {
    const m = (e.currentTarget as SVGGraphicsElement).getScreenCTM()!.inverse();
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: q.x, y: q.y };
  }
  const edited = () => $state.snapshot(ui.editing === 'current' ? app.baseline : app.current) as FitParams;

  function down(e: PointerEvent, h: { kind: Kind }) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { kind: h.kind, from: model(e), screen: { x: e.clientX, y: e.clientY }, start: edited(), moved: false };
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.screen.x, e.clientY - drag.screen.y) < 4) return;
      drag.moved = true;
      ui.dragging = drag.kind;
      ui.pin = null;
    }
    const q = model(e);
    if (drag.kind === 'crank') {
      ui.playing = false;
      ui.manualCrank = crankAngle(q);
      return;
    }
    const d = { x: q.x - drag.from.x, y: q.y - drag.from.y };
    const patch: Partial<FitParams> = drag.kind === 'saddle'
      ? saddleDrag(drag.start, d, frame, components, options)
      : barsDrag(drag.start, d, frame, options);
    const live = edited();
    // The same hard stops as the sliders: a target never goes where the body cannot ride it.
    if (ui.editing === 'target' && whyImpossible({ ...live, ...patch })) return;
    for (const k of Object.keys(patch) as ParamKey[]) if (patch[k] !== live[k]) setKnob(k, patch[k]!);
  }

  function up(e: PointerEvent, h: { kind: Kind; id: LinkId }) {
    const d = drag;
    drag = null;
    ui.dragging = null;
    if (!d) return;
    if (d.moved) event('Dragged', { part: d.kind });
    else if (e.type === 'pointerup') {
      togglePin(h.id);
      if (ui.pin === h.id) reveal(h.id);
    }
  }

  function enter(e: PointerEvent, h: { kind: Kind; id: LinkId }) {
    if (e.pointerType === 'touch') return;
    hot = h.kind;
    ui.hover = h.id;
  }
  function leave(h: { id: LinkId }) {
    hot = null;
    if (ui.hover === h.id) ui.hover = null;
  }
</script>

{#each handles as h (h.kind)}
  {#if hot === h.kind || ui.dragging === h.kind}
    <circle cx={h.at.x} cy={h.at.y} r="34" stroke="var(--accent)" stroke-width="5" stroke-dasharray="10 8" fill="none" pointer-events="none" />
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <circle
    cx={h.at.x} cy={h.at.y} r="45" fill="transparent" pointer-events="all"
    style="cursor:{ui.dragging === h.kind ? 'grabbing' : 'grab'}; touch-action:none"
    onpointerdown={(e) => down(e, h)} onpointermove={move}
    onpointerup={(e) => up(e, h)} onpointercancel={(e) => up(e, h)}
    onpointerenter={(e) => enter(e, h)} onpointerleave={() => leave(h)} onclick={(e) => e.stopPropagation()}
  ><title>{h.text}</title></circle>
{/each}
