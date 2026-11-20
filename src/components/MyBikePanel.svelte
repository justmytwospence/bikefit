<script lang="ts">
  import { contactReadouts } from '../model/readouts';
  import type { Impossible } from '../model/limits';
  import type { Evaluation, FitParams, Layout, ParamKey } from '../model/types';
  import { activeFrame, app, currentMismatch, ladderKey, refreshLadder, setKnob, ui } from '../state.svelte';
  import BodyMismatch from './BodyMismatch.svelte';
  import { link } from '../lib/link.svelte';
  import BikePicker from './BikePicker.svelte';
  import ChangesCard from './ChangesCard.svelte';
  import FrameDetails from './FrameDetails.svelte';
  import ImpossibleBanner from './ImpossibleBanner.svelte';
  import KnobField from './KnobField.svelte';
  import LadderSwitch from './LadderSwitch.svelte';

  let { layout, evaluation, whyImpossible, reaches }: {
    layout: Layout; evaluation: Evaluation; whyImpossible: (p: FitParams) => Impossible | null;
    reaches: (p: FitParams) => boolean;
  } = $props();

  const resultsLv = $derived(app.detail.results);
  const frame = $derived(activeFrame());
  /** The setup the settings change. */
  const ed = $derived(ui.editing === 'current' ? app.baseline : app.current);
  const isTarget = $derived(ui.editing === 'target');
  const cur = $derived($state.snapshot(ed) as FitParams);
  /** Why the setup cannot be ridden at all; the banner says so once, instead of every slider. */
  const blocked = $derived(whyImpossible(cur));
  /** A current setup the measurements say could hardly be ridden: the measurements are the likelier mistake. */
  const mismatch = $derived(currentMismatch());
  const readouts = $derived(contactReadouts(layout, cur, evaluation, resultsLv));

  // The targets follow your current setup: work them out again shortly after it (or anything they depend on) changes.
  $effect(() => {
    const k = ladderKey();
    if (ui.ladder?.key === k) return;
    const t = setTimeout(refreshLadder, 400);
    return () => clearTimeout(t);
  });
  const GROUPS: { title: string; keys: ParamKey[] }[] = [
    { title: 'Saddle', keys: ['saddleHeight', 'railOffset', 'seatpostSetback'] },
    { title: 'Cockpit', keys: ['spacers', 'stemLength', 'stemAngle'] },
    { title: 'Cranks and cleats', keys: ['cleatOffset', 'crankLength'] },
  ];
</script>

<div class="scroll">
  {#if mismatch}<BodyMismatch {mismatch} />
  {:else if blocked}<ImpossibleBanner {frame} why={blocked} current={cur} {whyImpossible} {reaches} setSaddle={(v) => setKnob('saddleHeight', v)} />{/if}
  <BikePicker />
  <h2>Setup</h2>
  <LadderSwitch />

  {#snippet groups()}
    {#each GROUPS as g (g.title)}
      <h2>{g.title}</h2>
      {#each g.keys as k (k)}<KnobField {k} {whyImpossible} />{/each}
    {/each}
  {/snippet}

  {#if isTarget}
    <ChangesCard {whyImpossible} />
    <details class="card all">
      <summary><b>All settings</b></summary>
      {@render groups()}
    </details>
  {:else}
    <p class="muted small intro">Your bike as you ride it now. The targets are worked out from it.</p>
    {@render groups()}
  {/if}

  {#if readouts.length}
    <div class="card readouts">
      <h2>Contact points</h2>
      <dl>
        {#each readouts as r (r.id)}<div role="button" tabindex="0" class="ro" use:link={{ id: r.link, pin: true }}><dt>{r.label}</dt><dd>{r.value}</dd></div>{/each}
      </dl>
    </div>
  {/if}

  {#if ui.error}<p class="err">{ui.error}</p>{/if}

  <details class="card frame">
    <summary><b>Frame geometry and parts</b></summary>
    <FrameDetails />
  </details>
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .intro { margin: 10px 0 0; }
  .frame, .all { margin-top: 18px; }
  .frame summary, .all summary { cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; }
  .frame summary b::after, .all summary b::after { content: ' ▾'; color: var(--muted); }
  .frame[open] summary b::after, .all[open] summary b::after { content: ' ▴'; }
  .readouts h2 { margin-top: 0; }
  dl { margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--line); }
  dl div:last-child { border-bottom: 0; }
  .ro { cursor: pointer; }
  dt { color: var(--muted); }
  dd { margin: 0; font-weight: 600; text-align: right; }
  .err { color: var(--off); }
</style>
