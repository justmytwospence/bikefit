<script lang="ts">
  import { noseSetback, railForSetback, setbackRange } from '../model/geometry';
  import { wrenchList } from '../model/advice';
  import { contactReadouts } from '../model/readouts';
  import { IMPOSSIBLE_TEXT, possibleRange, type Impossible } from '../model/limits';
  import type { Evaluation, FitParams, Layout } from '../model/types';
  import type { ParamKey } from '../model/types';
  import { clamp } from '../model/vec';
  import { fixedSummary, KNOB_ORDER, PRESET_FREE, PRESETS, presetLocks } from '../lib/knobs';
  import {
    activeFrame, app, clearGhost, optimize, resetToBaseline, setHasSetup, ui,
  } from '../state.svelte';
  import { measure } from '../lib/measure';
  import ChipRow from './ChipRow.svelte';
  import BikePicker from './BikePicker.svelte';
  import FitResults from './FitResults.svelte';
  import FrameDetails from './FrameDetails.svelte';
  import LockToggle from './LockToggle.svelte';
  import QuestionBar from './QuestionBar.svelte';
  import Segmented from './Segmented.svelte';
  import SliderField from './SliderField.svelte';

  let { layout, evaluation, whyImpossible }: {
    layout: Layout; evaluation: Evaluation; whyImpossible: (p: FitParams) => Impossible | null;
  } = $props();

  const resultsLv = $derived(app.detail.results);
  const frame = $derived(activeFrame());
  const o = $derived(app.options);
  const c = $derived(app.current);
  const b = $derived(app.baseline);
  const changes = $derived(wrenchList($state.snapshot(b), $state.snapshot(c)));
  const hasChanges = $derived(changes[0] !== 'No changes from your current setup.');

  const setback = $derived(noseSetback(frame, app.components, c));
  const setbackDelta = $derived(setback - noseSetback(frame, app.components, b));
  const sbRange = $derived(setbackRange(frame, app.components, c, o.railRange));
  const readouts = $derived(contactReadouts(layout, $state.snapshot(c), evaluation, resultsLv));

  // Hard stops: each knob may move only as far as the rider's body can still ride the bike.
  const cur = $derived($state.snapshot(app.current) as FitParams);
  const with_ = (patch: Partial<FitParams>) => whyImpossible({ ...cur, ...patch });
  const saddleLim = $derived(possibleRange(
    o.saddleHeightRange[0], o.saddleHeightRange[1], 0.5, c.saddleHeight, (v) => with_({ saddleHeight: v }),
  ));
  const sbMin = $derived(Math.ceil(sbRange[0] * 2) / 2);
  const sbMax = $derived(Math.floor(sbRange[1] * 2) / 2);
  const sbLim = $derived(possibleRange(
    sbMin, sbMax, 0.5, Math.round(setback * 2) / 2,
    (v) => with_({ railOffset: railForSetback(frame, app.components, cur, v) }),
  ));
  const spacerLim = $derived(possibleRange(0, frame.maxSpacers, o.spacerStep, c.spacers, (v) => with_({ spacers: v })));
  const cleatLim = $derived(possibleRange(o.cleatRange[0], o.cleatRange[1], 1, c.cleatOffset, (v) => with_({ cleatOffset: v })));
  type Lim = ReturnType<typeof possibleRange>;
  /** Says why the thumb cannot go further, while it sits against a limit. */
  function stopText(l: Lim, v: number, words: [string, string]): string | undefined {
    if (v <= l.lo && l.lowWhy) return `Any ${words[0]} and ${IMPOSSIBLE_TEXT[l.lowWhy]}.`;
    if (v >= l.hi && l.highWhy) return `Any ${words[1]} and ${IMPOSSIBLE_TEXT[l.highWhy]}.`;
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
    app.current.railOffset = clamp(railForSetback(frame, app.components, c, v), o.railRange[0], o.railRange[1]);
  }
  const setbackLabel = (n: number) => (n === 0 ? 'Inline' : n + ' mm');

  const presetOptions = PRESETS.map((p) => ({ value: p.value, label: p.label, title: p.hint }));
  const GROUPS: { title: string; keys: ParamKey[] }[] = [
    { title: 'Saddle', keys: ['saddleHeight', 'railOffset', 'seatpostSetback'] },
    { title: 'Cockpit', keys: ['spacers', 'stemLength', 'stemAngle'] },
    { title: 'Cranks and cleats', keys: ['cleatOffset', 'crankLength'] },
  ];
  // The scope, not the locks, decides where a knob sits, so locking one never moves it.
  const inScope = $derived(PRESET_FREE[app.scope]);
  const stays = $derived(KNOB_ORDER.filter((k) => !inScope.includes(k)));
  const staysTitle = $derived(stays.every((k) => app.locks[k]) ? 'Stays as it is' : 'Other parts');
  const groups = $derived(
    GROUPS.map((g) => ({ title: g.title, keys: g.keys.filter((k) => inScope.includes(k)) })).filter((g) => g.keys.length > 0),
  );
