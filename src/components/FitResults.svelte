<script lang="ts">
  import { STYLES } from '../model/styles';
  import { app, markAsMine, ui } from '../state.svelte';

  let { changes, hasChanges }: { changes: string[]; hasChanges: boolean } = $props();

  const resultsLv = $derived(app.detail.results);
</script>

{#snippet verdictLine()}
  {#if ui.verdict === 'fits'}<p class="verdict ok">Fits</p>
  {:else if ui.verdict === 'compromise'}<p class="verdict near">Fits with compromises{ui.flags.length ? ': ' + ui.flags.join('; ') : ''}</p>
  {:else if ui.verdict === 'no'}<p class="verdict off">Does not fit the {STYLES[app.styleId].name} style</p>{/if}
{/snippet}

{#if hasChanges}
  <div class="card changes">
    <h2>Changes from your setup</h2>
    <ul>{#each changes as line}<li>{line}</li>{/each}</ul>
    {#if ui.notes && resultsLv >= 2}
      <h3>Why it stops here</h3>
      <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
    {/if}
    {@render verdictLine()}
    <div class="row-actions">
      <button type="button" class="btn small" onclick={markAsMine}>I've made these changes</button>
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
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 12px 0 6px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .row-actions { display: flex; gap: 8px; margin-top: 12px; }
  .verdict { margin: 12px 0 0; font-weight: 600; }
  .verdict.ok { color: var(--ok); }
  .verdict.near { color: var(--near); }
  .verdict.off { color: var(--off); }
</style>
