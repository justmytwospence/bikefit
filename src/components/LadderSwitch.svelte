<script lang="ts">
  import { PRESETS } from '../lib/knobs';
  import type { FitParams } from '../model/types';
  import { app, chooseRung, ladderKey, setupScore, ui } from '../state.svelte';

  /** The switch at the top of Fit my bike: your current setup, then the three targets worked out from it. */
  const ladder = $derived(ui.ladder && ui.ladder.key === ladderKey() ? ui.ladder : null);
  const currentScore = $derived(setupScore($state.snapshot(app.baseline) as FitParams));
  /** -1 is the current setup; -2 a target of your own that follows no step. */
  const value = $derived(ui.editing === 'current' ? -1 : (ui.rung ?? -2));
  const NAMES = ['Tools', 'Parts', 'All'];
  const options = $derived([
    { value: -1, name: 'Current', title: 'Your current setup', score: currentScore as number | null, suggested: false },
    ...PRESETS.map((p, i) => ({
      value: i, name: NAMES[i], title: p.label, score: ladder ? ladder.steps[i].score : null,
      suggested: !!ladder && ladder.suggested === i,
    })),
  ]);
  const tone = (s: number) => (s >= 85 ? 'ok' : s >= 60 ? 'near' : 'off');

  const hint = $derived.by(() => {
    if (value === -1) return 'Your bike as you ride it now. Settings a target leaves alone follow it.';
    if (value === -2) return 'A target of your own. Pick a step to start from one of the suggested ones.';
    const p = PRESETS[value];
    let text = `${p.label}: ${p.hint}`;
    if (ladder?.steps[value].same) text += ` Gains nothing over ${PRESETS[value - 1].label}.`;
    if (ladder && ladder.suggested === value) text += ' Suggested: the smallest step within three points of the best.';
    return text;
  });

  function key(e: KeyboardEvent) {
    const i = options.findIndex((o) => o.value === value);
    let n = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    chooseRung(options[n].value);
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=radio]')[n]?.focus();
  }
</script>

<div class="seg" role="radiogroup" aria-label="Current setup and targets" tabindex="-1" onkeydown={key}>
  {#each options as o (o.value)}
    <button
      type="button" role="radio" aria-checked={value === o.value} title={o.title}
      tabindex={value === o.value || (value === -2 && o.value === -1) ? 0 : -1}
      class:on={value === o.value} onclick={() => chooseRung(o.value)}
    >
      <span class="name">{o.name}{#if o.suggested}<i class="dot" aria-label="suggested"></i>{/if}</span>
      {#if o.score === null}
        <span class="score muted">{ui.laddering ? '…' : '–'}</span>
      {:else}
        <span class="score {tone(o.score)}">{o.score}</span>
      {/if}
    </button>
  {/each}
</div>
<p class="muted small hint">{ui.laddering && !ladder ? 'Working out targets from your current setup…' : hint}</p>

<style>
  .seg { display: flex; background: var(--surface-2); border-radius: 12px; padding: 3px; gap: 2px; min-width: 0; }
  button {
    flex: 1; min-width: 0; border: 0; background: transparent; border-radius: 9px; min-height: 48px; padding: 4px 6px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; color: var(--muted);
  }
  button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgb(0 0 0 / 0.15); }
  .name { font-weight: 600; white-space: nowrap; }
  .score { font-weight: 700; font-size: 13px; }
  .score.ok { color: var(--ok); }
  .score.near { color: var(--near); }
  .score.off { color: var(--off); }
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-left: 4px; vertical-align: 2px; }
  .hint { margin-top: 6px; min-height: 2.8em; }
</style>
