<script lang="ts">
  import { link } from '../lib/link.svelte';
  import type { Level } from '../lib/appData';
  import { metricCost, status } from '../model/score';
  import { TOE_OVERLAP_FLAG } from '../model/verdict';
  import { ui } from '../state.svelte';
  import { METRIC_LABELS, METRIC_ORDER, SIMPLE_METRICS } from '../model/styles';
  import type { Band, MetricId, PoseEval, PoseTarget } from '../model/types';

  /** Both hand positions, hoods first; the score already weighs them both. */
  let { poses, targets, level, toeClearance }: {
    poses: PoseEval[]; targets: PoseTarget[]; level: Level;
    /** Gap between the toe and the front tyre at its closest, mm; below zero they overlap. */
    toeClearance: number;
  } = $props();

  /** Leg and saddle metrics barely move between hoods and drops, so they show the hoods value only. */
  const LEG: MetricId[] = ['knee', 'kneeTop', 'seatAngle', 'kops'];
  const NAME = ['Hoods', 'Drops'];

  const ids = $derived(
    METRIC_ORDER.filter((k) => {
      const b = targets[0].bands[k];
      if (!b) return false;
      if (level === 1) return SIMPLE_METRICS.includes(k);
      if (level === 2) return b.weight > 0;
      return true;
    }),
  );
  /** The positions a card shows: [index, band] pairs, hoods first. */
  const rows = (k: MetricId) =>
    poses
      .map((_, i) => [i, targets[i]?.bands[k]] as const)
      .filter((r): r is readonly [number, Band] => !!r[1] && (r[0] === 0 || !LEG.includes(k)));
  /** The status the drawing's legend points at: cards with no angle in it fade. */
  const statusFocus = $derived(ui.statusHover ?? ui.statusPin);
  const overextended = $derived(poses.some((p) => p.overextended));
  const shortfall = $derived(Math.max(...poses.map((p) => p.legShortfall)));

  /** Toe and front wheel: amber under 10 mm of room and for the overlap most road bikes have, red past TOE_OVERLAP_FLAG. */
  const toe = $derived(Number.isFinite(toeClearance) ? Math.round(toeClearance) : null);
  const toeSt = $derived(toe === null ? 'info' : toe < -TOE_OVERLAP_FLAG ? 'off' : toe < 10 ? 'near' : 'ok');
  const TOE_LO = -40;
  const TOE_HI = 80;
  const toePos = (v: number) => Math.max(0, Math.min(100, ((v - TOE_LO) / (TOE_HI - TOE_LO)) * 100));
  const pos = (v: number, b: Band) => {
    const lo = b.min - 3 * b.scale;
    const hi = b.max + 3 * b.scale;
    return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  };
  /** Band ends to one decimal at most: height and flexibility shift them by fractions of a degree. */
  const end = (n: number) => String(Math.round(n * 10) / 10);
  const span = (b: Band) => `${end(b.min)}–${end(b.max)}`;
  const text = (k: MetricId, v: number) => (k === 'seatAngle' ? v.toFixed(1) : String(Math.round(v)));
  const range = (r: (readonly [number, Band])[]) => {
    const parts = [...new Set(r.map(([, b]) => span(b)))];
    return parts.join(' / ') + r[0][1].unit;
  };
</script>

