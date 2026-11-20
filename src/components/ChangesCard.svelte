<script lang="ts">
  import { PRESETS } from '../lib/knobs';
  import { sameParams } from '../lib/ladder';
  import { link } from '../lib/link.svelte';
  import type { SettingLink } from '../lib/linkIds';
  import { changeList, type Change } from '../model/advice';
  import type { Impossible } from '../model/limits';
  import { STYLES } from '../model/styles';
  import type { FitParams } from '../model/types';
  import {
    app, chooseRung, keepAsIs, ladderKey, markAsMine, setupScore, ui,
  } from '../state.svelte';
  import KnobField from './KnobField.svelte';

  /** What the chosen target asks you to do, one line per part, each adjustable or rejectable. */
  let { whyImpossible }: { whyImpossible: (p: FitParams) => Impossible | null } = $props();

  const snap = <T,>(x: T) => $state.snapshot(x) as T;
  const ladder = $derived(ui.ladder && ui.ladder.key === ladderKey() ? ui.ladder : null);
  const step = $derived(ui.rung !== null && ladder ? ladder.steps[ui.rung] : null);
  const base = $derived(snap(app.baseline) as FitParams);
  const target = $derived(snap(app.current) as FitParams);
  const changes = $derived(changeList(base, target));
  const from = $derived(setupScore(base));
  const to = $derived(setupScore(target));
  const edited = $derived(!!step && !sameParams(step.params, target));
  let open = $state<string | null>(null);

  const MEASURE: Record<Change['id'], SettingLink> = {
    saddle: 'saddleHeight', rails: 'setback', seatpost: 'setback', spacers: 'spacers', stem: 'stem', cranks: 'crank',
    cleats: 'cleat',
  };
  const tone = (s: number) => (s >= 85 ? 'ok' : s >= 60 ? 'near' : 'off');
</script>

{#snippet verdictLine()}
  {#if ui.verdict === 'fits'}<p class="verdict ok">Fits</p>
  {:else if ui.verdict === 'compromise'}<p class="verdict near">Fits with compromises{ui.flags.length ? ': ' + ui.flags.join('; ') : ''}</p>
  {:else if ui.verdict === 'no'}<p class="verdict off">Does not fit the {STYLES[app.styleId].name} style</p>{/if}
{/snippet}

<div class="card changes">
  <div class="head">
    <h2>{ui.rung !== null ? PRESETS[ui.rung].label : 'Your own target'}</h2>
    {#if changes.length}<span class="gain {tone(to)}">{from} → {to}</span>{/if}
  </div>
  <p class="muted small sub">
    {ui.rung !== null ? PRESETS[ui.rung].hint : 'Pick a step above to start again from a suggested target.'}
  </p>

  {#if ui.laddering && !ladder}
    <p class="muted">Working out what to change…</p>
  {:else if !changes.length}
    <p class="muted">Nothing to change.</p>
  {:else}
    <ul class="list">
      {#each changes as ch (ch.id)}
        <li use:link={MEASURE[ch.id]}>
          <div class="line">
            <button
              type="button" class="what" aria-expanded={open === ch.id}
              onclick={() => (open = open === ch.id ? null : ch.id)}
            >
              <span>{ch.text}</span><span class="chev" aria-hidden="true">{open === ch.id ? '▴' : '▾'}</span>
            </button>
            <button
              type="button" class="x" aria-label="Keep the {ch.label} as it is" title="Keep this as it is"
              onclick={() => keepAsIs(ch.keys)}
            >✕</button>
          </div>
          {#if open === ch.id}
            <div class="knobs">{#each ch.keys as k (k)}<KnobField {k} {whyImpossible} />{/each}</div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if edited}
    <p class="small edited">
      <span class="muted">Adjusted by hand.</span>
      <button type="button" class="link" onclick={() => chooseRung(ui.rung!)}>Reset</button>
    </p>
  {/if}

  {#if ui.notes && app.detail.results >= 2}
    <h3>Why it stops here</h3>
    <ul class="muted notes">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
  {/if}
  {@render verdictLine()}

  {#if changes.length}
    <div class="row-actions">
      <button type="button" class="btn small" onclick={markAsMine}>I've made these changes</button>
    </div>
  {/if}
</div>

<style>
  .changes { margin-top: 14px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .head h2 { margin: 0; }
  .gain { font-weight: 700; white-space: nowrap; }
  .gain.ok { color: var(--ok); }
  .gain.near { color: var(--near); }
  .gain.off { color: var(--off); }
  .sub { margin: 4px 0 10px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .line { display: flex; gap: 6px; align-items: stretch; }
  .what {
    flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 10px; min-height: 44px;
    padding: 8px 12px; text-align: left; border: 0; border-radius: 10px; background: var(--surface-2); font-weight: 600;
  }
  .chev { color: var(--muted); font-size: 12px; }
  .x {
    flex: none; width: 44px; border: 0; border-radius: 10px; background: var(--surface-2); color: var(--muted);
  }
  .x:hover { color: var(--off); }
  .knobs { padding: 6px 4px 2px; }
  .edited { display: flex; gap: 8px; align-items: center; margin: 10px 0 0; }
  .link { border: 0; background: none; padding: 0; color: var(--accent); font-weight: 600; text-decoration: underline; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 12px 0 6px; }
  .notes { margin: 0; padding-left: 18px; }
  .notes li { margin-bottom: 3px; }
  .row-actions { display: flex; gap: 8px; margin-top: 12px; }
  .verdict { margin: 12px 0 0; font-weight: 600; }
  .verdict.ok { color: var(--ok); }
  .verdict.near { color: var(--near); }
  .verdict.off { color: var(--off); }
</style>
