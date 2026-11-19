<script lang="ts" generics="T extends string">
  import Segmented from './Segmented.svelte';

  let { label, options, value = $bindable(), ariaLabel }: {
    label: string;
    options: { value: T; label: string; title?: string }[];
    value: T;
    ariaLabel: string;
  } = $props();
</script>

<div class="row">
  <span class="muted small">{label}</span>
  <Segmented {options} compact {ariaLabel} bind:value />
</div>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
  .row > span { white-space: nowrap; }
  .row :global(.seg) { flex: 0 1 260px; }
</style>
