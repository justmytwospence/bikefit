<script lang="ts">
  import { onMount } from 'svelte';
  import { catalogModelFor } from '../lib/sizes';
  import {
    activeFrame, addCatalogFrame, app, deleteFrame, duplicateFrame, newFrame, selectFrame,
  } from '../state.svelte';
  import FramePicker from './FramePicker.svelte';
  import NumberField from './NumberField.svelte';
  import type { Frame } from '../model/types';

  let picking = $state(false);
  const full = $derived(app.detail.bikeFull);
  const frame = $derived(activeFrame());
  const o = $derived(app.options);
  /** One entry per bike: a catalog model with its saved sizes, or a frame of your own. */
  const bikes = $derived.by(() => {
    const out: { key: string; label: string; frames: { id: string; size: string }[] }[] = [];
    for (const f of app.frames) {
      const cut = f.name.lastIndexOf(' · ');
      if (!f.id.startsWith('cat:') || cut < 0) {
        out.push({ key: 'f:' + f.id, label: f.name, frames: [{ id: f.id, size: '' }] });
        continue;
      }
      const label = f.name.slice(0, cut);
      let g = out.find((x) => x.key === 'm:' + label);
      if (!g) out.push((g = { key: 'm:' + label, label, frames: [] }));
      g.frames.push({ id: f.id, size: f.name.slice(cut + 3) });
    }
    return out;
  });
  const bike = $derived(bikes.find((b) => b.frames.some((f) => f.id === app.activeFrameId)) ?? bikes[0]);
  const isCatalog = $derived(frame.id.startsWith('cat:'));

  // The catalog loads lazily so unsaved sizes of the current model can be offered too.
  type Cat = typeof import('../data/catalog');
  let cat = $state.raw<Cat | null>(null);
  onMount(async () => {
    cat = await import('../data/catalog');
  });
  const model = $derived(cat && isCatalog ? catalogModelFor(frame.id, cat.CATALOG) : null);
  /** Sizes for the size picker: every catalog size when known, else the saved ones. */
  const sizes = $derived(
    model && cat
      ? model.sizes.map((s) => ({ id: cat!.frameId(model, s.size), size: s.size }))
      : isCatalog ? bike.frames : [],
  );

  function pickBike(key: string) {
    const b = bikes.find((x) => x.key === key);
    if (b && !b.frames.some((f) => f.id === app.activeFrameId)) selectFrame(b.frames[0].id);
  }
  function pickSize(id: string) {
    if (app.frames.some((f) => f.id === id)) return selectFrame(id);
    const s = model?.sizes.find((x) => cat!.frameId(model, x.size) === id);
    if (model && s) addCatalogFrame(cat!.toFrame(model, s));
  }
  const list = (a: number[], u: string) => a.map((x) => x + u).join(', ');
</script>

