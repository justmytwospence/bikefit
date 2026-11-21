<script lang="ts">
  import Info from './Info.svelte';
  let {
    label, value = $bindable(), min, max, step, unit = 'mm', delta = 0, hint, onedit,
    limit, stop, note,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    /** Change from your setup; its slot is always kept, so the value never shifts sideways. */
    delta?: number;
    /** What the number measures, behind an (i) by the label. */
    hint?: string;
    onedit?: () => void;
    /** The part of [min, max] the slider may move in; the rest of the track is shaded and stops the thumb. */
    limit?: [number, number];
    /** Says why the thumb stopped, shown while it sits against a limit. */
    stop?: string;
    /** A quiet line shown where the stop message goes, when nothing stopped the thumb. */
    note?: string;
  } = $props();
  const at = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const pct = $derived(at(value));
  const d = $derived(Math.abs(delta));
  // Slivers of blocked track at the ends read as glitches, not limits; the thumb still stops there.
  const lo = $derived(limit && at(limit[0]) >= 2 ? at(limit[0]) : 0);
  const hi = $derived(limit && at(limit[1]) <= 98 ? at(limit[1]) : 100);

  function input(e: Event & { currentTarget: HTMLInputElement }) {
    let v = Number(e.currentTarget.value);
    if (limit) v = Math.min(limit[1], Math.max(limit[0], v));
    e.currentTarget.value = String(v);
    if (v !== value) {
      value = v;
      onedit?.();
    }
  }
</script>

<div class="field">
  <div class="head">
    <span class="label">{label}{#if hint}<Info text={hint} label="About {label.toLowerCase()}" />{/if}</span>
    <span class="val">{Number.isInteger(value) ? value : value.toFixed(1)} {unit}</span>
    <span class="delta" class:none={d < 0.5}>{d < 0.5 ? '0' : (delta > 0 ? '+' : '−') + (d % 1 ? d.toFixed(1) : d)}</span>
  </div>
  <input
    type="range" {min} {max} {step} {value} style="--p:{pct}%;--lo:{lo}%;--hi:{hi}%" aria-label={label}
    class:limited={!!limit && (lo > 0 || hi < 100)} oninput={input}
  />
  <!-- Always one line, so a stop message never pushes the next control down. -->
  <div class="msg" class:note={!stop && !!note} role={stop ? 'status' : undefined} title={stop ?? note}>{stop ?? note ?? ''}</div>
</div>

<style>
  .field { margin-bottom: 6px; }
  .head { display: flex; align-items: center; gap: 8px; min-height: 36px; }
  .label { font-weight: 600; flex: 1; }
  .val { font-weight: 600; }
  .delta { font-size: 12px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); padding: 1px 7px; border-radius: 999px; min-width: 48px; text-align: center; }
  .delta.none { visibility: hidden; }
  .msg {
    font-size: 12px; color: var(--off); font-weight: 600; margin-top: -6px; min-height: 1.4em; line-height: 1.4;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .msg.note { color: var(--muted); font-weight: 400; }
</style>
