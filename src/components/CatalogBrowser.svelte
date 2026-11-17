<script lang="ts">
  import { onMount } from 'svelte';
  import type { FrameCategory } from '../data/catalog';
  import { groupRows } from '../lib/sizes';
  import { VERDICT_RANK, type Verdict } from '../model/optimize';
  import { app, catalogKey, hasCachedCatalog, runCatalogFit, ui, useCatalogRow } from '../state.svelte';
  import FrameCard from './FrameCard.svelte';
  import Segmented from './Segmented.svelte';

  type Cat = typeof import('../data/catalog');
  type Search = typeof import('../data/search');
  let cat = $state.raw<Cat | null>(null);
  let search = $state.raw<Search | null>(null);
  let query = $state('');
  let category = $state<'all' | FrameCategory>('all');
  let brand = $state('all');
  let show = $state<Verdict>('compromise');
  let limit = $state(30);
  let since = $state(0);

  onMount(async () => {
    const [c, s] = await Promise.all([import('../data/catalog'), import('../data/search')]);
    cat = c;
    search = s;
  });

  const shows = [
    { value: 'fits' as Verdict, label: 'Fits' },
    { value: 'compromise' as Verdict, label: '+ Compromises' },
    { value: 'no' as Verdict, label: 'All' },
  ];
  const brands = $derived(
    cat ? [...new Set(cat.CATALOG.map((m) => m.brand))].sort((a, b) => a.localeCompare(b, 'en')) : [],
  );
  const hitIds = $derived(
    cat && search ? new Set(search.searchCatalog(cat.CATALOG, query, category).map((h) => h.model.id)) : new Set<string>(),
  );
  const byId = $derived(new Map((cat?.CATALOG ?? []).map((m) => [m.id, m])));
  const all = $derived(
    ui.catalog
      ? groupRows(ui.catalog.rows, ui.catalog.frames).sort((a, b) => a.best.result.cost - b.best.result.cost)
      : [],
  );
  const matching = $derived(
    all.filter((g) => {
      const id = ui.catalog!.modelOf[g.best.frameId];
      const m = byId.get(id);
      return !!m && hitIds.has(id) && (brand === 'all' || m.brand === brand) && m.lastYear >= since
        && VERDICT_RANK[g.best.result.verdict] <= VERDICT_RANK[show];
    }),
  );
  const stale = $derived(!!ui.catalog && !ui.catalog.running && ui.catalog.key !== catalogKey());
  const withCleats = $derived(app.detail.results >= 2);

  $effect(() => {
    if (stale && hasCachedCatalog(catalogKey())) void runCatalogFit();
  });

  $effect(() => {
    query; category; brand; show; since;
    limit = 30;
  });
</script>

<p class="muted">Checks every bike in the catalog for your body and this style, and ranks them by fit score. Parts you marked as fixed in Fit stay as they are.</p>
{#if !ui.catalog || stale}
  <button type="button" class="btn primary full" disabled={ui.catalog?.running} onclick={runCatalogFit}>
    {ui.catalog ? 'Check again' : 'Find bikes that fit'}
  </button>
{/if}
{#if ui.catalog?.running}
  <p class="muted small">Checking {ui.catalog.done} of {ui.catalog.total} models…</p>
  <progress max={ui.catalog.total} value={ui.catalog.done}></progress>
{/if}
{#if ui.error}<p class="err">{ui.error}</p>{/if}
{#if stale}<p class="stale">Out of date, check again.</p>{/if}

{#if ui.catalog && cat}
  <input type="search" placeholder="Search brand, model or year" aria-label="Search bikes" bind:value={query} />
  <div class="filters">
    <select aria-label="Brand" bind:value={brand}>
      <option value="all">All brands</option>
      {#each brands as b (b)}<option value={b}>{b}</option>{/each}
    </select>
    <select aria-label="Model year" bind:value={since}>
      <option value={0}>Any year</option>
      {#each [2026, 2025, 2024, 2022, 2020] as y (y)}<option value={y}>{y} or newer</option>{/each}
    </select>
    <div class="scrollx">
      <Segmented compact ariaLabel="Category" options={[{ value: 'all', label: 'All' }, ...cat.CATEGORIES]} bind:value={category} />
    </div>
    <Segmented compact ariaLabel="Verdicts shown" options={shows} bind:value={show} />
  </div>
  <p class="muted small">{matching.length} bikes</p>
  <div class="list" class:dim={stale}>
    {#each matching.slice(0, limit) as g (g.key)}
      <FrameCard group={g} {withCleats} showScore onuse={useCatalogRow} />
    {:else}
      <p class="muted">{ui.catalog.running ? 'Still checking…' : 'No bikes match these filters.'}</p>
    {/each}
  </div>
  {#if matching.length > limit}
    <button type="button" class="btn small" onclick={() => (limit += 30)}>Show more</button>
  {/if}
{/if}
<p class="muted small foot">Each model's sizes are checked outward from the one nearest your ideal bar position, until they stop fitting.</p>

<style>
  .full { width: 100%; }
  progress { width: 100%; }
  input[type='search'] { width: 100%; margin-top: 12px; }
  .filters { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
  .scrollx { overflow-x: auto; }
  .list { margin-top: 8px; }
  .dim { opacity: 0.5; }
  .foot { margin-top: 14px; }
  .stale { color: var(--muted); background: var(--surface-2); padding: 8px 12px; border-radius: 10px; margin-top: 12px; }
  .err { color: var(--off); }
</style>
