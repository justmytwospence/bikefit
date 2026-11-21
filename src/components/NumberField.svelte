<script lang="ts">
  import { link } from '../lib/link.svelte';
  import type { LinkId } from '../lib/linkIds';
  import Info from './Info.svelte';
  let {
    label, value = $bindable(), unit = '', min, max, step = 1, hint, placeholder, estimated = false, onreset, link: linkId,
  }: {
    label: string;
    value: number;
    unit?: string;
    min: number;
    max: number;
    step?: number;
    hint?: string;
    placeholder?: string;
    estimated?: boolean;
    /** Offered in the label line while the value is your own, to go back to the estimate. */
    onreset?: () => void;
    /** What this number shows on the drawing while it is hovered or focused. */
    link?: LinkId;
  } = $props();

  const round = (n: number) => Math.round(n * 1000) / 1000;
  const bump = (d: number) => (value = round(Math.min(max, Math.max(min, (Number.isFinite(value) ? value : min) + d))));
  function input(e: Event) {
    const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(n)) value = n;
  }
  function blur(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const n = el.valueAsNumber;
    value = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    el.value = String(value);
  }
</script>

<label class="nf" use:link={linkId}>
  <span class="l">{label}{#if unit}{' '}<span class="muted">({unit})</span>{/if}{#if hint}<Info text={hint} label="How to measure {label.toLowerCase()}" />{/if}{#if estimated} <span class="est">est.</span>{:else if onreset} <button
    type="button" class="relink" onclick={(e) => { e.preventDefault(); onreset(); }}
  >Use estimate</button>{/if}</span>
  <span class="row">
    <button type="button" aria-label="Decrease {label}" onclick={() => bump(-step)}>−</button>
    <input type="number" inputmode="decimal" {step} {min} {max} {placeholder} value={value} oninput={input} onblur={blur} />
    <button type="button" aria-label="Increase {label}" onclick={() => bump(step)}>+</button>
  </span>
</label>

<style>
  .nf { display: block; margin-bottom: 12px; }
  .l { display: block; font-weight: 600; font-size: 13px; margin-bottom: 4px; min-height: 20px; }
  .relink { width: auto; min-height: 0; font-size: 11px; padding: 0; border: 0; background: transparent; color: var(--accent); font-weight: 600; line-height: 1; margin-left: 2px; }
  .row { display: flex; gap: 6px; }
  button { flex: none; width: 44px; min-height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); font-size: 20px; line-height: 1; }
  input { text-align: center; min-width: 0; }
  .est { font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface-2); border-radius: 999px; padding: 1px 6px; margin-left: 2px; }
</style>
