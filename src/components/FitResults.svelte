<script lang="ts">
  import { PRESETS } from '../lib/knobs';
  import { sameParams } from '../lib/ladder';
  import { wrenchList } from '../model/advice';
  import { STYLES } from '../model/styles';
  import type { FitParams } from '../model/types';
  import { app, ladderKey, markAsMine, ui, useStep } from '../state.svelte';

  let { changes, hasChanges }: { changes: string[]; hasChanges: boolean } = $props();

  const resultsLv = $derived(app.detail.results);
  const snap = <T,>(x: T) => $state.snapshot(x) as T;
  const ladder = $derived(ui.ladder && ui.ladder.key === ladderKey() ? ui.ladder : null);
  /** -1 is the current setup, -2 a target that matches no row (edited by hand). */
  const chosen = $derived.by(() => {
    if (!ladder) return -2;
    const cur = snap(app.current) as FitParams;
    if (sameParams(cur, snap(app.baseline) as FitParams)) return -1;
    return ladder.steps.findIndex((s) => sameParams(s.params, cur));
  });
  const label = (i: number) => PRESETS[i].label;
  const count = (p: FitParams) => wrenchList(snap(app.baseline) as FitParams, p).filter((l) => l !== 'No changes from your current setup.').length;
  const sub = (i: number) => {
    const s = ladder!.steps[i];
    const n = count(s.params);
    const text = s.same ? 'Same as ' + label(i - 1) : n === 0 ? 'No changes' : n + (n === 1 ? ' change' : ' changes');
    return i === ladder!.suggested ? text + ' · suggested' : text;
  };
  const tone = (score: number) => (score >= 85 ? 'ok' : score >= 60 ? 'near' : 'off');
</script>

{#snippet verdictLine()}
  {#if ui.verdict === 'fits'}<p class="verdict ok">Fits</p>
  {:else if ui.verdict === 'compromise'}<p class="verdict near">Fits with compromises{ui.flags.length ? ': ' + ui.flags.join('; ') : ''}</p>
  {:else if ui.verdict === 'no'}<p class="verdict off">Does not fit the {STYLES[app.styleId].name} style</p>{/if}
{/snippet}

{#if ladder}
  <div class="card changes">
    <h2>Targets</h2>
    <div class="rows" role="radiogroup" aria-label="Targets">
      <button type="button" role="radio" aria-checked={chosen === -1} class="row" class:on={chosen === -1} onclick={() => useStep(-1)}>
        <span class="txt"><b>Current setup</b><span class="muted small">As it is</span></span>
        <span class="score {tone(ladder.current)}">{ladder.current}</span>
      </button>
      {#each ladder.steps as s, i (s.step)}
        <button type="button" role="radio" aria-checked={chosen === i} class="row" class:on={chosen === i} onclick={() => useStep(i)}>
          <span class="txt"><b>{label(i)}</b><span class="muted small">{sub(i)}</span></span>
          <span class="score {tone(s.score)}">{s.score}</span>
        </button>
      {/each}
    </div>
    {#if chosen >= 0}<p class="muted small hint">{PRESETS[chosen].hint}</p>{/if}
  </div>
{/if}

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
  .rows { display: flex; flex-direction: column; gap: 6px; }
  .row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 44px;
    padding: 6px 12px; text-align: left; border-radius: 10px; border: 2px solid transparent; background: var(--surface-2);
  }
  .row.on { border-color: var(--accent); background: var(--surface); }
  .txt { display: flex; flex-direction: column; }
  .score { font-weight: 700; font-size: 18px; }
  .score.ok { color: var(--ok); }
  .score.near { color: var(--near); }
  .score.off { color: var(--off); }
  .hint { margin: 8px 0 0; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 12px 0 6px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .row-actions { display: flex; gap: 8px; margin-top: 12px; }
  .verdict { margin: 12px 0 0; font-weight: 600; }
  .verdict.ok { color: var(--ok); }
  .verdict.near { color: var(--near); }
  .verdict.off { color: var(--off); }
</style>
