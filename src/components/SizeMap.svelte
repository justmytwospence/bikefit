<script lang="ts">
  import { peek } from '../lib/peek.svelte';
  import type { SizeEntry } from '../lib/sizes';
  import type { Peek } from '../state.svelte';

  /**
   * How high each size can put the bars with its stock stem, against the rider's own bar height: one bar per
   * size from no spacers to all of them, a dot where the riding style normally sits, and how much closer or
   * further the bars are at the rider's height.
   */
  let { entries, activeId = null, onpick, peekOf }: {
    entries: SizeEntry[];
    /** Frame id of the size on the drawing, if any. */
    activeId?: string | null;
    onpick?: (e: SizeEntry) => void;
    peekOf?: (e: SizeEntry) => Peek;
  } = $props();

  const SPAN = 60; // mm either side of the rider's bar height
  const X0 = 40;
  const X1 = 214;
  const ROW = 22;
  const TOP = 20;
  const x = (mm: number) => X0 + ((Math.max(-SPAN, Math.min(SPAN, mm)) + SPAN) / (2 * SPAN)) * (X1 - X0);

  const rows = $derived(
    entries.flatMap((e) => {
      const r = e.row.result.facts.stockRange;
      if (!r || r.high.y < -SPAN || r.low.y > SPAN) return [];
      const rise = r.high.y - r.low.y;
      // Reach of this size's bars at the rider's own bar height, relative to the rider's.
      const reach = r.low.x + (rise === 0 ? 0 : (-r.low.y / rise) * (r.high.x - r.low.x));
      const note = Math.abs(reach) < 5 ? 'same reach' : `${Math.round(Math.abs(reach))} mm ${reach > 0 ? 'further' : 'closer'}`;
      return [{ e, low: r.low.y, high: r.high.y, dot: r.low.y + r.share * rise, note }];
    }),
  );
  const height = $derived(TOP + rows.length * ROW + 6);
</script>

{#if rows.length}
  <figure class="map">
    <svg viewBox="0 0 300 {height}" role="img" aria-label="How high each size can put the bars, against your bar height">
      <text class="hint" x={X0} y="11">lower</text>
      <text class="hint" x={X1} y="11" text-anchor="end">higher</text>
      <text class="you" x={x(0)} y="11" text-anchor="middle">you</text>
      <line class="youline" x1={x(0)} x2={x(0)} y1="15" y2={height - 4} />
      {#each rows as r, i (r.e.frame.id)}
        {@const y = TOP + i * ROW + ROW / 2}
        {@const on = r.e.frame.id === activeId}
        <g class="row {r.e.standing}" class:on>
          <text class="size" x="4" y={y + 4.5}>{r.e.size}</text>
          <line class="bar" x1={x(r.low)} x2={x(r.high)} y1={y} y2={y} />
          <circle cx={x(r.dot)} cy={y} r="3.4" />
          <text class="note" x={X1 + 8} y={y + 4}>{r.note}</text>
          {#if onpick}
            <rect
              class="hit" x="0" y={y - ROW / 2} width="300" height={ROW}
              role="button" tabindex="-1" aria-label="Show size {r.e.size}" onclick={() => onpick(r.e)}
              use:peek={() => peekOf?.(r.e) ?? null}
              onkeydown={(ev) => { if (ev.key === 'Enter') onpick(r.e); }}
            />
          {/if}
        </g>
      {/each}
    </svg>
  </figure>
{/if}

<style>
  .map { margin: 10px 0 0; }
  svg { display: block; width: 100%; height: auto; background: var(--surface-2); border-radius: 10px; }
  .hint { font-size: 9px; fill: var(--muted); }
  .you { font-size: 9.5px; font-weight: 700; fill: var(--accent); }
  .youline { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3 3; }
  .row { color: var(--muted); }
  .row.pick, .row.alt { color: var(--ok); }
  .row.ok { color: var(--near); }
  .row.far, .row.no { opacity: 0.45; }
  .size { font-size: 11px; font-weight: 700; fill: currentColor; }
  .bar { stroke: currentColor; stroke-width: 6; stroke-linecap: round; opacity: 0.55; }
  .row.on .bar { opacity: 1; stroke-width: 8; }
  circle { fill: var(--surface); stroke: currentColor; stroke-width: 2; }
  .note { font-size: 9.5px; fill: var(--muted); }
  .row.on .note, .row.on .size { fill: var(--ink); }
  .hit { fill: transparent; cursor: pointer; outline: none; }
</style>
