<script lang="ts">
  import { event } from '../lib/analytics';
  import { enterPeek, leavePeek } from '../lib/peek.svelte';
  import type { ModelGroup } from '../lib/sizes';
  import { chartPoints, idealFrame, inArea, type Area } from '../lib/stackReach';
  import { ui } from '../state.svelte';

  /**
   * Every model's best size at its frame reach and stack, coloured by verdict, with the frame that would put
   * your hands where they belong. Drag to select an area; the list below shows only those bikes.
   */
  let { groups, area = $bindable(null), onpick }: {
    groups: ModelGroup[];
    area?: Area | null;
    onpick: (g: ModelGroup) => void;
  } = $props();

  const W = 320;
  const H = 220;
  const L = 36;
  const R = 8;
  const T = 8;
  const B = 24;
  const OWNER = {};

  const points = $derived(chartPoints(groups));
  const ideal = $derived(idealFrame(groups));
  const groupOf = $derived(new Map(groups.map((g) => [g.key, g])));
  /** Which model each size belongs to, to highlight the one being shown. */
  const modelOfFrame = $derived(new Map(groups.flatMap((g) => g.sizes.map((s) => [s.row.frameId, g.key] as const))));
  const dom = $derived.by(() => {
    const rs = points.map((p) => p.reach);
    const ss = points.map((p) => p.stack);
    if (ideal) { rs.push(ideal.reach); ss.push(ideal.stack); }
    if (!rs.length) return { r0: 350, r1: 450, s0: 500, s1: 650 };
    return { r0: Math.min(...rs) - 10, r1: Math.max(...rs) + 10, s0: Math.min(...ss) - 10, s1: Math.max(...ss) + 10 };
  });
  const sx = (r: number) => L + ((r - dom.r0) / (dom.r1 - dom.r0)) * (W - L - R);
  const sy = (s: number) => T + (1 - (s - dom.s0) / (dom.s1 - dom.s0)) * (H - T - B);
  const dr = (x: number) => dom.r0 + ((x - L) / (W - L - R)) * (dom.r1 - dom.r0);
  const ds = (y: number) => dom.s0 + (1 - (y - T) / (H - T - B)) * (dom.s1 - dom.s0);
  const ticks = (a: number, b: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(a / step) * step; v <= b; v += step) out.push(v);
    return out;
  };
  const rTicks = $derived(ticks(dom.r0, dom.r1, 20));
  const sTicks = $derived(ticks(dom.s0, dom.s1, 40));
  const shownFrame = $derived(ui.peek?.kind === 'bike' ? ui.peek.row.frameId : ui.preview?.row.frameId ?? null);
  const shownKey = $derived(shownFrame ? modelOfFrame.get(shownFrame) ?? null : null);
  const lit = $derived(points.find((p) => p.key === shownKey) ?? null);
  const colour = { fits: 'var(--ok)', compromise: 'var(--near)', no: 'var(--off)' } as const;

  let brush = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  let down: { x: number; y: number } | null = null;

  function at(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x, y: q.y };
  }
  /** The model whose dot is nearest the point, if one is within 10 units. */
  function nearest(q: { x: number; y: number }) {
    let best: (typeof points)[number] | null = null;
    let bd = 10;
    for (const p of points) {
      if (area && !inArea(p, area)) continue;
      const d = Math.hypot(sx(p.reach) - q.x, sy(p.stack) - q.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function onDown(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    down = at(e);
    brush = null;
  }
  function onMove(e: PointerEvent) {
    const q = at(e);
    if (down) {
      if (Math.hypot(q.x - down.x, q.y - down.y) >= 4) brush = { x0: down.x, y0: down.y, x1: q.x, y1: q.y };
      return;
    }
    if (e.pointerType === 'touch') return;
    const p = nearest(q);
    if (p) enterPeek(OWNER, () => ({ kind: 'bike', row: p.entry.row, frame: p.entry.frame, other: null }));
    else leavePeek(OWNER);
  }
  function onUp(e: PointerEvent) {
    const q = at(e);
    const b = brush;
    down = null;
    brush = null;
    if (b && Math.abs(b.x1 - b.x0) >= 6 && Math.abs(b.y1 - b.y0) >= 6) {
      const next: Area = { reach: [dr(b.x0), dr(b.x1)], stack: [ds(b.y0), ds(b.y1)] };
      area = next;
      event('Chart brushed', { bikes: points.filter((p) => inArea(p, next)).length });
      return;
    }
    const p = nearest(q);
    if (p) onpick(groupOf.get(p.key)!);
    else area = null;
  }
</script>

<figure class="chart">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
  <svg
    viewBox="0 0 {W} {H}" role="img" aria-label="Frame reach and stack of each bike, with the frame that suits you"
    onpointerdown={onDown} onpointermove={onMove} onpointerup={onUp} onpointercancel={() => { down = null; brush = null; }}
    onpointerleave={() => leavePeek(OWNER)}
  >
    {#each rTicks as r (r)}
      <line class="grid" x1={sx(r)} x2={sx(r)} y1={T} y2={H - B} />
      <text class="tick" x={sx(r)} y={H - B + 10} text-anchor="middle">{r}</text>
    {/each}
    {#each sTicks as s (s)}
      <line class="grid" x1={L} x2={W - R} y1={sy(s)} y2={sy(s)} />
      <text class="tick" x={L - 4} y={sy(s) + 3} text-anchor="end">{s}</text>
    {/each}
    <text class="axis" x={(L + W - R) / 2} y={H - 3} text-anchor="middle">Reach (mm)</text>
    <text class="axis" transform="translate(9,{(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Stack (mm)</text>
    {#each points as p (p.key)}
      <circle
        cx={sx(p.reach)} cy={sy(p.stack)} r="3.2" fill={colour[p.verdict]}
        opacity={area && !inArea(p, area) ? 0.12 : p.verdict === 'no' ? 0.35 : 0.85}
      />
    {/each}
    {#if ideal}
      <g class="you">
        <ellipse cx={sx(ideal.reach)} cy={sy(ideal.stack)} rx={(20 / (dom.r1 - dom.r0)) * (W - L - R)} ry={(20 / (dom.s1 - dom.s0)) * (H - T - B)} fill="none" stroke-dasharray="4 3" />
        <path d="M {sx(ideal.reach) - 7} {sy(ideal.stack)} h 14 M {sx(ideal.reach)} {sy(ideal.stack) - 7} v 14" />
        <text x={sx(ideal.reach) + 9} y={sy(ideal.stack) - 8}>you</text>
      </g>
    {/if}
    {#if lit}<circle cx={sx(lit.reach)} cy={sy(lit.stack)} r="6" fill={colour[lit.verdict]} stroke="var(--ink)" stroke-width="2" />{/if}
    {#if brush}
      <rect class="brush" x={Math.min(brush.x0, brush.x1)} y={Math.min(brush.y0, brush.y1)} width={Math.abs(brush.x1 - brush.x0)} height={Math.abs(brush.y1 - brush.y0)} />
    {:else if area}
      <rect
        class="brush" x={Math.min(sx(area.reach[0]), sx(area.reach[1]))} y={Math.min(sy(area.stack[0]), sy(area.stack[1]))}
        width={Math.abs(sx(area.reach[1]) - sx(area.reach[0]))} height={Math.abs(sy(area.stack[1]) - sy(area.stack[0]))}
      />
    {/if}
  </svg>
  <figcaption class="muted small">
    Each dot is a bike's best size for you. The cross is the stack and reach that would put your hands where they
    belong with a stock stem and spacers. Drag to select an area; the list shows only those bikes. Tap a dot to show it.
  </figcaption>
</figure>

<style>
  .chart { margin: 8px 0 0; }
  svg { display: block; width: 100%; height: auto; background: var(--surface-2); border-radius: 10px; touch-action: none; cursor: crosshair; user-select: none; }
  .grid { stroke: var(--line); stroke-width: 0.5; }
  .tick { font-size: 8.5px; fill: var(--muted); }
  .axis { font-size: 9.5px; fill: var(--muted); }
  .you { stroke: var(--accent); stroke-width: 1.5; fill: var(--accent); pointer-events: none; }
  .you text { font-size: 9.5px; font-weight: 700; stroke: none; }
  .brush { fill: color-mix(in srgb, var(--accent) 12%, transparent); stroke: var(--accent); stroke-width: 1; pointer-events: none; }
  figcaption { margin-top: 6px; }
</style>
