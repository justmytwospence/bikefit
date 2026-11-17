<script lang="ts">
  import { STYLES } from '../model/styles';
  import { app } from '../state.svelte';

  let { score }: { score: number } = $props();
  const C = 2 * Math.PI * 16;
  const color = $derived(score >= 85 ? 'var(--ok)' : score >= 60 ? 'var(--near)' : 'var(--off)');
  const name = $derived(STYLES[app.styleId].name);
</script>

<label class="score" title="How closely this setup matches the {name} style. Choose another style here.">
  <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="16" fill="none" stroke="var(--surface-2)" stroke-width="4" />
    <circle
      cx="20" cy="20" r="16" fill="none" stroke={color} stroke-width="4" stroke-linecap="round"
      stroke-dasharray="{(C * Math.min(100, score)) / 100} {C}" transform="rotate(-90 20 20)"
      style="transition: stroke-dasharray 0.4s"
    />
    <text x="20" y="24.5" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">{score}</text>
  </svg>
  <span class="txt">
    <span class="k">Fit for</span>
    <span class="name">{name} <span aria-hidden="true">▾</span></span>
  </span>
  <select aria-label="Riding style" bind:value={app.styleId}>
    {#each Object.values(STYLES) as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
  </select>
</label>

<style>
  .score { position: relative; display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; box-shadow: var(--shadow); padding: 3px 14px 3px 3px; cursor: pointer; }
  .score:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
  .k { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .name { display: block; font-weight: 600; white-space: nowrap; }
  /* Phones: a smaller pill without the label, so it covers less of the drawing. */
  @media (max-width: 479px) {
    .score { gap: 6px; padding-right: 10px; }
    svg { width: 36px; height: 36px; }
    .k { display: none; }
    .name { font-size: 13px; }
  }
</style>
