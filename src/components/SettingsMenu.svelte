<script lang="ts">
  import type { Level } from '../lib/appData';
  import { app, setGlobalDetail } from '../state.svelte';
  import Segmented from './Segmented.svelte';

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  const options = [
    { value: '1', label: 'Simple' },
    { value: '2', label: 'Detailed' },
    { value: '3', label: 'Expert' },
  ];

  function away(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
  function esc(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window onpointerdown={away} onkeydown={esc} />

<div class="menu" bind:this={root}>
  <button type="button" class="gear" aria-label="Detail level settings" aria-expanded={open} onclick={() => (open = !open)}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="2" fill="var(--surface)" /><circle cx="15" cy="12" r="2" fill="var(--surface)" /><circle cx="8" cy="17" r="2" fill="var(--surface)" />
    </svg>
  </button>
  {#if open}
    <div class="pop card">
      <h2>Detail level</h2>
      <Segmented
        {options} ariaLabel="Detail level"
        bind:value={() => String(app.detail.global), (v) => setGlobalDetail(Number(v) as Level)}
      />
      <p class="muted small">Sets every section. Each tab can still go deeper.</p>
    </div>
  {/if}
</div>

<style>
  .menu { position: relative; }
  .gear { width: 44px; height: 44px; border: 0; background: transparent; border-radius: 12px; display: grid; place-items: center; color: var(--muted); }
  .pop { position: absolute; right: 0; top: 48px; width: 280px; z-index: 20; margin: 0; }
  .pop p { margin: 10px 0 0; }
</style>