</script>

<QuestionBar
  label="Can change" ariaLabel="What you can change" options={presetOptions}
  bind:value={() => app.scope, (v) => { app.scope = v; Object.assign(app.locks, presetLocks(v)); }}
/>
<div class="scroll">
  <BikePicker />
  {#if !app.hasSetup}
    <p class="muted small start">
      No setup saved for this bike yet: Optimize suggests a build{frame.id.startsWith('cat:') ? ' and checks its other sizes' : ''}.
    </p>
    <button type="button" class="link" onclick={() => setHasSetup(true)}>I already ride it: these settings are my setup</button>
  {:else}
    <p class="muted small start">Changes are counted from your setup. Optimize prefers adjustments over new parts.</p>
    <button type="button" class="link" onclick={() => setHasSetup(false)}>Start a new build instead</button>
  {/if}
  {#snippet knob(k: ParamKey)}
    {#if k === 'saddleHeight'}
      <div use:measure={'saddleHeight'}>
      <SliderField
        label="Saddle height" min={o.saddleHeightRange[0]} max={o.saddleHeightRange[1]} step={0.5}
        bind:value={app.current.saddleHeight} bind:locked={app.locks.saddleHeight}
        limit={[saddleLim.lo, saddleLim.hi]} stop={stopText(saddleLim, c.saddleHeight, ['lower', 'higher'])}
        delta={app.hasSetup ? c.saddleHeight - b.saddleHeight : 0} hint="BB centre to saddle top, along the seat tube" onedit={clearGhost}
      />
      </div>
    {:else if k === 'railOffset'}
      <div use:measure={'setback'}>
      <SliderField
        label="Setback to saddle nose" min={sbMin} max={sbMax} step={0.5}
        bind:value={() => Math.round(setback * 2) / 2, setSetback} bind:locked={app.locks.railOffset}
        limit={[sbLim.lo, sbLim.hi]} stop={stopText(sbLim, Math.round(setback * 2) / 2, ['further forward', 'further back'])}
        delta={app.hasSetup ? setbackDelta : 0} hint="Plumb line from the saddle nose to the floor; distance behind the bottom bracket" onedit={clearGhost}
      />
      <p class="muted small rails">
        Rails: {c.railOffset === 0 ? 'centred' : Math.abs(c.railOffset) + ' mm ' + (c.railOffset > 0 ? 'forward' : 'back') + ' of centre'}
      </p>
      </div>
    {:else if k === 'seatpostSetback'}
      <div use:measure={'setback'}>
      <div class="chiphead">
        <span>Seatpost setback</span>
        <LockToggle label="Seatpost setback" bind:locked={app.locks.seatpostSetback} />
      </div>
      <div class="chips" class:locked={app.locks.seatpostSetback}>
      <ChipRow options={o.seatpostSetbacks} bind:value={app.current.seatpostSetback} format={setbackLabel} blocked={blockedChips('seatpostSetback', o.seatpostSetbacks)} onedit={clearGhost} />
      </div>
      </div>
    {:else if k === 'spacers'}
      <div use:measure={'spacers'}>
      <SliderField
        label="Spacers" min={0} max={frame.maxSpacers} step={o.spacerStep}
        bind:value={app.current.spacers} bind:locked={app.locks.spacers}
        limit={[spacerLim.lo, spacerLim.hi]} stop={stopText(spacerLim, c.spacers, ['fewer', 'more'])}
        delta={app.hasSetup ? c.spacers - b.spacers : 0} onedit={clearGhost}
      />
      </div>
    {:else if k === 'stemLength'}
      <div use:measure={'stem'}>
      <div class="chiphead">
        <span>Stem length</span>
        <LockToggle label="Stem length" bind:locked={app.locks.stemLength} />
      </div>
      <div class="chips" class:locked={app.locks.stemLength}>
      <ChipRow options={o.stemLengths} bind:value={app.current.stemLength} format={(n) => n + ' mm'} blocked={blockedChips('stemLength', o.stemLengths)} onedit={clearGhost} />
      </div>
      </div>
    {:else if k === 'stemAngle'}
      <div use:measure={'stem'}>
      <div class="chiphead">
        <span>Stem angle</span>
        <LockToggle label="Stem angle" bind:locked={app.locks.stemAngle} />
      </div>
      <div class="chips" class:locked={app.locks.stemAngle}>
      <ChipRow
        options={o.stemAngles} bind:value={app.current.stemAngle} blocked={blockedChips('stemAngle', o.stemAngles)}
        format={(n) => (n === 0 ? '0°' : (n > 0 ? '+' : '−') + Math.abs(n) + '°')} onedit={clearGhost}
      />
      </div>
      </div>
    {:else if k === 'cleatOffset'}
      <div use:measure={'cleat'}>
      <SliderField
        label="Cleat position" unit="mm back" min={o.cleatRange[0]} max={o.cleatRange[1]} step={1}
        bind:value={app.current.cleatOffset} bind:locked={app.locks.cleatOffset}
        limit={[cleatLim.lo, cleatLim.hi]} stop={stopText(cleatLim, c.cleatOffset, ['further forward', 'further back'])}
        delta={app.hasSetup ? c.cleatOffset - b.cleatOffset : 0} hint="0 = pedal axle under the ball of the foot" onedit={clearGhost}
      />
      </div>
    {:else if k === 'crankLength'}
      <div use:measure={'crank'}>
      <div class="chiphead">
        <span>Crank length</span>
        <LockToggle label="Crank length" bind:locked={app.locks.crankLength} />
      </div>
      <div class="chips" class:locked={app.locks.crankLength}>
      <ChipRow options={o.crankLengths} bind:value={app.current.crankLength} format={(n) => n + ' mm'} blocked={blockedChips('crankLength', o.crankLengths)} onedit={clearGhost} />
      </div>
      </div>
    {/if}
  {/snippet}

  {#each groups as g (g.title)}
    <h2>{g.title}</h2>
    {#each g.keys as k (k)}{@render knob(k)}{/each}
  {/each}

  {#if stays.length}
    <details class="card fixed">
      <summary><b>{staysTitle}</b><span class="muted small">{fixedSummary(stays, c, setback)}</span></summary>
      {#each stays as k (k)}{@render knob(k)}{/each}
    </details>
  {/if}

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
  {#if app.hasSetup}
    <button type="button" class="btn" disabled={!hasChanges} onclick={resetToBaseline}>Reset</button>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .chiphead { display: flex; justify-content: space-between; align-items: center; min-height: 36px; font-weight: 600; }
  .chips.locked { opacity: 0.55; }
  .rails { margin: -4px 0 10px; }
  .start { margin-top: 6px; }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 600; padding: 8px 0; min-height: 36px; }
  .fixed, .frame { margin-top: 18px; }
  .fixed summary, .frame summary { cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; }
  .fixed summary b::after, .frame summary b::after { content: ' ▾'; color: var(--muted); }
  .fixed[open] summary b::after, .frame[open] summary b::after { content: ' ▴'; }
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
  .err { color: var(--off); }
</style>
