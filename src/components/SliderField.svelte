<script lang="ts">
  let {
    label, value = $bindable(), min, max, step, unit = 'mm', delta = 0, locked = $bindable(false), hint, onedit, showLock = true,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    delta?: number;
    locked?: boolean;
    hint?: string;
    onedit?: () => void;
    showLock?: boolean;
  } = $props();
  const pct = $derived(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)));
</script>

<div class="field">
  <div class="head">
    <span class="label">{label}</span>
    <span class="val">{Number.isInteger(value) ? value : value.toFixed(1)} {unit}</span>
    {#if Math.abs(delta) >= 0.5}
      <span class="delta">{delta > 0 ? '+' : '−'}{Math.abs(delta) % 1 ? Math.abs(delta).toFixed(1) : Math.abs(delta)}</span>
    {/if}
    {#if showLock}<button
      type="button" class="lock" class:on={locked} aria-pressed={locked} aria-label="Keep {label} fixed"
      title="Fixed: Optimize leaves this alone" onclick={() => (locked = !locked)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        {#if locked}<path d="M8 11V8a4 4 0 0 1 8 0v3" />{:else}<path d="M8 11V8a4 4 0 0 1 7.5-2" />{/if}
      </svg>
    </button>{/if}
  </div>
  <input
    type="range" {min} {max} {step} bind:value style="--p:{pct}%" aria-label={label}
    oninput={() => onedit?.()}
  />
  {#if hint}<div class="hint">{hint}</div>{/if}
</div>

<style>
  .field { margin-bottom: 6px; }
  .head { display: flex; align-items: center; gap: 8px; min-height: 36px; }
  .label { font-weight: 600; flex: 1; }
  .val { font-weight: 600; }
  .delta { font-size: 12px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); padding: 1px 7px; border-radius: 999px; }
  .lock { width: 44px; height: 36px; border: 0; background: transparent; color: var(--muted); display: grid; place-items: center; border-radius: 10px; margin-right: -8px; }
  .lock.on { color: var(--accent); }
  .hint { font-size: 12px; color: var(--muted); margin-top: -6px; }
</style>
