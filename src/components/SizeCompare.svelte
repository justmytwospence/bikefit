<script lang="ts">
  import { compareSizes } from '../lib/sizeCompare';
  import type { SizeEntry } from '../lib/sizes';
  import { peek } from '../lib/peek.svelte';
  import type { Peek } from '../state.svelte';
  import SizeMap from './SizeMap.svelte';

  /** The two sizes a rider sits between, side by side: where each puts the bars and what else differs. */
  let { pair, entries, activeId = null, onpick, peekOf }: {
    /** Smaller size first. */
    pair: [SizeEntry, SizeEntry];
    /** Every size of the model, for the map. */
    entries: SizeEntry[];
    activeId?: string | null;
    onpick: (e: SizeEntry) => void;
    /** What pointing at a size shows on the drawing. */
    peekOf: (e: SizeEntry) => Peek;
  } = $props();

  const cmp = $derived(compareSizes(pair[0], pair[1]));
</script>

<div class="between">
  <p class="head">Between sizes {cmp.sizes[0]} and {cmp.sizes[1]}</p>
  <p class="muted small">Both put you in the same position. Tap one to see it; the other stays on the drawing in outline.</p>
  <SizeMap {entries} {activeId} {onpick} {peekOf} />
  <table>
    <thead>
      <tr>
        <th></th>
        {#each pair as e (e.frame.id)}
          <th>
            <button type="button" class="pick" class:on={e.frame.id === activeId} aria-pressed={e.frame.id === activeId} onclick={() => onpick(e)} use:peek={() => peekOf(e)}>
              {e.size} <span class="pts">{e.row.result.score}</span>
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each cmp.lines as l (l.label)}
        <tr>
          <th scope="row">{l.label}</th>
          <td class:win={l.better === 0}>{l.values[0]}</td>
          <td class:win={l.better === 1}>{l.values[1]}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="small gist">{cmp.gist[0]}</p>
  <p class="small gist">{cmp.gist[1]}</p>
</div>

<style>
  .between { margin: 4px 0 10px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; }
  .head { margin: 0 0 2px; font-weight: 700; }
  p { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th, td { padding: 5px 4px; text-align: right; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
  thead th { border-top: 0; padding-bottom: 6px; }
  th[scope='row'] { text-align: left; font-weight: 400; color: var(--muted); }
  td.win { color: var(--ok); font-weight: 600; }
  .pick { min-height: 34px; padding: 0 10px; border-radius: 10px; border: 2px solid transparent; background: var(--surface-2); font-weight: 700; color: var(--ok); }
  .pick.on { border-color: currentColor; background: var(--surface); }
  .pts { font-weight: 600; color: var(--muted); margin-left: 4px; }
  .gist { margin-top: 8px; }
  .gist + .gist { margin-top: 4px; }
</style>
