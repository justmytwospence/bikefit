<script lang="ts">
  import { footFrame, polyPath, shoeLocal, smoothClosedPath, toWorld } from '../../draw/shapes';
  import type { Segments } from '../../model/types';
  import { add, scale, type Vec2 } from '../../model/vec';

  let {
    ball, soleDeg, seg, footStack, cleatOffset, variant = 'near', showBallMark = false, highlight = false,
  }: {
    ball: Vec2;
    soleDeg: number;
    seg: Segments;
    footStack: number;
    cleatOffset: number;
    variant?: 'near' | 'far' | 'ghost';
    showBallMark?: boolean;
    highlight?: boolean;
  } = $props();

  const fr = $derived(footFrame(ball, soleDeg));
  const L = $derived(shoeLocal(seg, footStack, cleatOffset));
  const w = (pts: Vec2[]) => pts.map((q) => toWorld(fr, q));
  const ink = $derived(variant === 'far' ? 'var(--rider-far)' : 'var(--rider)');
  const fill = $derived(variant === 'near' ? 'var(--shoe)' : variant === 'far' ? 'var(--shoe-far)' : 'var(--rider)');
  const axle = $derived(toWorld(fr, L.spindle));
  const mark = $derived(toWorld(fr, L.ballMark));
</script>

{#if variant === 'ghost'}
  <path d={smoothClosedPath(w(L.outline))} fill={fill} opacity=".14" stroke="none" />
{:else}
  <path d={polyPath(w(L.pedal))} fill="var(--pedal)" stroke="none" />
  <path d={smoothClosedPath(w(L.outline))} {fill} stroke={ink} stroke-width="5" />
  <path d={polyPath(w(L.sole))} fill={ink} stroke="none" />
  <path
    d={polyPath(w(L.cleat))} fill={variant === 'far' ? 'var(--rider-far)' : 'var(--accent)'}
    stroke={highlight ? 'var(--accent)' : 'none'} stroke-width="6" stroke-opacity=".35"
  />
  <circle cx={axle.x} cy={axle.y} r="7" fill="var(--muted)" stroke="none" />
  {#if showBallMark}
    {@const a = add(mark, scale(fr.n, -2))}
    {@const b = add(mark, scale(fr.n, 16))}
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" stroke-width="4" />
  {/if}
{/if}
