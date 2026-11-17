<script lang="ts">
  import { buildSummary, type CompareRow, type Verdict } from '../model/optimize';
  import { groupRows, type ModelGroup } from '../lib/sizes';
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
  const VERDICT_TEXT = { fits: 'fits', compromise: 'fits with compromises', no: 'does not fit' } as const;
  const models = $derived(groupRows(ui.compareRows ?? [], app.frames));
  const groups = $derived(
    GROUPS.map((g) => ({ ...g, models: models.filter((m) => m.best.result.verdict === g.id) }))
      .filter((g) => g.models.length > 0),
  );
  let shown = $state<Record<string, string>>({});
  $effect(() => {
    ui.compareRows;
    shown = {};
  });
  const rowOf = (g: ModelGroup) => g.sizes.find((s) => s.row.frameId === shown[g.key])?.row ?? g.best;
  const sizeOf = (g: ModelGroup, row: CompareRow) => g.sizes.find((s) => s.row === row)?.size ?? '';

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
    Sizes of the same model share a card, led by the one that fits best.
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
        {#each g.models as m (m.key)}
          {@const row = rowOf(m)}
          {@const notes = remarks(row)}
          {@const chip = GROUPS.find((x) => x.id === row.result.verdict)!}
          <div class="card">
            <div class="top">
              <span class="fname">{m.name}</span>
              <span class="chip {chip.id}">{chip.chip}</span>
            </div>
            {#if m.sizes.length > 1}
              <div class="sizes" role="group" aria-label="Sizes of {m.name}">
                {#each m.sizes as s (s.row.frameId)}
                  <button
                    type="button" class="sz {s.row.result.verdict}" class:on={s.row === row}
                    aria-pressed={s.row === row} aria-label="Size {s.size}: {VERDICT_TEXT[s.row.result.verdict]}"
                    title={VERDICT_TEXT[s.row.result.verdict]} onclick={() => (shown[m.key] = s.row.frameId)}
                  >{s.size}</button>
                {/each}
              </div>
            {/if}
            <div class="small">{buildSummary(row.result.params, withCleats)}</div>
            <div class="small muted">{facts(row)}</div>
            {#if notes.length}
              {#each notes as n}<div class="small muted">{n}</div>{/each}
            {:else}
              <div class="small okc">Fits within every target</div>
            {/if}
            <button type="button" class="btn small" onclick={() => useCompareRow(row)}>
              {m.sizes.length > 1 ? `Use size ${sizeOf(m, row)}` : 'Use this frame'}
            </button>
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
  .sizes { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .sz { min-width: 44px; min-height: 36px; border-radius: 10px; border: 2px solid transparent; font-weight: 700; background: var(--surface-2); }
  .sz.fits { color: var(--ok); }
  .sz.compromise { color: var(--near); }
  .sz.no { color: var(--off); }
  .sz.on { border-color: currentColor; background: var(--surface); }
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
