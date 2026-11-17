<script lang="ts">
  import { noseSetback, railForSetback, setbackRange } from '../model/geometry';
  import { buildSummary, wrenchList } from '../model/optimize';
  import { contactReadouts } from '../model/readouts';
  import type { Evaluation, Layout } from '../model/types';
  import type { ParamKey } from '../model/types';
  import { clamp } from '../model/vec';
  import { CUSTOM_HINT, fixedSummary, KNOB_ORDER, PRESETS, presetLocks, presetOf, type Preset } from '../lib/knobs';
  import {
    activeFrame, app, clearGhost, markAsMine, optimize, resetToBaseline, setHasSetup, ui, undo, useSize, browseCatalog,
  } from '../state.svelte';
  import { sizeVerdictLine } from '../lib/sizes';
  import { STYLES } from '../model/styles';
  import { measure } from '../lib/measure';
  import ChipRow from './ChipRow.svelte';
  import Segmented from './Segmented.svelte';
  import SliderField from './SliderField.svelte';

  const starts = [
    { value: 'new' as const, label: 'New build' },
    { value: 'mine' as const, label: 'My current setup' },
  ];

  let { layout, evaluation }: { layout: Layout; evaluation: Evaluation } = $props();

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

  function setSetback(v: number) {
    app.current.railOffset = clamp(railForSetback(frame, app.components, c, v), o.railRange[0], o.railRange[1]);
  }
  const setbackLabel = (n: number) => (n === 0 ? 'Inline' : n + ' mm');

  const VERDICT_TEXT = { fits: 'fits', compromise: 'fits with compromises', no: 'does not fit' } as const;
  const preset = $derived(presetOf(app.locks));
  const presetHint = $derived(preset === 'custom' ? CUSTOM_HINT : PRESETS.find((p) => p.value === preset)!.hint);
  const GROUPS: { title: string; keys: ParamKey[] }[] = [
    { title: 'Saddle', keys: ['saddleHeight', 'railOffset', 'seatpostSetback'] },
    { title: 'Cockpit', keys: ['spacers', 'stemLength', 'stemAngle'] },
    { title: 'Cranks and cleats', keys: ['cleatOffset', 'crankLength'] },
  ];
  const fixed = $derived(KNOB_ORDER.filter((k) => app.locks[k]));
  const groups = $derived(
    GROUPS.map((g) => ({ title: g.title, keys: g.keys.filter((k) => !app.locks[k]) })).filter((g) => g.keys.length > 0),
  );
</script>

