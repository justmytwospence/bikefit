<script lang="ts">
  import type { Verdict } from '../model/optimize';
  import { groupRows } from '../lib/sizes';
  import { STYLES } from '../model/styles';
  import { app, compareKey, runCompareAll, ui, useCompareRow } from '../state.svelte';
  import CatalogBrowser from './CatalogBrowser.svelte';
  import FrameCard from './FrameCard.svelte';
  import Segmented from './Segmented.svelte';

  const stale = $derived(!!ui.compareRows && ui.compareKey !== compareKey());
  const withCleats = $derived(app.detail.results >= 2);
  const GROUPS: { id: Verdict; title: string }[] = [
    { id: 'fits', title: 'Fits' },
    { id: 'compromise', title: 'Fits with compromises' },
    { id: 'no', title: 'Does not fit' },
  ];
  const sources = [
    { value: 'saved' as const, label: 'Saved' },
    { value: 'all' as const, label: 'All bikes' },
  ];
  const models = $derived(groupRows(ui.compareRows ?? [], app.frames));
  const groups = $derived(
    GROUPS.map((g) => ({ ...g, models: models.filter((m) => m.best.result.verdict === g.id) }))
      .filter((g) => g.models.length > 0),
  );
</script>

<div class="scroll">
  <label class="fitfor">
    <span>Fitting for</span>
    <select aria-label="Riding style" bind:value={app.styleId}>
      {#each Object.values(STYLES) as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
    </select>
  </label>
  <div class="source"><Segmented options={sources} bind:value={ui.compareSource} ariaLabel="Frames to compare" /></div>

  {#if ui.compareSource === 'all'}
    <CatalogBrowser />
  {:else}
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
            <FrameCard group={m} {withCleats} onuse={useCompareRow} />
          {/each}
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .fitfor { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-weight: 600; margin-bottom: 12px; }
  .fitfor select { flex: 0 1 200px; }
  .source { margin-bottom: 12px; }
  .full { width: 100%; }
  .list { margin-top: 16px; }
  .dim { opacity: 0.5; }
  .stale { color: var(--muted); background: var(--surface-2); padding: 8px 12px; border-radius: 10px; margin-top: 12px; }
  .err { color: var(--off); }
</style>
