<script lang="ts">
  import { level } from '../lib/appData';
  import { noseSetback, railForSetback, setbackRange } from '../model/geometry';
  import { wrenchList } from '../model/optimize';
  import { contactReadouts } from '../model/readouts';
  import type { Evaluation, Layout } from '../model/types';
  import { clamp } from '../model/vec';
  import {
    activeFrame, app, clearGhost, markAsMine, optimize, resetToBaseline, ui, undo,
  } from '../state.svelte';
  import ChipRow from './ChipRow.svelte';
  import DetailToggle from './DetailToggle.svelte';
  import SliderField from './SliderField.svelte';

  let { layout, evaluation }: { layout: Layout; evaluation: Evaluation } = $props();

  const lv = $derived(level(app, 'setup'));
  const resultsLv = $derived(level(app, 'results'));
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

  function setSetback(v: number) {
    app.current.railOffset = clamp(railForSetback(frame, app.components, c, v), o.railRange[0], o.railRange[1]);
  }
  const setbackLabel = (n: number) => (n === 0 ? 'Inline' : n + ' mm');
</script>

<DetailToggle section="setup" />
<div class="scroll">
  <h2>Saddle</h2>
  <SliderField
    label="Saddle height" min={o.saddleHeightRange[0]} max={o.saddleHeightRange[1]} step={0.5}
    bind:value={app.current.saddleHeight} bind:locked={app.locks.saddleHeight} showLock={lv >= 2}
    delta={c.saddleHeight - b.saddleHeight} hint="BB centre to saddle top, along the seat tube" onedit={clearGhost}
  />
  <SliderField
    label="Setback to saddle nose" min={Math.ceil(sbRange[0] * 2) / 2} max={Math.floor(sbRange[1] * 2) / 2} step={0.5}
    bind:value={() => Math.round(setback * 2) / 2, setSetback} bind:locked={app.locks.railOffset} showLock={lv >= 2}
    delta={setbackDelta} hint="Plumb line from the saddle nose to the floor; distance behind the bottom bracket" onedit={clearGhost}
  />
  {#if lv >= 3}
    <p class="muted small rails">
      Rails: {c.railOffset === 0 ? 'centred' : Math.abs(c.railOffset) + ' mm ' + (c.railOffset > 0 ? 'forward' : 'back') + ' of centre'}
    </p>
  {/if}
  {#if lv >= 2}
    <SliderField
      label="Cleat position" unit="mm back" min={o.cleatRange[0]} max={o.cleatRange[1]} step={1}
      bind:value={app.current.cleatOffset} bind:locked={app.locks.cleatOffset}
      delta={c.cleatOffset - b.cleatOffset} hint="0 = pedal axle under the ball of the foot" onedit={clearGhost}
    />
    <div class="chiphead">
      <span>Seatpost setback</span>
      <label class="lk"><input type="checkbox" bind:checked={app.locks.seatpostSetback} /> Lock</label>
    </div>
    <ChipRow
      options={o.seatpostSetbacks} bind:value={app.current.seatpostSetback} disabled={app.locks.seatpostSetback}
      format={setbackLabel} onedit={clearGhost}
    />
  {/if}

  <h2>Cockpit</h2>
  <SliderField
    label="Spacers" min={0} max={frame.maxSpacers} step={o.spacerStep}
    bind:value={app.current.spacers} bind:locked={app.locks.spacers} showLock={lv >= 2}
    delta={c.spacers - b.spacers} onedit={clearGhost}
  />
  <div class="chiphead">
    <span>Stem length</span>
    {#if lv >= 2}<label class="lk"><input type="checkbox" bind:checked={app.locks.stemLength} /> Lock</label>{/if}
  </div>
  <ChipRow
    options={o.stemLengths} bind:value={app.current.stemLength} disabled={lv >= 2 && app.locks.stemLength}
    format={(n) => n + ' mm'} onedit={clearGhost}
  />
  <div class="chiphead">
    <span>Stem angle</span>
    {#if lv >= 2}<label class="lk"><input type="checkbox" bind:checked={app.locks.stemAngle} /> Lock</label>{/if}
  </div>
  <ChipRow
    options={o.stemAngles} bind:value={app.current.stemAngle} disabled={lv >= 2 && app.locks.stemAngle}
    format={(n) => (n === 0 ? '0°' : (n > 0 ? '+' : '−') + Math.abs(n) + '°')} onedit={clearGhost}
  />

  {#if lv >= 2}
    <h2>Drivetrain</h2>
    <div class="chiphead">
      <span>Crank length</span>
      <label class="lk"><input type="checkbox" bind:checked={app.locks.crankLength} /> Lock</label>
    </div>
    <ChipRow
      options={o.crankLengths} bind:value={app.current.crankLength} disabled={app.locks.crankLength}
      format={(n) => n + ' mm'} onedit={clearGhost}
    />
  {:else}
    <p class="muted small fixed">
      Cranks {c.crankLength} mm · cleats {c.cleatOffset} mm back · {c.seatpostSetback === 0 ? 'inline' : c.seatpostSetback + ' mm setback'} seatpost. Change these in Detailed.
    </p>
  {/if}

  {#if readouts.length}
    <div class="card readouts">
      <h2>Contact points</h2>
      <dl>
        {#each readouts as r (r.id)}<div><dt>{r.label}</dt><dd>{r.value}</dd></div>{/each}
      </dl>
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
      <div class="row">
        {#if ui.undo}<button type="button" class="btn small" onclick={undo}>Undo</button>{/if}
        <button type="button" class="btn small" onclick={markAsMine}>Mark as my setup</button>
      </div>
    </div>
  {:else if ui.notes && resultsLv >= 2}
    <div class="card changes">
      <h3>Result</h3>
      <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
    </div>
  {/if}
  {#if ui.error}<p class="err">{ui.error}</p>{/if}
</div>

<div class="actions">
  <button type="button" class="btn primary grow" disabled={ui.busy} onclick={optimize}>
    {#if ui.busy}<span class="spin"></span>Optimizing…{:else}Optimize{/if}
  </button>
  <button type="button" class="btn" disabled={!hasChanges} onclick={resetToBaseline}>Reset</button>
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .chiphead { display: flex; justify-content: space-between; align-items: center; min-height: 36px; font-weight: 600; }
  .lk { font-size: 12px; font-weight: 500; color: var(--muted); display: flex; gap: 6px; align-items: center; min-height: 36px; }
  .rails { margin: -4px 0 10px; }
  .fixed { margin-top: 18px; }
  .changes h2, .readouts h2 { margin-top: 0; }
  dl { margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--line); }
  dl div:last-child { border-bottom: 0; }
  dt { color: var(--muted); }
  dd { margin: 0; font-weight: 600; text-align: right; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 12px 0 6px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .row { display: flex; gap: 8px; margin-top: 12px; }
  .actions {
    display: flex; gap: 10px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line); background: var(--surface);
  }
  .grow { flex: 1; }
  .err { color: var(--off); }
</style>
