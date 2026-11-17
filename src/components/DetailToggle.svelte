<script lang="ts">
  import { LEVEL_OPTIONS, type Level } from '../lib/appData';
  import Segmented from './Segmented.svelte';

  let { value = $bindable(), label = 'Detail', ariaLabel }: { value: Level; label?: string; ariaLabel: string } = $props();
</script>

<div class="row">
  <span class="muted small">{label}</span>
  <Segmented
    options={LEVEL_OPTIONS} compact {ariaLabel}
    bind:value={() => String(value), (v) => (value = Number(v) as Level)}
  />
</div>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
  .row :global(.seg) { flex: 0 1 260px; }
</style>
