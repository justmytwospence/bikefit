<script lang="ts">
  import { wrenchList } from '../model/optimize';
  import { activeFrame, app, clearGhost, markAsMine, optimize, resetToBaseline, ui, undo } from '../state.svelte';
  import ChipRow from './ChipRow.svelte';
  import SliderField from './SliderField.svelte';

  const frame = $derived(activeFrame());
  const o = $derived(app.options);
  const c = $derived(app.current);
  const b = $derived(app.baseline);
  const changes = $derived(wrenchList($state.snapshot(b), $state.snapshot(c)));
  const hasChanges = $derived(changes[0] !== 'No changes from your current setup.');
  const atBase = $derived(!hasChanges);
</script>

<div class="scroll">
  <h2>Saddle</h2>
  <SliderField
    label="Saddle height" min={o.saddleHeightRange[0]} max={o.saddleHeightRange[1]} step={0.5}
    bind:value={app.current.saddleHeight} bind:locked={app.locks.saddleHeight}
    delta={c.saddleHeight - b.saddleHeight} hint="BB centre to saddle top, along the seat tube" onedit={clearGhost}
  />
  <SliderField
    label="Saddle fore/aft" min={o.railRange[0]} max={o.railRange[1]} step={1}
    bind:value={app.current.railOffset} bind:locked={app.locks.railOffset}
    delta={c.railOffset - b.railOffset} onedit={clearGhost}
  />
  <div class="chiphead">
    <span>Seatpost setback</span>
    <label class="lk"><input type="checkbox" bind:checked={app.locks.seatpostSetback} /> Lock</label>
  </div>
  <ChipRow
    options={o.seatpostSetbacks} bind:value={app.current.seatpostSetback} disabled={app.locks.seatpostSetback}
    format={(n) => (n === 0 ? 'Inline' : n + ' mm')} onedit={clearGhost}
  />

  <h2>Cockpit</h2>
  <SliderField
    label="Spacers" min={0} max={frame.maxSpacers} step={o.spacerStep}
    bind:value={app.current.spacers} bind:locked={app.locks.spacers}
    delta={c.spacers - b.spacers} onedit={clearGhost}
  />
  <div class="chiphead">
    <span>Stem length</span>
    <label class="lk"><input type="checkbox" bind:checked={app.locks.stemLength} /> Lock</label>
  </div>
  <ChipRow
    options={o.stemLengths} bind:value={app.current.stemLength} disabled={app.locks.stemLength}
    format={(n) => n + ' mm'} onedit={clearGhost}
  />
  <div class="chiphead">
    <span>Stem angle</span>
    <label class="lk"><input type="checkbox" bind:checked={app.locks.stemAngle} /> Lock</label>
  </div>
  <ChipRow
    options={o.stemAngles} bind:value={app.current.stemAngle} disabled={app.locks.stemAngle}
    format={(n) => (n === 0 ? '0°' : (n > 0 ? '+' : '−') + Math.abs(n) + '°')} onedit={clearGhost}
  />

  <h2>Drivetrain</h2>
  <div class="chiphead">
    <span>Crank length</span>
    <label class="lk"><input type="checkbox" bind:checked={app.locks.crankLength} /> Lock</label>
  </div>
  <ChipRow
    options={o.crankLengths} bind:value={app.current.crankLength} disabled={app.locks.crankLength}
    format={(n) => n + ' mm'} onedit={clearGhost}
  />

  {#if hasChanges}
    <div class="card changes">
      <h2>Changes from your setup</h2>
      <ul>{#each changes as line}<li>{line}</li>{/each}</ul>
      {#if ui.notes}
        <h3>Why it stops here</h3>
        <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
      {/if}
      <div class="row">
        {#if ui.undo}<button type="button" class="btn small" onclick={undo}>Undo</button>{/if}
        <button type="button" class="btn small" onclick={markAsMine}>Mark as my setup</button>
      </div>
    </div>
  {:else if ui.notes}
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
  <button type="button" class="btn" disabled={atBase} onclick={resetToBaseline}>Reset</button>
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .chiphead { display: flex; justify-content: space-between; align-items: center; min-height: 36px; font-weight: 600; }
  .lk { font-size: 12px; font-weight: 500; color: var(--muted); display: flex; gap: 6px; align-items: center; min-height: 36px; }
  .changes h2 { margin-top: 0; }
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
