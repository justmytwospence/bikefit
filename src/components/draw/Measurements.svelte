<script lang="ts">
  import type { Overlay } from '../../draw/overlay';
  import type { Vec2 } from '../../model/vec';

  /** Draws what a linked number measures, with its name and value. */
  let { o, fs, vb }: { o: Overlay | null; fs: number; vb: { x: number; w: number } } = $props();

  const seg = (a: Vec2, b: Vec2) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const line = (pts: Vec2[]) => 'M ' + pts.map((q) => `${q.x} ${q.y}`).join(' L ');
  const labelX = $derived.by(() => {
    if (!o) return 0;
    const w = o.label.length * 0.56 * fs;
    return Math.min(vb.x + vb.w - w / 2 - 10, Math.max(vb.x + w / 2 + 10, o.at.x));
  });
</script>

{#if o}
  <g stroke="var(--accent)" fill="none">
    {#each o.strong as s}<path d={line(s)} stroke-width="16" opacity="0.9" />{/each}
    {#each o.dims as d}
      <path d={seg(d.a, d.b)} stroke-width="5" />
      {#each d.ticks as t}<path d={seg(t[0], t[1])} stroke-width="5" />{/each}
      {#each d.ext as e}<path d={seg(e[0], e[1])} stroke-width="3" stroke-dasharray="8 6" />{/each}
    {/each}
    {#each o.guides as g}<path d={seg(g[0], g[1])} stroke-width="4" stroke-dasharray="10 8" />{/each}
    {#each o.arcs as a}<path d={a} stroke-width="8" />{/each}
    {#each o.rings as r}<circle cx={r.c.x} cy={r.c.y} r={r.r} stroke-width="7" />{/each}
  </g>
  <text
    transform="translate({labelX},{o.at.y}) scale(1,-1)" text-anchor="middle" dominant-baseline="central"
    font-size={fs} font-weight="700" fill="var(--accent)"
    style="paint-order:stroke; stroke:var(--bg); stroke-width:{fs * 0.35}px; stroke-linejoin:round"
  >{o.label}</text>
{/if}
