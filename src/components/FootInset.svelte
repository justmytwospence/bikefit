<script lang="ts">
  import { dimension, shoeLocal } from './../draw/shapes';
  import type { Segments } from '../model/types';
  import Shoe from './draw/Shoe.svelte';

  let { seg, footStack, cleatOffset }: { seg: Segments; footStack: number; cleatOffset: number } = $props();

  const L = $derived(shoeLocal(seg, footStack, cleatOffset));
  const vb = $derived({
    x: L.heel - 20,
    y: -(seg.ankleHeight + 40),
    w: L.toe + 200 - (L.heel - 20),
    h: seg.ankleHeight + 40 + footStack + 90,
  });
  const cleatDim = $derived(dimension({ x: 0, y: -footStack - 25 }, { x: -cleatOffset, y: -footStack - 25 }, 0));
  const stackDim = $derived(dimension({ x: L.toe + 30, y: 0 }, { x: L.toe + 30, y: -footStack }, 0));
  const seg2 = (a: { x: number; y: number }, b: { x: number; y: number }) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const FS = 22;
</script>

<div class="inset">
  <div class="title">Cleat and pedal</div>
  <svg viewBox="{vb.x} {vb.y} {vb.w} {vb.h}" aria-label="Close-up of the shoe, cleat and pedal">
    <g transform="scale(1,-1)" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <Shoe ball={{ x: 0, y: 0 }} soleDeg={0} {seg} {footStack} {cleatOffset} variant="near" showBallMark highlight />
      <circle cx={-seg.footBack} cy={seg.ankleHeight} r="6" fill="var(--accent)" stroke="none" />
      <g stroke="var(--accent)">
        {#if cleatOffset > 0}<path d={seg2(cleatDim.a, cleatDim.b)} stroke-width="4" />{/if}
        {#each cleatDim.ticks as t}<path d={seg2(t[0], t[1])} stroke-width="4" />{/each}
        <path d={seg2(stackDim.a, stackDim.b)} stroke-width="4" />
        {#each stackDim.ticks as t}<path d={seg2(t[0], t[1])} stroke-width="4" />{/each}
      </g>
      <g font-size={FS} font-weight="700" fill="var(--accent)" stroke="none">
        <text transform="translate({cleatDim.mid.x},{cleatDim.mid.y}) scale(1,-1)" text-anchor="middle">
          {cleatOffset > 0 ? `${cleatOffset} mm behind ball` : 'at the ball'}
        </text>
        <text transform="translate({stackDim.mid.x},{stackDim.mid.y}) scale(1,-1)" dominant-baseline="central">
          stack {footStack} mm
        </text>
      </g>
    </g>
  </svg>
</div>

<style>
  .inset { position: absolute; right: 12px; bottom: 12px; width: 240px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 8px; pointer-events: none; }
  .title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
  svg { width: 100%; display: block; }
</style>
