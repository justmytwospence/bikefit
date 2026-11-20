<script lang="ts">
  import { noseSetback, railForSetback, setbackRange } from '../model/geometry';
  import { wrenchList } from '../model/advice';
  import { contactReadouts } from '../model/readouts';
  import { IMPOSSIBLE_SHORT, IMPOSSIBLE_TEXT, possibleRange, type Impossible } from '../model/limits';
  import type { Evaluation, FitParams, Layout } from '../model/types';
  import type { ParamKey } from '../model/types';
  import { clamp } from '../model/vec';
  import { KNOB_ORDER } from '../lib/knobs';
  import { activeFrame, app, optimize, setKnob, ui, useStep } from '../state.svelte';
  import { measure } from '../lib/measure';
  import { event } from '../lib/analytics';
  import ChipRow from './ChipRow.svelte';
  import BikePicker from './BikePicker.svelte';
  import FitResults from './FitResults.svelte';
  import FrameDetails from './FrameDetails.svelte';
  import ImpossibleBanner from './ImpossibleBanner.svelte';
  import LockToggle from './LockToggle.svelte';
  import Segmented from './Segmented.svelte';
  import SliderField from './SliderField.svelte';

  let { layout, evaluation, whyImpossible, reaches }: {
    layout: Layout; evaluation: Evaluation; whyImpossible: (p: FitParams) => Impossible | null;
    reaches: (p: FitParams) => boolean;
  } = $props();

  const resultsLv = $derived(app.detail.results);
  const frame = $derived(activeFrame());
  const o = $derived(app.options);
  const c = $derived(app.current);
  const b = $derived(app.baseline);
  /** The setup the settings change. */
  const ed = $derived(ui.editing === 'current' ? app.baseline : app.current);
  const isTarget = $derived(ui.editing === 'target');
  const changes = $derived(wrenchList($state.snapshot(b), $state.snapshot(c)));
  const hasChanges = $derived(changes[0] !== 'No changes from your current setup.');

  const setback = $derived(noseSetback(frame, app.components, ed));
  const setbackDelta = $derived(noseSetback(frame, app.components, c) - noseSetback(frame, app.components, b));
  const sbRange = $derived(setbackRange(frame, app.components, ed, o.railRange));
  const readouts = $derived(contactReadouts(layout, $state.snapshot(ed), evaluation, resultsLv));

  // Hard stops: each knob may move only as far as the rider's body can still ride the bike.
  const cur = $derived($state.snapshot(ed) as FitParams);
  const with_ = (patch: Partial<FitParams>) => whyImpossible({ ...cur, ...patch });
  const saddleLim = $derived(possibleRange(
    o.saddleHeightRange[0], o.saddleHeightRange[1], 0.5, cur.saddleHeight, (v) => with_({ saddleHeight: v }),
  ));
  const sbMin = $derived(Math.ceil(sbRange[0] * 2) / 2);
  const sbMax = $derived(Math.floor(sbRange[1] * 2) / 2);
  const sbLim = $derived(possibleRange(
    sbMin, sbMax, 0.5, Math.round(setback * 2) / 2,
    (v) => with_({ railOffset: railForSetback(frame, app.components, cur, v) }),
  ));
  const spacerLim = $derived(possibleRange(0, frame.maxSpacers, o.spacerStep, cur.spacers, (v) => with_({ spacers: v })));
  const cleatLim = $derived(possibleRange(o.cleatRange[0], o.cleatRange[1], 1, cur.cleatOffset, (v) => with_({ cleatOffset: v })));
  type Lim = ReturnType<typeof possibleRange>;
  /** Why the current setup cannot be ridden at all; the banner says so once, instead of every slider. */
  const blocked = $derived(whyImpossible(cur));
  /** Says why the thumb cannot go further, while it sits against a limit. */
  function stopText(l: Lim, v: number): string | undefined {
    if (blocked) return undefined;
    if (v <= l.lo && l.lowWhy) return `Stops here: ${IMPOSSIBLE_SHORT[l.lowWhy]}`;
    if (v >= l.hi && l.highWhy) return `Stops here: ${IMPOSSIBLE_SHORT[l.highWhy]}`;
    return undefined;
  }
  /** Part choices the rider could not ride; the current one always stays available. */
  function blockedChips(key: ParamKey, options: number[]): Map<number, string> {
    const out = new Map<number, string>();
    for (const n of options) {
      if (n === cur[key]) continue;
      const w = with_({ [key]: n });
      if (w) out.set(n, `Out of reach: ${IMPOSSIBLE_TEXT[w]}`);
    }
    return out.size === options.filter((n) => n !== cur[key]).length && whyImpossible(cur) ? new Map() : out;
  }

  function setSetback(v: number) {
    setKnob('railOffset', clamp(railForSetback(frame, app.components, cur, v), o.railRange[0], o.railRange[1]));
  }
  const setbackLabel = (n: number) => (n === 0 ? 'Inline' : n + ' mm');

  const SIDES: { value: 'current' | 'target'; label: string }[] = [
    { value: 'current', label: 'Current setup' },
    { value: 'target', label: 'Target' },
  ];
  const GROUPS: { title: string; keys: ParamKey[] }[] = [
    { title: 'Saddle', keys: ['saddleHeight', 'railOffset', 'seatpostSetback'] },
    { title: 'Cockpit', keys: ['spacers', 'stemLength', 'stemAngle'] },
    { title: 'Cranks and cleats', keys: ['cleatOffset', 'crankLength'] },
  ];
  const allLocked = $derived(KNOB_ORDER.every((k) => app.locks[k]));
