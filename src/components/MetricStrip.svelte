<script lang="ts">
  import { status } from '../model/score';
  import { METRIC_LABELS, METRIC_ORDER } from '../model/styles';
  import type { Band, Evaluation, MetricId } from '../model/types';

  let { evaluation, bands }: { evaluation: Evaluation; bands: Record<MetricId, Band> } = $props();

  const pos = (v: number, b: Band) => {
    const lo = b.min - 3 * b.scale;
    const hi = b.max + 3 * b.scale;
    return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  };
</script>

<div class="strip">
  {#each METRIC_ORDER as k (k)}
    {@const b = bands[k]}
    {@const v = evaluation.metrics[k]}
    {@const st = status(v, b)}
    <div class="card" title="{METRIC_LABELS[k].long}: target {Math.round(b.min)}–{Math.round(b.max)}{b.unit}">
      <div class="name">{METRIC_LABELS[k].short}</div>
      <div class="num">{Math.round(v)}<span>{b.unit}</span></div>
      <div class="bar">
        <div class="band" style="left:{pos(b.min, b)}%; width:{pos(b.max, b) - pos(b.min, b)}%"></div>
        <div class="dot" style="left:{pos(v, b)}%; background:var(--{st})"></div>
      </div>
    </div>
  {/each}
</div>

<style>
  .strip {
    display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 8px 12px;
    scrollbar-width: none; background: color-mix(in srgb, var(--surface) 80%, transparent);
    backdrop-filter: blur(12px); border-top: 1px solid var(--line);
  }
  .strip::-webkit-scrollbar { display: none; }
  .card { flex: 1 0 92px; scroll-snap-align: start; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; }
  .name { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); white-space: nowrap; }
  .num { font-size: 22px; font-weight: 600; line-height: 1.2; }
  .num span { font-size: 13px; color: var(--muted); margin-left: 1px; }
  .bar { position: relative; height: 10px; margin-top: 4px; background: var(--surface-2); border-radius: 5px; }
  .band { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--ok) 28%, transparent); border-radius: 5px; }
  .dot { position: absolute; top: 0; width: 10px; height: 10px; margin-left: -5px; border-radius: 50%; transition: left 0.2s; }
  @media (min-width: 900px) { .strip { display: grid; grid-template-columns: repeat(6, 1fr); overflow: visible; padding: 10px 16px; } }
</style>