<div class="scroll">
  <h2>Bike</h2>
  <div class="pick" class:solo={!sizes.length}>
    <label>
      <span>Model</span>
      <select value={bike.key} onchange={(e) => pickBike(e.currentTarget.value)}>
        {#each bikes as b (b.key)}<option value={b.key}>{b.label}</option>{/each}
      </select>
    </label>
    {#if sizes.length}
      <label>
        <span>Size</span>
        <select value={app.activeFrameId} onchange={(e) => pickSize(e.currentTarget.value)}>
          {#each sizes as s (s.id)}<option value={s.id}>{s.size}</option>{/each}
        </select>
      </label>
    {/if}
  </div>
  <div class="btns">
    <button type="button" class="btn small" onclick={() => (picking = !picking)}>Find a bike</button>
    <button type="button" class="btn small" onclick={duplicateFrame}>Duplicate</button>
    <button type="button" class="btn small" onclick={newFrame}>New</button>
    <button type="button" class="btn small" disabled={app.frames.length <= 1} onclick={() => deleteFrame(frame.id)}>Delete</button>
  </div>
  {#if picking}<div class="card picker"><FramePicker onclose={() => (picking = false)} /></div>{/if}

  <h2>Frame geometry</h2>
  {#key frame.id}
    {#if !isCatalog}
      <label class="name">
        <span>Name</span>
        <input type="text" bind:value={frame.name} />
      </label>
    {/if}
    <div class="grid">
      <NumberField label="Stack" unit="mm" min={400} max={800} step={1} bind:value={frame.stack} />
      <NumberField label="Reach" unit="mm" min={300} max={500} step={1} bind:value={frame.reach} />
      {#if full}
        <NumberField label="Seat tube angle" unit="°" min={65} max={80} step={0.1} bind:value={frame.seatTubeAngle} />
        <NumberField label="Head tube angle" unit="°" min={65} max={80} step={0.1} bind:value={frame.headTubeAngle} />
        <NumberField label="Head tube length" unit="mm" min={80} max={260} step={1} bind:value={frame.headTubeLength} />
        <NumberField label="Seat tube length" unit="mm" min={330} max={650} step={1} bind:value={frame.seatTubeLength} />
        <NumberField label="Chainstay" unit="mm" min={380} max={470} step={1} bind:value={frame.chainstay} />
        <NumberField label="Wheelbase" unit="mm" min={900} max={1200} step={1} bind:value={frame.wheelbase} />
        <NumberField label="BB drop" unit="mm" min={40} max={90} step={1} bind:value={frame.bbDrop} />
        <NumberField label="Max spacers" unit="mm" min={0} max={80} step={5} hint="Steerer room above the headset. Catalog frames use a typical value for their category; check yours." bind:value={frame.maxSpacers} />
        <NumberField label="Tyre width" unit="mm" min={23} max={60} step={1} hint="Catalog frames use a typical width for their category." bind:value={frame.tyreWidth} />
      {/if}
    </div>
  {/key}
  <button type="button" class="link" onclick={() => (app.detail.bikeFull = !app.detail.bikeFull)}>
    {full ? 'Show fewer measurements' : 'Show all measurements'}
  </button>

  {#if full}
    <h2>Cockpit and saddle</h2>
    <div class="grid">
      <NumberField label="Bar reach" unit="mm" min={60} max={110} step={1} bind:value={app.components.barReach} />
      <NumberField label="Bar drop" unit="mm" min={100} max={160} step={1} bind:value={app.components.barDrop} />
      <NumberField label="Saddle length" unit="mm" min={230} max={300} step={1} hint="Tip to tail; short-nose saddles are about 245" bind:value={app.components.saddleLength} />
    </div>
  {/if}

  {#if full}
    <h2>Contact details</h2>
    <div class="grid">
      <NumberField label="Shoe + pedal stack" unit="mm" min={5} max={40} step={1} bind:value={app.components.footStack} />
      <NumberField label="Headset cap" unit="mm" min={0} max={30} step={1} bind:value={app.components.headsetCap} />
      <NumberField label="Hood reach" unit="mm" min={0} max={50} step={1} bind:value={app.components.hoodReach} />
      <NumberField label="Hood rise" unit="mm" min={0} max={50} step={1} bind:value={app.components.hoodRise} />
    </div>

    <h2>Parts the optimizer may choose</h2>
    <div class="card small">
      <div><b>Stem length</b> {list(o.stemLengths, '')} mm</div>
      <div><b>Stem angle</b> {list(o.stemAngles, '°')}</div>
      <div><b>Cranks</b> {list(o.crankLengths, '')} mm</div>
      <div><b>Seatpost setback</b> {list(o.seatpostSetbacks, '')} mm</div>
      <p class="muted" style="margin:8px 0 0">Defaults cover common parts.</p>
    </div>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 600; padding: 8px 0; min-height: 36px; }
  .pick { display: grid; grid-template-columns: minmax(0, 1fr) 96px; gap: 10px; }
  .pick.solo { grid-template-columns: minmax(0, 1fr); }
  .pick label { display: block; font-weight: 600; font-size: 13px; min-width: 0; }
  .pick span { display: block; margin-bottom: 4px; }
  .pick select { width: 100%; }
  .picker { margin-top: 12px; }
  .btns { display: flex; gap: 8px; margin-top: 10px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 0 10px; }
  @media (min-width: 420px) { .grid { grid-template-columns: 1fr 1fr; } }
  .name { display: block; margin-bottom: 12px; font-weight: 600; font-size: 13px; }
  .name span { display: block; margin-bottom: 4px; }
</style>