<div class="scroll">
  <Segmented
    options={starts} ariaLabel="Starting point"
    bind:value={() => (app.hasSetup ? 'mine' : 'new'), (v) => setHasSetup(v === 'mine')}
  />
  <p class="muted small start">
    {app.hasSetup
      ? 'Changes are counted from your setup. Optimize prefers adjustments over new parts.'
      : `No bike set up yet: Optimize picks the best build for this frame${frame.id.startsWith('cat:') ? ' and checks its other sizes' : ''}.`}
  </p>
  {#if !app.hasSetup}
    <button type="button" class="link" onclick={browseCatalog}>Browse all bikes that fit</button>
  {/if}
  <h2>What can you change?</h2>
  <Segmented
    options={PRESETS} ariaLabel="What you can change"
    bind:value={() => preset as Preset, (v) => Object.assign(app.locks, presetLocks(v))}
  />
  <p class="muted small start">{presetHint}</p>

  {#snippet knob(k: ParamKey)}
    {#if k === 'saddleHeight'}
      <div use:measure={'saddleHeight'}>
      <SliderField
        label="Saddle height" min={o.saddleHeightRange[0]} max={o.saddleHeightRange[1]} step={0.5}
        bind:value={app.current.saddleHeight} bind:locked={app.locks.saddleHeight}
        delta={app.hasSetup ? c.saddleHeight - b.saddleHeight : 0} hint="BB centre to saddle top, along the seat tube" onedit={clearGhost}
      />
      </div>
    {:else if k === 'railOffset'}
      <div use:measure={'setback'}>
      <SliderField
        label="Setback to saddle nose" min={Math.ceil(sbRange[0] * 2) / 2} max={Math.floor(sbRange[1] * 2) / 2} step={0.5}
        bind:value={() => Math.round(setback * 2) / 2, setSetback} bind:locked={app.locks.railOffset}
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
        <label class="lk"><input type="checkbox" bind:checked={app.locks.seatpostSetback} /> Fixed</label>
      </div>
      <ChipRow options={o.seatpostSetbacks} bind:value={app.current.seatpostSetback} format={setbackLabel} onedit={clearGhost} />
      </div>
    {:else if k === 'spacers'}
      <div use:measure={'spacers'}>
      <SliderField
        label="Spacers" min={0} max={frame.maxSpacers} step={o.spacerStep}
        bind:value={app.current.spacers} bind:locked={app.locks.spacers}
        delta={app.hasSetup ? c.spacers - b.spacers : 0} onedit={clearGhost}
      />
      </div>
    {:else if k === 'stemLength'}
      <div use:measure={'stem'}>
      <div class="chiphead">
        <span>Stem length</span>
        <label class="lk"><input type="checkbox" bind:checked={app.locks.stemLength} /> Fixed</label>
      </div>
      <ChipRow options={o.stemLengths} bind:value={app.current.stemLength} format={(n) => n + ' mm'} onedit={clearGhost} />
      </div>
    {:else if k === 'stemAngle'}
      <div use:measure={'stem'}>
      <div class="chiphead">
        <span>Stem angle</span>
        <label class="lk"><input type="checkbox" bind:checked={app.locks.stemAngle} /> Fixed</label>
      </div>
      <ChipRow
        options={o.stemAngles} bind:value={app.current.stemAngle}
        format={(n) => (n === 0 ? '0°' : (n > 0 ? '+' : '−') + Math.abs(n) + '°')} onedit={clearGhost}
      />
      </div>
    {:else if k === 'cleatOffset'}
      <div use:measure={'cleat'}>
      <SliderField
        label="Cleat position" unit="mm back" min={o.cleatRange[0]} max={o.cleatRange[1]} step={1}
        bind:value={app.current.cleatOffset} bind:locked={app.locks.cleatOffset}
        delta={app.hasSetup ? c.cleatOffset - b.cleatOffset : 0} hint="0 = pedal axle under the ball of the foot" onedit={clearGhost}
      />
      </div>
    {:else if k === 'crankLength'}
      <div use:measure={'crank'}>
      <div class="chiphead">
        <span>Crank length</span>
        <label class="lk"><input type="checkbox" bind:checked={app.locks.crankLength} /> Fixed</label>
      </div>
      <ChipRow options={o.crankLengths} bind:value={app.current.crankLength} format={(n) => n + ' mm'} onedit={clearGhost} />
      </div>
    {/if}
  {/snippet}

  {#each groups as g (g.title)}
    <h2>{g.title}</h2>
    {#each g.keys as k (k)}{@render knob(k)}{/each}
  {/each}

  {#if fixed.length}
    <details class="card fixed">
      <summary><b>Stays as it is</b><span class="muted small">{fixedSummary(fixed, c, setback)}</span></summary>
      {#each fixed as k (k)}{@render knob(k)}{/each}
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

  {#snippet verdictLine()}
    {#if ui.verdict === 'fits'}<p class="verdict ok">Fits</p>
    {:else if ui.verdict === 'compromise'}<p class="verdict near">Fits with compromises{ui.flags.length ? ': ' + ui.flags.join('; ') : ''}</p>
    {:else if ui.verdict === 'no'}<p class="verdict off">Does not fit the {STYLES[app.styleId].name} style</p>{/if}
  {/snippet}

  {#if !app.hasSetup && ui.verdict}
    <div class="card changes">
      <h2>Suggested build</h2>
      <p>Saddle height {c.saddleHeight} mm</p>
      <p>{buildSummary(c, resultsLv >= 2)}</p>
      {@render verdictLine()}
      {#if ui.sizes}
        <h3>Sizes</h3>
        <div class="sizes" role="group" aria-label="Sizes">
          {#each ui.sizes.options as o (o.frame.id)}
            {@const r = ui.sizes.rows.find((x) => x.frameId === o.frame.id)!}
            <button
              type="button" class="sz {r.result.verdict}" class:on={o.frame.id === app.activeFrameId}
              aria-pressed={o.frame.id === app.activeFrameId} aria-label="Size {o.size}: {VERDICT_TEXT[r.result.verdict]}"
              title={VERDICT_TEXT[r.result.verdict]} onclick={() => useSize(o.frame.id)}
            >{o.size}</button>
          {/each}
        </div>
        <p class="small">{sizeVerdictLine(ui.sizes.rows, app.activeFrameId, (id) => ui.sizes!.options.find((o) => o.frame.id === id)!.size)}</p>
      {/if}
      {#if ui.notes && resultsLv >= 2}
        <h3>Why it stops here</h3>
        <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
      {/if}
      <div class="row">
        {#if ui.undo}<button type="button" class="btn small" onclick={undo}>Undo</button>{/if}
        <button type="button" class="btn small" onclick={() => setHasSetup(true)}>Mark as my setup</button>
      </div>
    </div>
  {:else if app.hasSetup && hasChanges}
    <div class="card changes">
      <h2>Changes from your setup</h2>
      <ul>{#each changes as line}<li>{line}</li>{/each}</ul>
      {#if ui.notes && resultsLv >= 2}
        <h3>Why it stops here</h3>
        <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
      {/if}
      {@render verdictLine()}
      <div class="row">
        {#if ui.undo}<button type="button" class="btn small" onclick={undo}>Undo</button>{/if}
        <button type="button" class="btn small" onclick={markAsMine}>Mark as my setup</button>
      </div>
    </div>
  {:else if ui.notes && resultsLv >= 2}
    <div class="card changes">
      <h3>Result</h3>
      <ul class="muted">{#each ui.notes as n}<li>{n}</li>{/each}</ul>
      {@render verdictLine()}
    </div>
  {/if}
  {#if ui.error}<p class="err">{ui.error}</p>{/if}
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
  .lk { font-size: 12px; font-weight: 500; color: var(--muted); display: flex; gap: 6px; align-items: center; min-height: 36px; }
  .rails { margin: -4px 0 10px; }
  .start { margin-top: 6px; }
  .sizes { display: flex; flex-wrap: wrap; gap: 6px; }
  .sz { min-width: 44px; min-height: 36px; border-radius: 10px; border: 2px solid transparent; font-weight: 700; background: var(--surface-2); }
  .sz.fits { color: var(--ok); }
  .sz.compromise { color: var(--near); }
  .sz.no { color: var(--off); }
  .sz.on { border-color: currentColor; background: var(--surface); }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 600; padding: 8px 0; min-height: 36px; }
  .fixed { margin-top: 18px; }
  .fixed summary { cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; }
  .fixed summary b::after { content: ' ▾'; color: var(--muted); }
  .fixed[open] summary b::after { content: ' ▴'; }
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
  .verdict { margin: 12px 0 0; font-weight: 600; }
  .verdict.ok { color: var(--ok); }
  .verdict.near { color: var(--near); }
  .verdict.off { color: var(--off); }
</style>
