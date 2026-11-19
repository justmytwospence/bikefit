<script lang="ts">
  import { betweenSizes, sizeAdviceLine, sizeEntries, type Standing } from '../lib/sizes';
  import { buildSummary } from '../model/advice';
  import { STYLES } from '../model/styles';
  import { app, markAsMine, setHasSetup, ui, useSize } from '../state.svelte';
  import SizeCompare from './SizeCompare.svelte';
  import SizeMap from './SizeMap.svelte';

  let { changes, hasChanges }: { changes: string[]; hasChanges: boolean } = $props();

  const resultsLv = $derived(app.detail.results);
  const c = $derived(app.current);
  const STANDING_TEXT: Record<Standing, string> = {
    pick: 'best size', alt: 'fits as well', ok: 'can be made to work', far: 'too far off', no: 'does not fit',
  };
  const entries = $derived(ui.sizes ? sizeEntries(ui.sizes.rows, ui.sizes.options) : []);
  const pair = $derived(betweenSizes(entries));
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
    {#if entries.length}
      <h3>Sizes</h3>
      <div class="sizes" role="group" aria-label="Sizes">
        {#each entries as e (e.frame.id)}
          <button
            type="button" class="sz {e.standing}" class:on={e.frame.id === app.activeFrameId}
            aria-pressed={e.frame.id === app.activeFrameId} aria-label="Size {e.size}: {STANDING_TEXT[e.standing]}"
            title="{STANDING_TEXT[e.standing]} ({e.row.result.score})" onclick={() => useSize(e.frame.id)}
          >{e.size}</button>
        {/each}
      </div>
      <p class="small">{sizeAdviceLine(entries, app.activeFrameId)}</p>
      {#if pair}
        <SizeCompare {pair} {entries} activeId={app.activeFrameId} onpick={(e) => useSize(e.frame.id)} />
      {:else}
        <SizeMap {entries} activeId={app.activeFrameId} onpick={(e) => useSize(e.frame.id)} />
      {/if}
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
  .sz.pick { color: var(--accent-ink); background: var(--ok); }
  .sz.alt { color: var(--ok); }
  .sz.ok { color: var(--near); }
  .sz.far { color: var(--muted); opacity: 0.7; }
  .sz.no { color: var(--off); opacity: 0.6; }
  .sz.on { border-color: currentColor; background: var(--surface); }
  .sz.pick.on { color: var(--ok); }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 12px 0 6px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .row { display: flex; gap: 8px; margin-top: 12px; }
  .verdict { margin: 12px 0 0; font-weight: 600; }
  .verdict.ok { color: var(--ok); }
  .verdict.near { color: var(--near); }
  .verdict.off { color: var(--off); }
</style>
