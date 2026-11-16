<script lang="ts" generics="T extends string">
  let {
    options, value = $bindable(), ariaLabel, compact = false, onchange,
  }: {
    options: { value: T; label: string; title?: string }[];
    value: T;
    ariaLabel: string;
    compact?: boolean;
    onchange?: () => void;
  } = $props();

  function select(v: T) {
    value = v;
    onchange?.();
  }
  function key(e: KeyboardEvent) {
    const i = options.findIndex((o) => o.value === value);
    let n = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    select(options[n].value);
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=radio]')[n]?.focus();
  }
</script>

<div class="seg" class:compact role="radiogroup" aria-label={ariaLabel} tabindex="-1" onkeydown={key}>
  {#each options as o (o.value)}
    <button
      type="button" role="radio" aria-checked={value === o.value} title={o.title}
      tabindex={value === o.value ? 0 : -1} class:on={value === o.value} onclick={() => select(o.value)}
    >{o.label}</button>
  {/each}
</div>

<style>
  .seg { display: flex; background: var(--surface-2); border-radius: 12px; padding: 3px; gap: 2px; }
  button { flex: 1; border: 0; background: transparent; border-radius: 9px; min-height: 38px; padding: 0 12px; font-weight: 600; color: var(--muted); white-space: nowrap; }
  .compact button { min-height: 32px; padding: 0 6px; font-size: 14px; }
  .seg { min-width: 0; }
  button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgb(0 0 0 / 0.15); }
</style>
