<script lang="ts">
  import { frameSkeleton, steerAxis } from '../model/geometry';
  import type { RiderPose } from '../model/pose';
  import { status } from '../model/score';
  import type { Band, Components, Evaluation, Frame, Layout, MetricId } from '../model/types';
  import { add, deg, scale as vscale, type Vec2 } from '../model/vec';
  import { ui } from '../state.svelte';

  let {
    frame, components, layout, pose, ghostPose, ideal, bands, evaluation, height, spacers,
  }: {
    frame: Frame;
    components: Components;
    layout: Layout;
    pose: RiderPose;
    ghostPose: RiderPose | null;
    ideal: { saddle: Vec2; hand: Vec2 };
    bands: Record<MetricId, Band>;
    evaluation: Evaluation;
    height: number;
    spacers: number;
  } = $props();

  const sk = $derived(frameSkeleton(frame));
  const h = $derived(steerAxis(frame));
  const vb = $derived.by(() => {
    const minX = sk.rearAxle.x - 380;
    const maxX = sk.frontAxle.x + 380;
    const minY = frame.bbDrop - 380;
    const maxY = 0.8 * height;
    return { x: minX, y: -maxY, w: maxX - minX, h: maxY - minY };
  });
  let boxW = $state(0);
  let boxH = $state(0);
  const px = $derived(boxW > 0 && boxH > 0 ? Math.min(boxW / vb.w, boxH / vb.h) : 0.3);
  const fs = $derived(13 / px);

  const L = (a: Vec2) => `${a.x},${a.y}`;
  const pts = (...p: Vec2[]) => p.map(L).join(' ');
  const flip = (p: Vec2): Vec2 => ({ x: p.x, y: -p.y });

  const pt = (c: Vec2, a: number, r: number): Vec2 => ({
    x: c.x + r * Math.cos((a * Math.PI) / 180),
    y: c.y + r * Math.sin((a * Math.PI) / 180),
  });
  const ang = (a: Vec2, b: Vec2) => deg(Math.atan2(b.y - a.y, b.x - a.x));
  function arcOf(c: Vec2, a0: number, a1: number, r: number) {
    const d = ((((a1 - a0) % 360) + 540) % 360) - 180;
    const p0 = pt(c, a0, r);
    const p1 = pt(c, a0 + d, r);
    return {
      path: `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${p1.x} ${p1.y}`,
      mid: a0 + d / 2,
    };
  }

  const joints = $derived.by(() => {
    const p = pose;
    const defs: { id: MetricId; c: Vec2; a: number; b: number; r: number; value: number }[] = [
      { id: 'knee', c: p.knee, a: ang(p.knee, p.hip), b: ang(p.knee, p.ankle), r: 70, value: p.kneeAngle },
      { id: 'hip', c: p.hip, a: ang(p.hip, p.shoulder), b: ang(p.hip, p.knee), r: 70, value: p.hipAngle },
      { id: 'shoulder', c: p.shoulder, a: ang(p.shoulder, p.hip), b: ang(p.shoulder, p.elbow), r: 70, value: p.shoulderAngle },
      { id: 'elbow', c: p.elbow, a: ang(p.elbow, p.shoulder), b: ang(p.elbow, p.hand), r: 70, value: p.elbowAngle },
      { id: 'torso', c: p.hip, a: 0, b: ang(p.hip, p.shoulder), r: 150, value: p.torsoAngle },
    ];
    return defs.filter((d) => d.id !== 'hip' || ui.playing).map((d) => {
      const arc = arcOf(d.c, d.a, d.b, d.r);
      const lbl = pt(d.c, arc.mid, d.r + 42);
      return { ...d, ...arc, st: status(evaluation.metrics[d.id], bands[d.id]), lbl, shownValue: ui.playing ? d.value : evaluation.metrics[d.id] };
    });
  });

  const R = $derived(components.barReach);
  const D = $derived(components.barDrop);
  const cl = $derived(layout.clamp);
  const barPath = $derived(
    `M ${cl.x} ${cl.y} L ${cl.x + R - 30} ${cl.y} Q ${cl.x + R + 12} ${cl.y} ${cl.x + R + 8} ${cl.y - 55} Q ${cl.x + R} ${cl.y - D} ${cl.x + R - 70} ${cl.y - D + 12}`,
  );
  const spacerTop = $derived(add(layout.headTop, vscale(h, spacers + components.headsetCap)));

  function limbs(p: RiderPose) {
    return { leg: pts(p.hip, p.knee, p.ankle, p.ball), arm: pts(p.hip, p.shoulder, p.elbow, p.hand) };
  }
  const ghostLimbs = $derived(ghostPose ? limbs(ghostPose) : null);

  function togglePlay() {
    if (!ui.playing) ui.crank = evaluation.peakKneeCrank;
    ui.playing = !ui.playing;
  }

  const targets = $derived([
    { key: 'saddle', cur: layout.saddle, tgt: ideal.saddle },
    { key: 'hand', cur: layout.hand, tgt: ideal.hand },
  ]);
