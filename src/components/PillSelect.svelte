<script lang="ts" generics="T extends string">
  let { label, options, value = $bindable(), ariaLabel }: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    ariaLabel: string;
  } = $props();
  const current = $derived(options.find((o) => o.value === value)?.label ?? '');
</script>

<!-- A small pill over the drawing; the native select underneath opens the choices. -->
<label class="pill">
  <span class="k">{label}</span>
  <span class="v">{current} <span aria-hidden="true">▾</span></span>
  <select aria-label={ariaLabel} bind:value>
    {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
  </select>
</label>

<style>
  .pill {
    position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px;
    border-radius: 999px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow);
    font-size: 13px; cursor: pointer;
  }
  .pill:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  .k { color: var(--muted); }
  .v { font-weight: 600; white-space: nowrap; }
  select { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 0; opacity: 0; cursor: pointer; }
</style>
