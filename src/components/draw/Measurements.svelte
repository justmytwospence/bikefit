<script lang="ts">
  import { dimension } from '../../draw/shapes';
  import type { MeasureId } from '../../lib/measure';
  import { steerAxis } from '../../model/geometry';
  import type { RiderPose } from '../../model/pose';
  import type { Components, FitParams, Frame, Layout } from '../../model/types';
  import { add, scale as vscale, type Vec2 } from '../../model/vec';

  let { id, layout, frame, components, params, pose, fs }: {
    id: MeasureId | null;
    layout: Layout;
    frame: Frame;
    components: Components;
    params: FitParams;
    pose: RiderPose;
    fs: number;
  } = $props();

  const h = $derived(steerAxis(frame));
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const signed = (a: number) => (a === 0 ? '0°' : (a < 0 ? '−' : '+') + fmt(Math.abs(a)) + '°');

  const dim = $derived.by(() => {
    if (id === 'saddleHeight')
      return { d: dimension({ x: 0, y: 0 }, layout.seatAxisTop, 90), label: `${fmt(params.saddleHeight)} mm` };
    if (id === 'spacers' && params.spacers > 0) {
      const top = add(layout.headTop, vscale(h, params.spacers));
      return { d: dimension(layout.headTop, top, -60), label: `${fmt(params.spacers)} mm` };
    }
    if (id === 'stem')
      return { d: dimension(layout.stemBase, layout.clamp, 50), label: `${fmt(params.stemLength)} mm ${signed(params.stemAngle)}` };
    if (id === 'crank')
      return { d: dimension({ x: 0, y: 0 }, pose.spindle, 40), label: `${fmt(params.crankLength)} mm` };
    if (id === 'setback')
      return {
        d: dimension({ x: layout.nose.x, y: 160 }, { x: 0, y: 160 }, 0),
        label: `${Math.round(-layout.nose.x)} mm`,
      };
    return null;
  });
  const seg = (a: Vec2, b: Vec2) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
</script>

{#if dim}
  <g stroke="var(--accent)" fill="none">
    <path d={seg(dim.d.a, dim.d.b)} stroke-width="5" />
    {#each dim.d.ticks as t}<path d={seg(t[0], t[1])} stroke-width="5" />{/each}
    {#each dim.d.ext as e}<path d={seg(e[0], e[1])} stroke-width="3" stroke-dasharray="8 6" />{/each}
    {#if id === 'setback'}
      <path d={seg(layout.nose, { x: layout.nose.x, y: 160 })} stroke-width="4" stroke-dasharray="10 8" />
      <path d={seg({ x: 0, y: 0 }, { x: 0, y: 180 })} stroke-width="4" stroke-dasharray="10 8" />
    {/if}
  </g>
  <text
    transform="translate({dim.d.mid.x},{dim.d.mid.y}) scale(1,-1)" text-anchor="middle" dominant-baseline="central"
    font-size={fs} font-weight="700" fill="var(--accent)"
    style="paint-order:stroke; stroke:var(--bg); stroke-width:{fs * 0.35}px; stroke-linejoin:round"
  >{dim.label}</text>
{/if}
