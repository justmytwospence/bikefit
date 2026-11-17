<script lang="ts">
  import type { Units } from '../lib/units';
  import { app, exportJson, importJson, shareUrl } from '../state.svelte';
  import Segmented from './Segmented.svelte';

  const units = [
    { value: 'metric', label: 'Metric' },
    { value: 'imperial', label: 'Imperial' },
  ];
  let open = $state(false);
  let status = $state('');
  let file: HTMLInputElement | undefined = $state();

  function download() {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bikefit.json';
    a.click();
    URL.revokeObjectURL(url);
    status = '';
  }
  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    status = importJson(await f.text()) ? 'Imported.' : 'That file is not a bikefit export.';
  }
  async function copyLink() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      status = 'Link copied.';
    } catch {
      prompt('Copy this link', url);
      status = '';
    }
  }
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
  <button type="button" class="gear" aria-label="Settings" aria-expanded={open} onclick={() => (open = !open)}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="2" fill="var(--surface)" /><circle cx="15" cy="12" r="2" fill="var(--surface)" /><circle cx="8" cy="17" r="2" fill="var(--surface)" />
    </svg>
  </button>
  {#if open}
    <div class="pop card">
      <h2>Units</h2>
      <Segmented
        options={units} ariaLabel="Units"
        bind:value={() => app.units, (v) => (app.units = v as Units)}
      />
      <p class="muted small">Body measurements and shoe size (EU or US). Bike geometry and fit settings stay in mm.</p>
      <h2>Your data</h2>
      <div class="data">
        <button type="button" class="btn small" onclick={download}>Export</button>
        <button type="button" class="btn small" onclick={() => file?.click()}>Import</button>
        <button type="button" class="btn small" onclick={copyLink}>Copy link</button>
        <input bind:this={file} type="file" accept=".json,application/json" hidden onchange={upload} />
      </div>
      <p class="muted small">{status || 'The link carries your body, setup and current frame.'}</p>
    </div>
  {/if}
</div>

<style>
  .menu { position: relative; }
  .gear { width: 44px; height: 44px; border: 0; background: transparent; border-radius: 12px; display: grid; place-items: center; color: var(--muted); }
  .pop { position: absolute; right: 0; top: 46px; width: 280px; z-index: 20; margin: 0; }
  .pop p { margin: 10px 0 0; }
  .data { display: flex; gap: 6px; flex-wrap: wrap; }
</style>
