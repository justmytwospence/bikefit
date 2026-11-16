<script lang="ts">
  import { level } from '../lib/appData';
  import { STYLES } from '../model/styles';
  import { app, compareKey, runCompareAll, ui, useCompareRow } from '../state.svelte';
  import ScoreRing from './ScoreRing.svelte';

  const stale = $derived(!!ui.compareRows && ui.compareKey !== compareKey());
  const OK = 'Every angle is inside its target range.';
  const build = (p: { stemLength: number; stemAngle: number; spacers: number; crankLength: number; seatpostSetback: number; cleatOffset: number }) =>
    `${p.stemLength} mm ${p.stemAngle < 0 ? '−' : p.stemAngle > 0 ? '+' : ''}${Math.abs(p.stemAngle)}° stem · ${p.spacers} mm spacers · ${p.crankLength} mm cranks · ${p.seatpostSetback === 0 ? 'inline post' : p.seatpostSetback + ' mm setback'}${level(app, 'setup') >= 2 ? ` · cleats ${p.cleatOffset} mm back` : ''}`;
</script>

<div class="scroll">
  <p class="muted">Ranks every saved frame for your body and the {STYLES[app.styleId].name} style, with the build each one needs.</p>
  <button type="button" class="btn primary full" disabled={ui.busy} onclick={runCompareAll}>
    {#if ui.busy}<span class="spin"></span>Comparing…{:else}Compare {app.frames.length} frames{/if}
  </button>
  {#if ui.error}<p class="err">{ui.error}</p>{/if}
  {#if stale}<p class="stale">Out of date, compare again.</p>{/if}

  {#if ui.compareRows}
    <div class="list" class:dim={stale}>
      {#each ui.compareRows as row, i (row.frameId)}
        {@const note = row.result.notes.find((n) => n !== OK)}
        <div class="card">
          <div class="top">
            <span class="rank">{i + 1}</span>
            <span class="fname">{row.frameName}</span>
            <ScoreRing score={row.result.score} />
          </div>
          <div class="small">{build(row.result.params)}</div>
          <div class="small" class:okc={!note} class:muted={!!note}>{note ?? 'Fits within every target'}</div>
          <button type="button" class="btn small" onclick={() => useCompareRow(row)}>Use this frame</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .full { width: 100%; }
  .list { margin-top: 16px; }
  .dim { opacity: 0.5; }
  .top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .rank { width: 26px; height: 26px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; font-weight: 700; font-size: 13px; }
  .fname { flex: 1; font-weight: 600; }
  .okc { color: var(--ok); font-weight: 600; }
  .card .btn { margin-top: 10px; }
  .stale { color: var(--muted); background: var(--surface-2); padding: 8px 12px; border-radius: 10px; margin-top: 12px; }
  .err { color: var(--off); }
</style>
