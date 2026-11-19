<script lang="ts">
  let { items, ariaLabel }: {
    items: { label: string; onclick: () => void; disabled?: boolean }[];
    ariaLabel: string;
  } = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();

  function away(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
  function esc(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window onpointerdown={away} onkeydown={esc} />

<div class="menu" bind:this={root}>
  <button
    type="button" class="btn small trigger" aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open}
    onclick={() => (open = !open)}
  >⋯</button>
  {#if open}
    <div class="pop card" role="menu">
      {#each items as it (it.label)}
        <button
          type="button" role="menuitem" disabled={it.disabled}
          onclick={() => { open = false; it.onclick(); }}
        >{it.label}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu { position: relative; }
  .trigger { width: 44px; padding: 0; font-size: 18px; line-height: 1; }
  .pop { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 200px; margin: 0; padding: 6px; }
  .pop button {
    display: block; width: 100%; min-height: 40px; border: 0; background: transparent; border-radius: 8px;
    text-align: left; padding: 0 10px; font-weight: 600;
  }
  .pop button:hover:not(:disabled) { background: var(--surface-2); }
  .pop button:disabled { opacity: 0.45; cursor: default; }
</style>
