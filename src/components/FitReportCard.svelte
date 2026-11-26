<script lang="ts">
  import { event } from '../lib/analytics';
  import { forwardLayout } from '../model/geometry';
  import { offsetText, reportInseam, reportPosition } from '../model/fitReport';
  import { lengthField, toDisplay } from '../lib/units';
  import type { FitParams } from '../model/types';
  import { activeFrame, addReport, app, applyReport, fittedNow, removeReport } from '../state.svelte';
  import NumberField from './NumberField.svelte';

  /** The numbers off a professional fit report, to set the active bike from or to aim at. */
  const r = $derived(app.report);
  const frame = $derived(activeFrame());
  const summary = $derived(
    r ? `${r.label || 'Your fit'} · saddle ${r.saddleHeight} mm · hoods ${r.gripReach} mm out, ${r.gripDrop} mm` : 'None entered',
  );
  const fitted = $derived(fittedNow());
  const inseamF = $derived(lengthField(app.units, 'cm', 600, 1050));
  const show = (mm: number) => `${toDisplay(mm, inseamF)} ${inseamF.unit}`;
  const suggestedInseam = $derived(
    fitted?.problem === 'pedal' && r ? reportInseam($state.snapshot(r), $state.snapshot(app.body), app.components, app.effort ?? 'tempo') : null,
  );
  function aim() {
    app.styleId = 'fitted';
    event('Style chosen', { style: 'fitted' });
  }
  function matchInseam() {
    if (suggestedInseam === null) return;
    app.body.inseam = suggestedInseam;
    event('Inseam matched');
  }
  const onThisBike = $derived.by(() => {
    if (!r) return '';
    const pos = reportPosition($state.snapshot(r), app.components);
    const L = forwardLayout(frame, app.components, $state.snapshot(app.baseline) as FitParams);
    return `On ${frame.name}: saddle ${offsetText({ x: L.saddle.x - pos.saddle.x, y: L.saddle.y - pos.saddle.y })}, hoods ${offsetText({ x: L.hoods.x - pos.hoods.x, y: L.hoods.y - pos.hoods.y })}.`;
  });
</script>

<details class="card sec" bind:open={app.riderOpen.report}>
  <summary><b>Fit report</b><span class="muted small">{summary}</span></summary>
  {#if !r}
    <p class="muted small">Type in the numbers from a professional fit (they are named as on a Retül report) to set a bike from them or aim at that position.</p>
    <button type="button" class="btn small" onclick={addReport}>Add a fit report</button>
  {:else}
    <label class="name">
      <span>Fitter and date</span>
      <input type="text" bind:value={app.report!.label} />
    </label>
    <div class="two">
      <NumberField label="Saddle height" unit="mm" min={500} max={950} step={1} hint="BB centre to the middle of the saddle top (Saddle Height)" bind:value={app.report!.saddleHeight} />
      <NumberField label="Seat angle" unit="°" min={65} max={80} step={0.1} hint="BB centre to the middle of the saddle top, from horizontal (Eff. Seat Tube Angle)" bind:value={app.report!.seatAngle} />
      <NumberField label="Saddle setback" unit="mm" min={-150} max={50} step={1} hint="BB centre to the saddle nose, horizontally; negative when the nose is behind the BB (Saddle Setback)" bind:value={app.report!.saddleSetback} />
      <NumberField label="Saddle angle" unit="°" min={-15} max={10} step={0.5} hint="+ nose up, − nose down (Saddle Angle)" bind:value={app.report!.saddleAngle} />
      <NumberField label="Hoods reach" unit="mm" min={350} max={750} step={1} hint="BB centre forward to the trough of the hoods (BB to Grip Reach)" bind:value={app.report!.gripReach} />
      <NumberField label="Hoods drop" unit="mm" min={-250} max={100} step={1} hint="Middle of the saddle top down to the trough of the hoods; negative when lower (Grip Drop)" bind:value={app.report!.gripDrop} />
      <NumberField label="Crank length" unit="mm" min={145} max={180} step={2.5} bind:value={app.report!.crankLength} />
    </div>
    <p class="muted small">{onThisBike}</p>
    {#if fitted?.style}
      {#if app.styleId === 'fitted'}
        <p class="muted small">Every target and Find a bike now aim at this position (My fit).</p>
      {:else}
        <p><button type="button" class="btn small primary" onclick={aim}>Aim at this position</button></p>
      {/if}
    {:else if fitted?.problem === 'pedal'}
      <p class="warn small">
        With a {show(app.body.inseam)} inseam your foot could not reach the pedal in this position.
        {#if suggestedInseam !== null}The fit suggests an inseam near {show(suggestedInseam)}.{/if}
      </p>
      {#if suggestedInseam !== null}<p><button type="button" class="btn small primary" onclick={matchInseam}>Set inseam to {show(suggestedInseam)}</button></p>{/if}
    {:else if fitted?.problem === 'bars'}
      <p class="warn small">In this position the hoods are out of reach for your arm and torso lengths: check the hoods numbers or your arm length.</p>
    {/if}
    <div class="row">
      <button type="button" class="btn small" onclick={() => applyReport('current')}>Enter as my current setup</button>
      <button type="button" class="btn small" onclick={() => applyReport('target')}>Make it the target</button>
      <button type="button" class="relink" onclick={removeReport}>Remove</button>
    </div>
  {/if}
</details>

<style>
  .sec { margin-bottom: 10px; }
  .sec summary { cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; list-style: none; }
  .sec summary::-webkit-details-marker { display: none; }
  .sec summary b::after { content: ' ▾'; color: var(--muted); }
  .sec[open] summary b::after { content: ' ▴'; }
  .sec[open] summary { margin-bottom: 8px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .name { display: block; margin-bottom: 12px; font-weight: 600; font-size: 13px; }
  .name span { display: block; margin-bottom: 4px; }
  .warn { padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--near) 15%, var(--surface)); }
  .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .relink { border: 0; background: transparent; color: var(--accent); font-weight: 600; font-size: 12px; padding: 0 6px; min-height: 28px; }
</style>