</script>

<div class="scroll">
  {#if blocked}<ImpossibleBanner {frame} why={blocked} current={cur} {whyImpossible} {reaches} setSaddle={(v) => setKnob('saddleHeight', v)} />{/if}
  <BikePicker />
  <h2>Setup</h2>
  <Segmented
    options={SIDES} ariaLabel="Which setup the settings change"
    bind:value={() => ui.editing, (v) => { ui.editing = v; event('Editing', { side: v }); }}
  />
  <p class="muted small start">
    {isTarget
      ? 'What to change it to. Optimize suggests targets from your current setup.'
      : 'Your bike as you ride it now. Settings the target leaves alone follow it.'}
  </p>

  {#snippet knob(k: ParamKey)}
    {#if k === 'saddleHeight'}
      <div use:measure={'saddleHeight'}>
      <SliderField
        label="Saddle height" min={o.saddleHeightRange[0]} max={o.saddleHeightRange[1]} step={0.5}
        bind:value={() => ed.saddleHeight, (v) => setKnob('saddleHeight', v)} bind:locked={app.locks.saddleHeight} showLock={isTarget}
        limit={[saddleLim.lo, saddleLim.hi]} stop={stopText(saddleLim, cur.saddleHeight)}
        delta={isTarget ? c.saddleHeight - b.saddleHeight : 0} hint="BB centre to saddle top, along the seat tube"
      />
      </div>
    {:else if k === 'railOffset'}
      <div use:measure={'setback'}>
      <SliderField
        label="Setback to saddle nose" min={sbMin} max={sbMax} step={0.5}
        bind:value={() => Math.round(setback * 2) / 2, setSetback} bind:locked={app.locks.railOffset} showLock={isTarget}
        limit={[sbLim.lo, sbLim.hi]} stop={stopText(sbLim, Math.round(setback * 2) / 2)}
        delta={isTarget ? setbackDelta : 0} hint="Plumb from the saddle nose, behind the BB"
      />
      <p class="muted small rails">
        Rails: {cur.railOffset === 0 ? 'centred' : Math.abs(cur.railOffset) + ' mm ' + (cur.railOffset > 0 ? 'forward' : 'back') + ' of centre'}
      </p>
      </div>
    {:else if k === 'seatpostSetback'}
      <div use:measure={'setback'}>
      <div class="chiphead">
        <span>Seatpost setback</span>
        {#if isTarget}<LockToggle label="Seatpost setback" bind:locked={app.locks.seatpostSetback} />{/if}
      </div>
      <div class="chips" class:locked={isTarget && app.locks.seatpostSetback}>
      <ChipRow options={o.seatpostSetbacks} bind:value={() => ed.seatpostSetback, (v) => setKnob('seatpostSetback', v)} format={setbackLabel} blocked={blockedChips('seatpostSetback', o.seatpostSetbacks)} />
      </div>
      </div>
    {:else if k === 'spacers'}
      <div use:measure={'spacers'}>
      <SliderField
        label="Spacers" min={0} max={frame.maxSpacers} step={o.spacerStep}
        bind:value={() => ed.spacers, (v) => setKnob('spacers', v)} bind:locked={app.locks.spacers} showLock={isTarget}
        limit={[spacerLim.lo, spacerLim.hi]} stop={stopText(spacerLim, cur.spacers)}
        delta={isTarget ? c.spacers - b.spacers : 0} hint="Under the stem, above the headset"
      />
      </div>
    {:else if k === 'stemLength'}
      <div use:measure={'stem'}>
      <div class="chiphead">
        <span>Stem length</span>
        {#if isTarget}<LockToggle label="Stem length" bind:locked={app.locks.stemLength} />{/if}
      </div>
      <div class="chips" class:locked={isTarget && app.locks.stemLength}>
      <ChipRow options={o.stemLengths} bind:value={() => ed.stemLength, (v) => setKnob('stemLength', v)} format={(n) => n + ' mm'} blocked={blockedChips('stemLength', o.stemLengths)} />
      </div>
      </div>
    {:else if k === 'stemAngle'}
      <div use:measure={'stem'}>
      <div class="chiphead">
        <span>Stem angle</span>
        {#if isTarget}<LockToggle label="Stem angle" bind:locked={app.locks.stemAngle} />{/if}
      </div>
      <div class="chips" class:locked={isTarget && app.locks.stemAngle}>
      <ChipRow
        options={o.stemAngles} bind:value={() => ed.stemAngle, (v) => setKnob('stemAngle', v)} blocked={blockedChips('stemAngle', o.stemAngles)}
        format={(n) => (n === 0 ? '0°' : (n > 0 ? '+' : '−') + Math.abs(n) + '°')}
      />
      </div>
      </div>
    {:else if k === 'cleatOffset'}
      <div use:measure={'cleat'}>
      <SliderField
        label="Cleat position" unit="mm back" min={o.cleatRange[0]} max={o.cleatRange[1]} step={1}
        bind:value={() => ed.cleatOffset, (v) => setKnob('cleatOffset', v)} bind:locked={app.locks.cleatOffset} showLock={isTarget}
        limit={[cleatLim.lo, cleatLim.hi]} stop={stopText(cleatLim, cur.cleatOffset)}
        delta={isTarget ? c.cleatOffset - b.cleatOffset : 0} hint="0 = pedal axle under the ball of the foot"
      />
      </div>
    {:else if k === 'crankLength'}
      <div use:measure={'crank'}>
      <div class="chiphead">
        <span>Crank length</span>
        {#if isTarget}<LockToggle label="Crank length" bind:locked={app.locks.crankLength} />{/if}
      </div>
      <div class="chips" class:locked={isTarget && app.locks.crankLength}>
      <ChipRow options={o.crankLengths} bind:value={() => ed.crankLength, (v) => setKnob('crankLength', v)} format={(n) => n + ' mm'} blocked={blockedChips('crankLength', o.crankLengths)} />
      </div>
      </div>
    {/if}
  {/snippet}

  {#if isTarget}
    <div class="lockall">
      <span class="muted small">A lock keeps a setting where the target has it.</span>
      <button type="button" class="btn small" onclick={() => { for (const k of KNOB_ORDER) app.locks[k] = !allLocked; }}>
        {allLocked ? 'Unlock all' : 'Lock all'}
      </button>
    </div>
  {/if}
  {#each GROUPS as g (g.title)}
    <h2>{g.title}</h2>
    {#each g.keys as k (k)}{@render knob(k)}{/each}
  {/each}

  {#if readouts.length}
    <div class="card readouts">
      <h2>Contact points</h2>
      <dl>
        {#each readouts as r (r.id)}<div><dt>{r.label}</dt><dd>{r.value}</dd></div>{/each}
      </dl>
    </div>
  {/if}

  <FitResults {changes} {hasChanges} />
  {#if ui.error}<p class="err">{ui.error}</p>{/if}

  <details class="card frame">
    <summary><b>Frame geometry and parts</b></summary>
    <FrameDetails />
  </details>
</div>

<div class="actions">
  <button type="button" class="btn primary grow" disabled={ui.busy} onclick={optimize}>
    {#if ui.busy}<span class="spin"></span>Optimizing…{:else}Optimize{/if}
  </button>
  <button
    type="button" class="btn sec" disabled={!hasChanges} title="Set the target back to your current setup"
    onclick={() => useStep(-1)}
  >Reset</button>
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .chiphead { display: flex; justify-content: space-between; align-items: center; min-height: 36px; font-weight: 600; }
  .chips.locked { opacity: 0.55; }
  .lockall { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; }
  .lockall .btn { width: 104px; padding: 0; }
  .rails { margin: -4px 0 10px; }
  .start { margin-top: 6px; }
  .frame { margin-top: 18px; }
  .frame summary { cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; }
  .frame summary b::after { content: ' ▾'; color: var(--muted); }
  .frame[open] summary b::after { content: ' ▴'; }
  .readouts h2 { margin-top: 0; }
  dl { margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--line); }
  dl div:last-child { border-bottom: 0; }
  dt { color: var(--muted); }
  dd { margin: 0; font-weight: 600; text-align: right; }
  .actions {
    display: flex; gap: 10px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line); background: var(--surface);
  }
  .grow { flex: 1; }
  .sec { width: 96px; }
  .err { color: var(--off); }
</style>
