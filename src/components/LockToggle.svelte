<script lang="ts">
  let { locked = $bindable(false), label }: { locked?: boolean; label: string } = $props();
</script>

<button
  type="button" class="lock" class:on={locked} aria-pressed={locked} aria-label="Keep {label} fixed"
  title="Fixed: Optimize leaves this alone" onclick={() => (locked = !locked)}
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    {#if locked}<path d="M8 11V8a4 4 0 0 1 8 0v3" />{:else}<path d="M8 11V8a4 4 0 0 1 7.5-2" />{/if}
  </svg>
</button>

<style>
  .lock { width: 44px; height: 36px; border: 0; background: transparent; color: var(--muted); display: grid; place-items: center; border-radius: 10px; margin-right: -8px; }
  .lock.on { color: var(--accent); }
</style>
