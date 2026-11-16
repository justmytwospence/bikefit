<script lang="ts">
  let { score }: { score: number } = $props();
  const C = 2 * Math.PI * 16;
  const color = $derived(score >= 85 ? 'var(--ok)' : score >= 60 ? 'var(--near)' : 'var(--off)');
</script>

<div class="ring" title="How closely this setup matches the target style">
  <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="16" fill="none" stroke="var(--surface-2)" stroke-width="4" />
    <circle
      cx="20" cy="20" r="16" fill="none" stroke={color} stroke-width="4" stroke-linecap="round"
      stroke-dasharray="{(C * Math.min(100, score)) / 100} {C}" transform="rotate(-90 20 20)"
      style="transition: stroke-dasharray 0.4s"
    />
    <text x="20" y="24.5" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">{score}</text>
  </svg>
  <span class="label">Fit</span>
</div>

<style>
  .ring { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .label { display: none; color: var(--muted); }
  @media (min-width: 900px) { .label { display: inline; } }
</style>
