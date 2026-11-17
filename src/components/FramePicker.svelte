<script lang="ts">
  import { onMount } from 'svelte';
  import type { CatalogModel, FrameCategory } from '../data/catalog';
  import { addCatalogFrame, addCatalogModel, app } from '../state.svelte';
  import Segmented from './Segmented.svelte';

  let { onclose }: { onclose: () => void } = $props();

  type Cat = typeof import('../data/catalog');
  type Search = typeof import('../data/search');
  let cat = $state.raw<Cat | null>(null);
  let search = $state.raw<Search | null>(null);
  let query = $state('');
  let category = $state<'all' | FrameCategory>('all');
  let limit = $state(40);
  let openId = $state<string | null>(null);
  let added = $state<{ id: string; n: number } | null>(null);

  onMount(async () => {
    const [c, s] = await Promise.all([import('../data/catalog'), import('../data/search')]);
    cat = c;
    search = s;
  });

  const hits = $derived(cat && search ? search.searchCatalog(cat.CATALOG, query, category) : []);
  const groups = $derived(search ? search.groupByBrand(hits.slice(0, limit)) : []);
  const range = $derived(cat ? cat.retrievedRange(cat.CATALOG) : ['', '']);
  const label = (m: CatalogModel) => cat!.CATEGORIES.find((c) => c.value === m.category)!.label;
  const saved = (m: CatalogModel, size: string) => app.frames.some((f) => f.id === cat!.frameId(m, size));

  $effect(() => {
    query; category;
    limit = 40;
  });

  function pick(m: CatalogModel, size: string) {
    addCatalogFrame(cat!.toFrame(m, m.sizes.find((s) => s.size === size)!));
    onclose();
  }
  function addAll(m: CatalogModel) {
    added = { id: m.id, n: addCatalogModel(m.sizes.map((s) => cat!.toFrame(m, s))) };
  }
</script>

{#if !cat || !search}
  <p class="muted">Loading frames…</p>
{:else}
  <!-- svelte-ignore a11y_autofocus -->
  <input type="search" placeholder="Search brand, model, year or size" aria-label="Search frames" bind:value={query} autofocus />
  <div class="cat">
    <Segmented compact ariaLabel="Category" options={[{ value: 'all', label: 'All' }, ...cat.CATEGORIES]} bind:value={category} />
  </div>

  {#each groups as g (g.brand)}
    <h3>{g.brand}</h3>
    {#each g.hits as h (h.model.id)}
      {@const m = h.model}
      {@const open = openId === m.id || h.size !== null}
      <button type="button" class="row" aria-expanded={open} onclick={() => { openId = openId === m.id ? null : m.id; added = null; }}>
        <b>{m.model}</b>
        <span class="muted small">{cat!.yearLabel(m)} · {label(m)} · {m.sizes.length} sizes</span>
      </button>
      {#if open}
        <div class="open">
          <div class="chips">
            {#each m.sizes as s (s.size)}
              <button type="button" class:on={saved(m, s.size)} class:match={h.size === s.size && !saved(m, s.size)} onclick={() => pick(m, s.size)}>{s.size}</button>
            {/each}
          </div>
          <button type="button" class="btn small" onclick={() => addAll(m)}>Add all sizes</button>
          {#if added?.id === m.id}
            <span class="muted small">{added.n ? `Added ${added.n} sizes` : 'All sizes already saved'}</span>
          {/if}
          <div class="muted small">
            <a href={m.source} target="_blank" rel="noopener">Source</a>
            {#if m.estimated.length}· Estimated: {m.estimated.join(', ')}{/if}
          </div>
        </div>
      {/if}
    {/each}
  {:else}
    <p class="muted">No frames match. Try a brand or model name.</p>
  {/each}

  {#if hits.length > limit}
    <button type="button" class="btn small" onclick={() => (limit += 40)}>Show more</button>
  {/if}
  <p class="muted small foot">Geometry from manufacturer tables, retrieved {range[0]} to {range[1]}. Check the brand's site before you buy. Max spacers and tyre width are typical for the category, not the manufacturer's figures.</p>
  <button type="button" class="btn small" onclick={onclose}>Done</button>
{/if}

<style>
  .cat { margin: 10px 0 4px; overflow-x: auto; }
  h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .row {
    display: flex; justify-content: space-between; align-items: baseline; gap: 8px; width: 100%;
    min-height: 44px; padding: 6px 10px; border: 0; border-radius: 10px; background: transparent; text-align: left;
  }
  .row:hover { background: var(--surface-2); }
  .open { padding: 4px 10px 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
  .chips button { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); font-weight: 600; }
  .chips button.match { border-color: var(--accent); color: var(--accent); }
  .chips button.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .foot { margin-top: 14px; }
</style>
