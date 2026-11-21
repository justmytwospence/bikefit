<script lang="ts">
  import { KNOB_ORDER, PRESETS } from '../lib/knobs';
  import { PARAM_LABELS } from '../model/advice';
  import type { FitParams } from '../model/types';
  import { peek } from '../lib/peek.svelte';
  import { app, chooseRung, ladderKey, release, setupScore, ui } from '../state.svelte';

  /** The switch at the top of Fit my bike: your current setup, then the three targets worked out from it. */
  const shown = $derived(ui.ladder);
  const fresh = $derived(!!shown && shown.key === ladderKey());
  const currentScore = $derived(setupScore($state.snapshot(app.baseline) as FitParams));
  /** -1 is the current setup; -2 a target of your own that follows no step. */
  const value = $derived(ui.editing === 'current' ? -1 : (ui.rung ?? -2));
  const NAMES = ['Tools', 'Parts', 'All'];
  /** The rung a step that gains nothing stands for: the nearest lower step that gains something, or the current setup. */
  function lower(i: number): string {
    for (let j = i - 1; j >= 0; j--) if (shown && !shown.steps[j].same) return PRESETS[j].label;
    return 'your current setup';
  }
  const snap = <T,>(x: T) => $state.snapshot(x) as T;
  /** What pointing at a rung shows on the drawing: nothing for the one chosen or one that is not worked out yet. */
  function peekFor(o: { value: number; name: string; same: boolean }) {
    if (o.value === value || o.same || (o.value >= 0 && (!shown || !fresh))) return null;
    return {
      kind: 'setup' as const, label: o.name,
      params: o.value === -1 ? snap(app.baseline) as FitParams : shown!.steps[o.value].params,
    };
  }
  const options = $derived([
    { value: -1, name: 'Current', title: 'Your current setup', score: currentScore as number | null, same: false, suggested: false },
    ...PRESETS.map((p, i) => {
      const same = !!shown && shown.steps[i].same;
      return {
        value: i, name: NAMES[i], title: same ? `Same as ${lower(i)}` : p.label,
        score: shown ? shown.steps[i].score : null, same, suggested: !!shown && fresh && shown.suggested === i,
      };
    }),
  ]);
  const tone = (s: number) => (s >= 85 ? 'ok' : s >= 60 ? 'near' : 'off');
  const pinned = $derived(KNOB_ORDER.filter((k) => app.pins[k]));

  const note = $derived.by(() => {
    if (!shown) return ui.laddering ? 'Working out what to change…' : '';
    if (shown.steps.every((s) => s.same)) {
      return pinned.length
        ? 'Nothing to change while these stay as they are.'
        : 'Nothing to change: no adjustment or part would improve this setup.';
    }
    const groups = new Map<string, string[]>();
    shown.steps.forEach((s, i) => {
      if (!s.same) return;
      const l = lower(i);
      groups.set(l, [...(groups.get(l) ?? []), PRESETS[i].label]);
    });
    return [...groups].map(([l, names]) => `${names.join(' and ')} ${names.length > 1 ? 'gain' : 'gains'} nothing over ${l}.`).join(' ');
  });

  function key(e: KeyboardEvent) {
    const live = options.filter((o) => !o.same);
    const i = live.findIndex((o) => o.value === value);
    let n = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % live.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + live.length) % live.length;
    else return;
    e.preventDefault();
    chooseRung(live[n].value);
    const idx = options.findIndex((o) => o.value === live[n].value);
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=radio]')[idx]?.focus();
  }
</script>

<div class="seg" role="radiogroup" aria-label="Current setup and targets" tabindex="-1" onkeydown={key}>
  {#each options as o (o.value)}
    <button
      type="button" role="radio" aria-checked={value === o.value} title={o.title} disabled={o.same}
      tabindex={value === o.value || (value === -2 && o.value === -1) ? 0 : -1}
      class:on={value === o.value} onclick={() => chooseRung(o.value)} use:peek={() => peekFor(o)}
    >
      <span class="name">{o.name}{#if o.suggested}<i class="dot" aria-label="suggested"></i>{/if}</span>
      <span class="score" class:stale={o.value >= 0 && !fresh}>
        {#if o.same}<span class="same">same</span>
        {:else if o.score === null}<span class="muted">…</span>
        {:else}<span class={tone(o.score)}>{o.score}</span>{/if}
      </span>
    </button>
  {/each}
</div>
<!-- One fixed two-line slot, so nothing below moves as the targets are worked out again. While they are, the last note
     stays, faded. -->
<p class="muted small note" class:stale={!!note && !!shown && !fresh} title={note || undefined}>
  {note || 'Drag the saddle or the bars on the drawing to move them.'}
</p>
{#if pinned.length}
  <div class="pins">
    <span class="muted small">Kept as it is:</span>
    {#each pinned as k (k)}
      <button type="button" class="pin" title="Let the targets change this again" onclick={() => release(k)}>
        {PARAM_LABELS[k]} <span aria-hidden="true">✕</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .seg { display: flex; background: var(--surface-2); border-radius: 12px; padding: 3px; gap: 2px; min-width: 0; }
  button[role='radio'] {
    flex: 1; min-width: 0; border: 0; background: transparent; border-radius: 9px; min-height: 48px; padding: 4px 6px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; color: var(--muted);
  }
  button[role='radio'].on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgb(0 0 0 / 0.15); }
  button[role='radio']:disabled { opacity: 0.5; cursor: default; }
  .name { font-weight: 600; white-space: nowrap; }
  .score { font-weight: 700; font-size: 13px; transition: opacity 0.2s; }
  .score.stale { opacity: 0.5; }
  .same { font-size: 11px; font-weight: 600; color: var(--muted); }
  .ok { color: var(--ok); }
  .near { color: var(--near); }
  .off { color: var(--off); }
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-left: 4px; vertical-align: 2px; }
  .note {
    margin: 6px 0 0; height: 2lh; overflow: hidden; transition: opacity 0.2s;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
  }
  .note.stale { opacity: 0.5; }
  .pins { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
  .pin {
    border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 4px 10px; font-size: 13px;
    font-weight: 600;
  }
  .pin span { color: var(--muted); margin-left: 2px; }
</style>
