<script lang="ts">
  import type { Level } from '../lib/appData';
  import { metricCost, status } from '../model/score';
  import { METRIC_LABELS, METRIC_ORDER, SIMPLE_METRICS } from '../model/styles';
  import type { Band, MetricId, PoseEval, PoseTarget } from '../model/types';

  let { poseEval, target, level }: { poseEval: PoseEval; target: PoseTarget; level: Level } = $props();

  const ids = $derived(
    METRIC_ORDER.filter((k) => {
      const b = target.bands[k];
      if (!b) return false;
      if (level === 1) return SIMPLE_METRICS.includes(k);
      if (level === 2) return b.weight > 0;
      return true;
    }),
  );

  const pos = (v: number, b: Band) => {
    const lo = b.min - 3 * b.scale;
    const hi = b.max + 3 * b.scale;
    return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  };
  const text = (k: MetricId, v: number, b: Band) => (k === 'seatAngle' ? v.toFixed(1) : String(Math.round(v)));
  const unit = (u: string) => (u === 'mm' ? 'mm' : u);
</script>

<div class="strip">
  {#each ids as k (k)}
    {@const b = target.bands[k]!}
    {@const v = poseEval.metrics[k]}
    {@const st = status(v, b)}
    <div class="card" title="{METRIC_LABELS[k].long}: target {b.min}–{b.max}{unit(b.unit)}">
      <div class="name">{METRIC_LABELS[k].short}</div>
      <div class="num">{text(k, v, b)}<span>{unit(b.unit)}</span></div>
      <div class="bar">
        {#if st !== 'info'}
          <div class="band" style="left:{pos(b.min, b)}%; width:{pos(b.max, b) - pos(b.min, b)}%"></div>
        {/if}
        <div class="dot" style="left:{pos(v, b)}%; background:var(--{st})"></div>
      </div>
      {#if st !== 'info'}<div class="range">{b.min}–{b.max}{unit(b.unit)}</div>{/if}
      {#if k === 'knee' && poseEval.overextended}
        <div class="warn">Can't reach the pedal: {Math.max(1, Math.round(poseEval.legShortfall))} mm short</div>
      {/if}
      {#if level === 3}<div class="cost">cost {metricCost(v, b).toFixed(2)}</div>{/if}
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
  .warn { font-size: 11px; font-weight: 600; color: var(--off); margin-top: 4px; }
  .range { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .cost { font-size: 11px; color: var(--muted); margin-top: 3px; }
  @media (min-width: 900px) {
    .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(78px, 1fr)); overflow: visible; padding: 10px 16px; }
  }
</style>