<div class="strip">
  {#each ids as k (k)}
    {@const r = rows(k)}
    {@const pair = r.length > 1}
    <div class="card" class:dim={!!statusFocus && !r.some(([i, b]) => status(poses[i].metrics[k], b) === statusFocus)} role="button" tabindex="0" use:link={{ id: `m:${k}`, pin: true }} title="{METRIC_LABELS[k].long}: {r.map(([i, b]) => `${pair ? NAME[i] + ' ' : ''}target ${span(b)}${b.unit}`).join(', ')}">
      <div class="name">{METRIC_LABELS[k].short}</div>
      <div class="nums" class:pair>
        {#each r as [i, b] (i)}
          <div class="num">{text(k, poses[i].metrics[k])}<span>{b.unit}</span>{#if pair}<small>{NAME[i].toLowerCase()}</small>{/if}</div>
        {/each}
      </div>
      {#each r as [i, b] (i)}
        {@const v = poses[i].metrics[k]}
        {@const st = status(v, b)}
        <div class="bar" class:thin={pair} aria-label={pair ? NAME[i] : undefined}>
          {#if st !== 'info'}
            <div class="band" style="left:{pos(b.min, b)}%; width:{pos(b.max, b) - pos(b.min, b)}%"></div>
          {/if}
          <div class="dot" style="left:{pos(v, b)}%; background:var(--{st})"></div>
        </div>
      {/each}
      <!-- The warning takes the range line's place, so the strip (and the drawing above it) never resizes. -->
      {#if k === 'knee' && overextended}
        {@const n = Math.max(1, Math.round(shortfall))}
        <div class="range alert" title="Can't reach the pedal: {n} mm short">Leg {n} mm short</div>
      {:else if status(poses[0].metrics[k], r[0][1]) !== 'info'}<div class="range">{range(r)}</div>{/if}
      {#if level === 3}<div class="cost">cost {r.map(([i, b]) => metricCost(poses[i].metrics[k], b).toFixed(2)).join(' / ')}</div>{/if}
    </div>
  {/each}
  <div
    class="card" class:dim={!!statusFocus && toeSt !== statusFocus} role="button" tabindex="0" use:link={{ id: 'r:toe', pin: true }}
    title="Toe and front wheel at the closest point of the pedal stroke, with the bars straight. Some overlap is normal on road bikes and only matters in slow, tight turns."
  >
    <div class="name">Toe</div>
    <div class="nums"><div class="num">{toe === null ? '–' : Math.abs(toe)}<span>mm</span></div></div>
    <div class="bar">
      <div class="band" style="left:{toePos(0)}%; width:{100 - toePos(0)}%"></div>
      {#if toe !== null}<div class="dot" style="left:{toePos(toe)}%; background:var(--{toeSt})"></div>{/if}
    </div>
    <div class="range" class:alert={toeSt === 'off'}>{toe === null ? 'clear' : toe < 0 ? 'overlap' : 'clear'}</div>
  </div>
</div>

<style>
  .strip {
    display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 8px 12px;
    scrollbar-width: none; background: color-mix(in srgb, var(--surface) 80%, transparent);
    backdrop-filter: blur(12px); border-top: 1px solid var(--line);
  }
  .strip::-webkit-scrollbar { display: none; }
  .card { transition: opacity 0.15s; cursor: pointer; flex: 1 0 92px; margin: 0; scroll-snap-align: start; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; }
  .card.dim { opacity: 0.35; }
  .name { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); white-space: nowrap; }
  .nums { display: flex; gap: 10px; align-items: baseline; }
  .num { font-size: 22px; font-weight: 600; line-height: 1.2; white-space: nowrap; }
  .nums.pair .num { font-size: 17px; }
  /* Spelled out under each value: a bare H or D read as a mystery. */
  .num small { display: block; font-size: 10px; font-weight: 600; line-height: 1.1; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .num span { font-size: 13px; color: var(--muted); margin-left: 1px; }
  .bar { position: relative; height: 10px; margin-top: 4px; background: var(--surface-2); border-radius: 5px; }
  .band { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--ok) 28%, transparent); border-radius: 5px; transition: left 0.2s, width 0.2s; }
  .dot { position: absolute; top: 0; width: 10px; height: 10px; margin-left: -5px; border-radius: 50%; transition: left 0.2s; }
  .bar.thin { height: 6px; border-radius: 3px; }
  .bar.thin + .bar.thin { margin-top: 3px; }
  .bar.thin .band { border-radius: 3px; }
  .bar.thin .dot { width: 6px; height: 6px; margin-left: -3px; }
  .range { font-size: 11px; color: var(--muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .range.alert { color: var(--off); font-weight: 600; }
  .cost { font-size: 11px; color: var(--muted); margin-top: 3px; }
  @media (min-width: 900px) {
    .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(78px, 1fr)); overflow: visible; padding: 10px 16px; }
  }
</style>
