<script lang="ts">
  import { buildSummary, type CompareRow, type Verdict } from '../model/optimize';
  import { STYLES } from '../model/styles';
  import { app, compareKey, runCompareAll, ui, useCompareRow } from '../state.svelte';

  const stale = $derived(!!ui.compareRows && ui.compareKey !== compareKey());
  const OK = 'Every angle is inside its target range.';
  const withCleats = $derived(app.detail.results >= 2);
  const GROUPS: { id: Verdict; title: string; chip: string }[] = [
    { id: 'fits', title: 'Fits', chip: 'Fits' },
    { id: 'compromise', title: 'Fits with compromises', chip: 'Compromise' },
    { id: 'no', title: 'Does not fit', chip: 'No fit' },
  ];
  const groups = $derived(
    GROUPS.map((g) => ({ ...g, rows: (ui.compareRows ?? []).filter((r) => r.result.verdict === g.id) }))
      .filter((g) => g.rows.length > 0),
  );

  function facts(row: CompareRow): string {
    const f = row.result.facts;
    const drop = Math.round(f.barDrop);
    const parts = [
      drop < 0 ? `Bars ${-drop} mm above the saddle` : `Bars ${drop} mm below the saddle`,
      f.standover < 0 ? 'no standover clearance' : `standover about ${Math.round(f.standover)} mm`,
    ];
    if (f.toeClearance < 0) parts.push(`toe overlap ${Math.round(-f.toeClearance)} mm`);
    return parts.join(' · ');
  }
  const remarks = (row: CompareRow) =>
    [...row.result.flags, ...row.result.notes.filter((n) => n !== OK)].slice(0, 3);
</script>

<div class="scroll">
  <label class="fitfor">
    <span>Fitting for</span>
    <select aria-label="Riding style" bind:value={app.styleId}>
      {#each Object.values(STYLES) as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
    </select>
  </label>
  <p class="muted">
    Sorts your saved frames by whether they can be set up for your body and this style.
    Within a group, the build closest to a standard one comes first. Standover is estimated from stack and seat tube length.
  </p>
  <button type="button" class="btn primary full" disabled={ui.busy} onclick={runCompareAll}>
    {#if ui.busy}<span class="spin"></span>Comparing…{:else}Compare {app.frames.length} frames{/if}
  </button>
  {#if ui.error}<p class="err">{ui.error}</p>{/if}
  {#if stale}<p class="stale">Out of date, compare again.</p>{/if}

  {#if ui.compareRows}
    <div class="list" class:dim={stale}>
      {#each groups as g (g.id)}
        <h2>{g.title}</h2>
        {#each g.rows as row (row.frameId)}
          {@const notes = remarks(row)}
          <div class="card">
            <div class="top">
              <span class="fname">{row.frameName}</span>
              <span class="chip {g.id}">{g.chip}</span>
            </div>
            <div class="small">{buildSummary(row.result.params, withCleats)}</div>
            <div class="small muted">{facts(row)}</div>
            {#if notes.length}
              {#each notes as n}<div class="small muted">{n}</div>{/each}
            {:else}
              <div class="small okc">Fits within every target</div>
            {/if}
            <button type="button" class="btn small" onclick={() => useCompareRow(row)}>Use this frame</button>
          </div>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .fitfor { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-weight: 600; margin-bottom: 12px; }
  .fitfor select { flex: 0 1 200px; }
  .full { width: 100%; }
  .list { margin-top: 16px; }
  .dim { opacity: 0.5; }
  .top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .fname { flex: 1; font-weight: 600; }
  .chip { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .chip.fits { color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent); }
  .chip.compromise { color: var(--near); background: color-mix(in srgb, var(--near) 16%, transparent); }
  .chip.no { color: var(--off); background: color-mix(in srgb, var(--off) 14%, transparent); }
  .okc { color: var(--ok); font-weight: 600; }
  .card .btn { margin-top: 10px; }
  .stale { color: var(--muted); background: var(--surface-2); padding: 8px 12px; border-radius: 10px; margin-top: 12px; }
  .err { color: var(--off); }
</style>
