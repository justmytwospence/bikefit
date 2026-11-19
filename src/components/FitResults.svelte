<script lang="ts">
  import { sizeVerdictLine } from '../lib/sizes';
  import { buildSummary } from '../model/advice';
  import { STYLES } from '../model/styles';
  import { app, markAsMine, setHasSetup, ui, useSize } from '../state.svelte';

  let { changes, hasChanges }: { changes: string[]; hasChanges: boolean } = $props();

  const resultsLv = $derived(app.detail.results);
  const c = $derived(app.current);
  const VERDICT_TEXT = { fits: 'fits', compromise: 'fits with compromises', no: 'does not fit' } as const;
</script>

{#snippet verdictLine()}
  {#if ui.verdict === 'fits'}<p class="verdict ok">Fits</p>
  {:else if ui.verdict === 'compromise'}<p class="verdict near">Fits with compromises{ui.flags.length ? ': ' + ui.flags.join('; ') : ''}</p>
  {:else if ui.verdict === 'no'}<p class="verdict off">Does not fit the {STYLES[app.styleId].name} style</p>{/if}
{/snippet}

{#if !app.hasSetup && ui.verdict}
  <div class="card changes">
    <h2>Suggested build</h2>
    <p>Saddle height {c.saddleHeight} mm</p>
    <p>{buildSummary(c, resultsLv >= 2)}</p>
    {@render verdictLine()}
    {#if ui.sizes}
      <h3>Sizes</h3>
      <div class="sizes" role="group" aria-label="Sizes">
        {#each ui.sizes.options as o (o.frame.id)}
          {@const r = ui.sizes.rows.find((x) => x.frameId === o.frame.id)!}
          <button
            type="button" class="sz {r.result.verdict}" class:on={o.frame.id === app.activeFrameId}
            aria-pressed={o.frame.id === app.activeFrameId} aria-label="Size {o.size}: {VERDICT_TEXT[r.result.verdict]}"
            title={VERDICT_TEXT[r.result.verdict]} onclick={() => useSize(o.frame.id)}
          >{o.size}</button>
        {/each}
      </div>
      <p class="small">{sizeVerdictLine(ui.sizes.rows, app.activeFrameId, (id) => ui.sizes!.options.find((o) => o.frame.id === id)!.size)}</p>
    {/if}
    {#if ui.notes && resultsLv >= 2}
      <h3>Why it stops here</h3>
      <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
    {/if}
    <div class="row">
      <button type="button" class="btn small" onclick={() => setHasSetup(true)}>Mark as my setup</button>
    </div>
  </div>
{:else if app.hasSetup && hasChanges}
  <div class="card changes">
    <h2>Changes from your setup</h2>
    <ul>{#each changes as line}<li>{line}</li>{/each}</ul>
    {#if ui.notes && resultsLv >= 2}
      <h3>Why it stops here</h3>
      <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
    {/if}
    {@render verdictLine()}
    <div class="row">
      <button type="button" class="btn small" onclick={markAsMine}>Mark as my setup</button>
    </div>
  </div>
{:else if ui.notes && resultsLv >= 2}
  <div class="card changes">
    <h3>Result</h3>
    <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
    {@render verdictLine()}
  </div>
{/if}

<style>
  .changes h2 { margin-top: 0; }
  .sizes { display: flex; flex-wrap: wrap; gap: 6px; }
  .sz { min-width: 44px; min-height: 36px; border-radius: 10px; border: 2px solid transparent; font-weight: 700; background: var(--surface-2); }
  .sz.fits { color: var(--ok); }
  .sz.compromise { color: var(--near); }
  .sz.no { color: var(--off); }
  .sz.on { border-color: currentColor; background: var(--surface); }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 12px 0 6px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .row { display: flex; gap: 8px; margin-top: 12px; }
  .verdict { margin: 12px 0 0; font-weight: 600; }
  .verdict.ok { color: var(--ok); }
  .verdict.near { color: var(--near); }
  .verdict.off { color: var(--off); }
</style>
