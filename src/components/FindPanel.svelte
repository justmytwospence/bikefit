<script lang="ts">
  import Info from './Info.svelte';
  import type { Verdict } from '../model/verdict';
  import { groupRows } from '../lib/sizes';
  import { compareKey, makePreviewMine, previewRow, previewSize, runCompareAll, stopPreview } from '../find.svelte';
  import { app, ui } from '../state.svelte';
  import CatalogBrowser from './CatalogBrowser.svelte';
  import FrameCard from './FrameCard.svelte';
  import QuestionBar from './QuestionBar.svelte';

  const stale = $derived(!!ui.compareRows && ui.compareKey !== compareKey());
  const withCleats = $derived(app.detail.results >= 2);
  const GROUPS: { id: Verdict; title: string }[] = [
    { id: 'fits', title: 'Fits' },
    { id: 'compromise', title: 'Fits with compromises' },
    { id: 'no', title: 'Does not fit' },
  ];
  const VERDICT_TEXT = { fits: 'Fits', compromise: 'Fits with compromises', no: 'Does not fit' } as const;
  const sources = [
    { value: 'all' as const, label: 'All bikes' },
    { value: 'saved' as const, label: 'Saved' },
  ];
  const models = $derived(groupRows(ui.compareRows ?? [], app.frames));
  const groups = $derived(
    GROUPS.map((g) => ({ ...g, models: models.filter((m) => m.best.result.verdict === g.id) }))
      .filter((g) => g.models.length > 0),
  );
</script>

<QuestionBar label="Bikes" ariaLabel="Bikes to check" options={sources} bind:value={ui.compareSource} />
<div class="scroll">

  {#if ui.compareSource === 'all'}
    <CatalogBrowser />
  {:else}
    <button type="button" class="btn primary full" disabled={ui.busy} onclick={runCompareAll}>
      {#if ui.busy}<span class="spin"></span>Comparing…{:else if stale}Out of date: compare again{:else}Compare {app.frames.length} frames{/if}
    </button>
    {#if ui.error}<p class="err">{ui.error}</p>{/if}

    {#if ui.compareRows}
      <div class="list" class:dim={stale}>
        {#each groups as g (g.id)}
          <h2>{g.title}</h2>
          {#each g.models as m (m.key)}
            <FrameCard
              group={m} {withCleats} showing={ui.preview?.row.frameId ?? null}
              onshow={previewSize}
              onuse={(r) => { previewRow(r, app.frames); makePreviewMine(); }}
            />
          {/each}
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- A fixed bar, so showing a bike never moves the list you tapped it in. -->
<div class="showbar">
  {#if ui.preview}
    {@const v = ui.preview.row.result.verdict}
    <div class="info">
      <b class="nm">{ui.preview.row.frameName}</b>
      <span class="small verdict {v}">{VERDICT_TEXT[v]}</span>
    </div>
    <button type="button" class="btn small primary" onclick={makePreviewMine}>Make it my bike</button>
    <button type="button" class="btn small x" aria-label="Stop showing" onclick={stopPreview}>✕</button>
  {:else}
    <span class="muted small">No bike shown</span>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .showbar {
    display: flex; align-items: center; gap: 8px; min-height: 64px;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line); background: var(--surface);
  }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .x { width: 40px; padding: 0; }
  .verdict { font-weight: 600; }
  .verdict.fits { color: var(--ok); }
  .verdict.compromise { color: var(--near); }
  .verdict.no { color: var(--off); }
  .full { width: 100%; }
  .list { margin-top: 16px; }
  .dim { opacity: 0.5; }
  .err { color: var(--off); }
</style>
