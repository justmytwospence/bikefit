<script lang="ts">
  import { onMount } from 'svelte';
  import { catalogModelFor } from '../lib/sizes';
  import { addCatalogFrame, deleteFrame, duplicateFrame, newFrame, selectFrame } from '../frames';
  import { activeFrame, app } from '../state.svelte';
  import FramePicker from './FramePicker.svelte';
  import MoreMenu from './MoreMenu.svelte';

  let picking = $state(false);
  const frame = $derived(activeFrame());
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
</script>

<h2>Bike</h2>
<div class="pick" class:solo={!sizes.length}>
  {#if bikes.length > 1}
    <label>
      <span>Model</span>
      <select value={bike.key} onchange={(e) => pickBike(e.currentTarget.value)}>
        {#each bikes as b (b.key)}<option value={b.key}>{b.label}</option>{/each}
      </select>
    </label>
  {:else}
    <!-- A dropdown with one entry only pops up over itself; show the name instead. -->
    <div class="field">
      <span>Model</span>
      <div class="name" title={bike.label}>{bike.label}</div>
    </div>
  {/if}
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
  <button type="button" class="btn small grow" onclick={() => (picking = !picking)}>Choose from catalog</button>
  <MoreMenu
    ariaLabel="More bike actions"
    items={[
      { label: 'Duplicate this bike', onclick: duplicateFrame },
      { label: 'New frame of my own', onclick: newFrame },
      { label: 'Delete this bike', onclick: () => deleteFrame(frame.id), disabled: app.frames.length <= 1 },
    ]}
  />
</div>
{#if picking}<div class="card picker"><FramePicker onclose={() => (picking = false)} /></div>{/if}

<style>
  .pick { display: grid; grid-template-columns: minmax(0, 1fr) 96px; gap: 10px; }
  .pick.solo { grid-template-columns: minmax(0, 1fr); }
  .pick label, .pick .field { display: block; font-weight: 600; font-size: 13px; min-width: 0; }
  .name {
    height: 44px; line-height: 44px; padding: 0 12px; border-radius: 12px;
    background: var(--surface-2); font-size: 15px; font-weight: 400;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pick span { display: block; margin-bottom: 4px; }
  .pick select { width: 100%; }
  .picker { margin-top: 12px; }
  .btns { display: flex; gap: 8px; margin-top: 10px; }
  .grow { flex: 1; }
</style>