</script>

<div class="wrap" bind:clientWidth={boxW} bind:clientHeight={boxH}>
  <svg viewBox="{vb.x} {vb.y} {vb.w} {vb.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Side view of the bike and rider">
    <g transform="scale(1,-1)" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <line x1={vb.x} x2={vb.x + vb.w} y1={frame.bbDrop - 340} y2={frame.bbDrop - 340} stroke="var(--line)" stroke-width="4" />
      {#each [sk.rearAxle, sk.frontAxle] as a}
        <circle cx={a.x} cy={a.y} r="340" stroke="var(--frame)" stroke-width="16" opacity=".5" />
        <circle cx={a.x} cy={a.y} r="300" stroke="var(--frame)" stroke-width="3" opacity=".5" />
      {/each}
      <g stroke="var(--frame)" stroke-width="22">
        <polyline points={pts(sk.bb, sk.seatCluster, sk.headTop, sk.headBottom, sk.bb)} />
        <polyline points={pts(sk.bb, sk.rearAxle, sk.seatCluster)} />
        <line x1={sk.headBottom.x} y1={sk.headBottom.y} x2={sk.frontAxle.x} y2={sk.frontAxle.y} stroke-width="18" />
      </g>
      <line x1={sk.seatCluster.x} y1={sk.seatCluster.y} x2={layout.seatAxisTop.x} y2={layout.seatAxisTop.y} stroke="var(--muted)" stroke-width="16" />
      <line x1={layout.saddle.x - 140} y1={layout.saddle.y + 6} x2={layout.saddle.x + 130} y2={layout.saddle.y + 6} stroke="var(--rider)" stroke-width="18" opacity=".85" />
      <line x1={layout.headTop.x} y1={layout.headTop.y} x2={spacerTop.x} y2={spacerTop.y} stroke="var(--muted)" stroke-width="26" />
      <line x1={layout.stemBase.x} y1={layout.stemBase.y} x2={cl.x} y2={cl.y} stroke="var(--ink)" stroke-width="14" />
      <path d={barPath} stroke="var(--ink)" stroke-width="12" />
      <line x1={cl.x + R - 5} y1={cl.y} x2={layout.hand.x} y2={layout.hand.y} stroke="var(--ink)" stroke-width="22" />
      <circle cx="0" cy="0" r="95" stroke="var(--frame)" stroke-width="5" />
      <line x1="0" y1="0" x2={pose.spindle.x} y2={pose.spindle.y} stroke="var(--ink)" stroke-width="14" />
      <rect x={pose.spindle.x - 45} y={pose.spindle.y - 7} width="90" height="14" rx="5" fill="var(--ink)" stroke="none" />

      {#if ghostLimbs && ghostPose}
        <g stroke="var(--rider)" opacity=".18" stroke-width="70" stroke-dasharray="14 12">
          <polyline points={ghostLimbs.leg} />
          <polyline points={ghostLimbs.arm} stroke-width="60" />
        </g>
      {/if}

      {#each targets as t (t.key)}
        {@const d = Math.hypot(t.cur.x - t.tgt.x, t.cur.y - t.tgt.y)}
        {#if d > 5}
          <line x1={t.cur.x} y1={t.cur.y} x2={t.tgt.x} y2={t.tgt.y} stroke="var(--accent)" stroke-width="5" stroke-dasharray="14 10" />
        {/if}
        <circle cx={t.tgt.x} cy={t.tgt.y} r="28" stroke="var(--accent)" stroke-width="6" stroke-dasharray="10 8" />
        <path d="M {t.tgt.x - 46} {t.tgt.y} h 24 M {t.tgt.x + 22} {t.tgt.y} h 24 M {t.tgt.x} {t.tgt.y - 46} v 24 M {t.tgt.x} {t.tgt.y + 22} v 24" stroke="var(--accent)" stroke-width="6" />
      {/each}

      <g stroke="var(--rider)">
        <line x1={pose.hip.x} y1={pose.hip.y} x2={pose.knee.x} y2={pose.knee.y} stroke-width="66" />
        <line x1={pose.knee.x} y1={pose.knee.y} x2={pose.ankle.x} y2={pose.ankle.y} stroke-width="48" />
        <line x1={pose.ankle.x} y1={pose.ankle.y} x2={pose.ball.x} y2={pose.ball.y} stroke-width="32" />
        <line x1={pose.hip.x} y1={pose.hip.y} x2={pose.shoulder.x} y2={pose.shoulder.y} stroke-width="84" />
        <line x1={pose.shoulder.x} y1={pose.shoulder.y} x2={pose.elbow.x} y2={pose.elbow.y} stroke-width="44" />
        <line x1={pose.elbow.x} y1={pose.elbow.y} x2={pose.hand.x} y2={pose.hand.y} stroke-width="38" />
        <circle cx={pose.head.x} cy={pose.head.y} r="80" fill="var(--rider)" stroke="none" />
      </g>
      {#each [pose.hip, pose.knee, pose.ankle, pose.shoulder, pose.elbow] as j}
        <circle cx={j.x} cy={j.y} r="12" fill="var(--surface)" stroke="none" />
      {/each}

      <line x1={pose.hip.x} y1={pose.hip.y} x2={pose.hip.x + 220} y2={pose.hip.y} stroke="var(--muted)" stroke-width="4" stroke-dasharray="10 10" />
      {#each joints as j (j.id)}
        <path d={j.path} stroke="var(--{j.st})" stroke-width="10" />
      {/each}
    </g>
    <g font-size={fs} font-weight="700" text-anchor="middle" dominant-baseline="central" fill="var(--ink)"
       style="paint-order:stroke; stroke:var(--bg); stroke-width:{fs * 0.35}px; stroke-linejoin:round">
      {#each joints as j (j.id)}
        <text x={j.lbl.x} y={-j.lbl.y}>{Math.round(j.shownValue)}°</text>
      {/each}
      {#each targets as t (t.key)}
        <text x={t.tgt.x + 60} y={-t.tgt.y - 36} fill="var(--accent)" font-size={fs * 0.85} text-anchor="start">target</text>
      {/each}
    </g>
  </svg>

  <div class="legend">
    <span><i class="t"></i> target</span>
    {#if ghostPose}<span><i class="g"></i> before</span>{/if}
  </div>
  <button
    type="button" class="play"
    aria-label={ui.playing ? 'Pause pedal stroke' : 'Play pedal stroke'} onclick={togglePlay}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {#if ui.playing}<rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />{:else}<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" />{/if}
    </svg>
  </button>
</div>

<style>
  .wrap { position: relative; width: 100%; height: 100%; min-height: 0; }
  svg { width: 100%; height: 100%; display: block; }
  .legend { position: absolute; top: 10px; left: 14px; display: flex; gap: 12px; font-size: 12px; color: var(--muted); }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }
  .legend .t { border: 2px dashed var(--accent); }
  .legend .g { background: var(--rider); opacity: 0.2; }
  .play { position: absolute; left: 12px; bottom: 12px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow); display: grid; place-items: center; }
</style>
