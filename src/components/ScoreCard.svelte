<script lang="ts">
  import { event } from '../lib/analytics';
  import { link } from '../lib/link.svelte';
  import type { ScorePart } from '../model/score';
  import { METRIC_LABELS } from '../model/styles';
  import { app, styleChoices, styleOf } from '../state.svelte';
  import type { MetricId, StyleId } from '../model/types';

  let { score, styleId, previewStyle = false, from = null, breakdown = null }: {
    score: number; styleId: StyleId; previewStyle?: boolean; from?: number | null;
    /** What costs the score points; null while a bike is on show from Find a bike. */
    breakdown?: { score: number; parts: ScorePart[] } | null;
  } = $props();
  const C = 2 * Math.PI * 16;
  const color = $derived(score >= 85 ? 'var(--ok)' : score >= 60 ? 'var(--near)' : 'var(--off)');
  const name = $derived(styleOf(styleId).name);

  let root: HTMLElement | undefined = $state();
  let open = $state(false);
  let hovering = $state(false);
  const shown = $derived((open || hovering) && !!breakdown);
  const LABEL: Record<string, string> = {
    legShort: "Leg can't reach the pedal", overreach: "Hands can't reach the bars",
    parts: 'Unusual parts or settings (stem, cranks, cleats, saddle or bar angle)',
  };
  const label = (id: string) => LABEL[id] ?? METRIC_LABELS[id as MetricId].long;
  const rows = $derived((breakdown?.parts ?? []).filter((x) => Math.round(x.points) >= 1).slice(0, 5));
</script>

<svelte:window
  onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
  onpointerdown={(e) => { if (open && root && !root.contains(e.target as Node)) open = false; }}
/>

<div class="score" bind:this={root}>
  <button
    type="button" class="ring" aria-expanded={shown} aria-label="Score {score}: what costs points"
    onclick={() => { open = !open; if (open) event('Score explained'); }}
    onpointerenter={(e) => e.pointerType !== 'touch' && (hovering = true)} onpointerleave={() => (hovering = false)}
  >
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--surface-2)" stroke-width="4" />
      <circle
        cx="20" cy="20" r="16" fill="none" stroke={color} stroke-width="4" stroke-linecap="round"
        stroke-dasharray="{(C * Math.min(100, score)) / 100} {C}" transform="rotate(-90 20 20)"
        style="transition: stroke-dasharray 0.4s"
      />
      <text x="20" y="24.5" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">{score}</text>
    </svg>
  </button>
  <label class="style" title="How closely this setup matches the {name} style, on the hoods and in the drops, weighted by how you ride. Choose another style here.">
    <span class="txt">
      <span class="k">{previewStyle ? 'Preview' : 'Fit for'}</span>
      <span class="name">{name} <span aria-hidden="true">▾</span></span>
      {#if from !== null && from !== score}<span class="was">{from} → {score}</span>{/if}
    </span>
    <select aria-label="Riding style" bind:value={app.styleId}>
      {#each styleChoices() as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
    </select>
  </label>
  {#if shown}
    <div
      class="why" role="dialog" tabindex="-1" aria-label="What costs points"
      onpointerenter={(e) => e.pointerType !== 'touch' && (hovering = true)} onpointerleave={() => (hovering = false)}
    >
      <b>What costs points</b>
      {#if rows.length}
        <ul>
          {#each rows as r (r.id)}
            <li use:link={r.id in LABEL ? undefined : (`m:${r.id}` as `m:${MetricId}`)}>
              <span>{label(r.id)}</span><span class="pts">−{Math.round(r.points)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted small">Every angle is inside its range.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .score { position: relative; display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; box-shadow: var(--shadow); padding: 3px 14px 3px 3px; }
  .ring { border: 0; background: transparent; padding: 0; border-radius: 50%; color: var(--ink); display: grid; cursor: help; }
  .style { position: relative; cursor: pointer; border-radius: 999px; }
  .style:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
  .why {
    position: absolute; right: 0; bottom: calc(100% + 8px); width: 260px; padding: 10px 12px; z-index: 5;
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow);
  }
  .why ul { list-style: none; margin: 6px 0; padding: 0; }
  .why li { display: flex; justify-content: space-between; gap: 8px; padding: 4px 6px; border-radius: 8px; font-size: 13px; }
  .why li:global(.linked) { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .why li:global([data-link]) { cursor: pointer; }
  .why p { margin: 0; }
  .pts { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--off); }
  .k { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .name { display: block; font-weight: 600; white-space: nowrap; }
  .was { display: block; font-size: 11px; color: var(--muted); }
  /* Phones: a smaller pill without the label, so it covers less of the drawing. */
  @media (max-width: 479px) {
    .score { gap: 6px; padding-right: 10px; }
    svg { width: 36px; height: 36px; }
    .k { display: none; }
    .name { font-size: 13px; }
  }
</style>
