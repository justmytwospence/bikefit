<script lang="ts">
  let {
    options, value = $bindable(), format, disabled = false, onedit, blocked,
  }: {
    options: number[];
    value: number;
    format: (n: number) => string;
    disabled?: boolean;
    onedit?: () => void;
    /** Options the rider could not ride, with the reason shown as a tooltip. */
    blocked?: Map<number, string>;
  } = $props();
  const all = $derived(options.includes(value) ? options : [...options, value].sort((a, b) => a - b));
</script>

<div class="chips" role="radiogroup">
  {#each all as o (o)}
    <button
      type="button" role="radio" aria-checked={o === value} class:on={o === value}
      disabled={disabled || !!blocked?.has(o)} title={blocked?.get(o)}
      onclick={() => { value = o; onedit?.(); }}
    >{format(o)}</button>
  {/each}
</div>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0 6px; }
  button { flex: none; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); font-weight: 600; }
  button.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  button:disabled { opacity: 0.5; }
  button[title]:disabled { text-decoration: line-through; }
</style>
