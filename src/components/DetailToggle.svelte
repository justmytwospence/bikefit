<script lang="ts">
  import { level, type Level } from '../lib/appData';
  import { app, setGlobalDetail } from '../state.svelte';
  import Segmented from './Segmented.svelte';

  const options = [
    { value: '1', label: 'Simple' },
    { value: '2', label: 'Detailed' },
    { value: '3', label: 'Expert' },
  ];
</script>

<div class="row">
  <span class="muted small">Detail</span>
  <Segmented
    {options} compact ariaLabel="Detail level"
    bind:value={() => String(level(app)), (v) => setGlobalDetail(Number(v) as Level)}
  />
</div>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
  .row :global(.seg) { flex: 0 1 260px; }
</style>
