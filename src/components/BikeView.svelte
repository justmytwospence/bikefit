<script lang="ts">
  import { HEAD_R, headCenter } from '../draw/body';
  import { distToSegment, placeLabel, type Obstacle } from '../draw/shapes';
  import { event } from '../lib/analytics';
  import { LEVEL_OPTIONS, type Level } from '../lib/appData';
  import { frameSkeleton } from '../model/geometry';
  import type { RiderPose } from '../model/pose';
  import { outside, status } from '../model/score';
  import type {
    Components, FitParams, Frame, Layout, MetricId, PoseEval, PoseTarget, Segments,
  } from '../model/types';
  import { deg, type Vec2 } from '../model/vec';
  import { app, ui } from '../state.svelte';
  import Arm from './draw/Arm.svelte';
  import Bike from './draw/Bike.svelte';
  import Leg from './draw/Leg.svelte';
  import Torso from './draw/Torso.svelte';
  import FootInset from './FootInset.svelte';
  import Measurements from './draw/Measurements.svelte';
  import PillSelect from './PillSelect.svelte';

  let {
    frame, components, layout, pose, farPose, ghostPose, ghostLabel = 'before', ghostBike = null, ideal, target, poseEval, level, height, seg, params,
    toeTip, toeClearance, peakCrank,
  }: {
    frame: Frame;
    components: Components;
    layout: Layout;
    pose: RiderPose;
    farPose: RiderPose;
    ghostPose: RiderPose | null;
    /** Names the outline drawn behind the rider. */
    ghostLabel?: string;
    /** A second size of the same bike, drawn in outline behind the first. */
    ghostBike?: { frame: Frame; layout: Layout; params: FitParams; label: string; partsOnly?: boolean } | null;
    ideal: { saddle: Vec2; hoods: Vec2 };
    target: PoseTarget;
    poseEval: PoseEval;
    level: Level;
    height: number;
    seg: Segments;
    params: FitParams;
    toeTip: Vec2 | null;
    toeClearance: number;
    peakCrank: number;
  } = $props();

  const sk = $derived(frameSkeleton(frame));
  const LINE = 14; // obstacle radius for the skeleton lines, mm
  const head = $derived(headCenter(pose, height));
  const vb = $derived.by(() => {
    const minX = sk.rearAxle.x - 380;
    const maxX = sk.frontAxle.x + 380;
    const minY = frame.bbDrop - 380;
    const maxY = 0.9 * height;
    return { x: minX, y: -maxY, w: maxX - minX, h: maxY - minY };
  });
  let boxW = $state(0);
  let boxH = $state(0);
  const px = $derived(boxW > 0 && boxH > 0 ? Math.min(boxW / vb.w, boxH / vb.h) : 0.3);
  const fs = $derived(13 / px);
  const tyre = $derived(frame.tyreWidth);
  const groundY = $derived(frame.bbDrop - (311 + tyre));

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

  const obstacles = $derived<Obstacle[]>([
    { a: pose.hip, b: pose.knee, r: LINE },
    { a: pose.knee, b: pose.ankle, r: LINE },
    { a: pose.hip, b: pose.shoulder, r: LINE },
    { a: pose.shoulder, b: head, r: LINE },
    { a: pose.shoulder, b: pose.elbow, r: LINE },
    { a: pose.elbow, b: pose.hand, r: LINE },
    { a: head, b: head, r: HEAD_R * height },
    { a: layout.saddle, b: layout.nose, r: 20 },
  ]);

  const joints = $derived.by(() => {
    const p = pose;
    const defs: { id: MetricId; c: Vec2; a: number; b: number; r: number; value: number }[] = ([
      { id: 'knee', c: p.knee, a: ang(p.knee, p.hip), b: ang(p.knee, p.ankle), r: 85, value: p.kneeAngle },
      { id: 'hip', c: p.hip, a: ang(p.hip, p.shoulder), b: ang(p.hip, p.knee), r: 85, value: p.hipAngle },
      { id: 'shoulder', c: p.shoulder, a: ang(p.shoulder, p.hip), b: ang(p.shoulder, p.elbow), r: 70, value: p.shoulderAngle },
      { id: 'elbow', c: p.elbow, a: ang(p.elbow, p.shoulder), b: ang(p.elbow, p.hand), r: 65, value: p.elbowAngle },
      { id: 'torso', c: p.hip, a: 0, b: ang(p.hip, p.shoulder), r: 220, value: p.torsoAngle },
    ] as typeof defs).filter((d) => (d.id !== 'hip' || ui.playing) && (level >= 2 || d.id === 'knee' || d.id === 'torso' || d.id === 'hip'));
    const placed: Obstacle[] = [];
    const clr = fs * 1.0;
    return defs.map((d) => {
      const arc = arcOf(d.c, d.a, d.b, d.r);
      const all = [...obstacles, ...placed];
      const clear = (q: Vec2) => all.every((o) => distToSegment(q, o.a, o.b) > o.r + clr);
      let lbl = placeLabel(d.c, arc.mid, d.r + 40, all, clr, 24, 3);
      if (!clear(lbl)) {
        for (const off of [35, -35, 70, -70, 110, -110, 180]) {
          const q = placeLabel(d.c, arc.mid + off, d.r + 40, all, clr, 24, 3);
          if (clear(q)) { lbl = q; break; }
        }
      }
      placed.push({ a: lbl, b: lbl, r: fs * 1.2 });
      return {
        ...d, ...arc, lbl,
        st: target.bands[d.id] ? status(poseEval.metrics[d.id], target.bands[d.id]!) : 'info',
        shownValue: ui.playing ? d.value : poseEval.metrics[d.id],
      };
    });
  });

  function togglePlay() {
    if (!ui.playing) ui.crank = peakCrank;
    ui.playing = !ui.playing;
  }

  const inBand = $derived(
    !poseEval.overextended && !poseEval.overreach
      && (Object.keys(target.bands) as MetricId[]).every((k) => {
        const b = target.bands[k]!;
        return b.weight === 0 || outside(poseEval.metrics[k], b) === 0;
      }),
  );
  const targets = $derived(inBand ? [] : [
    { key: 'saddle', cur: layout.saddle, tgt: ideal.saddle },
    ...(pose.contact === 'hoods' ? [{ key: 'hand', cur: layout.hoods, tgt: ideal.hoods }] : []),
  ]);
  const poseOptions = [
    { value: 'hoods' as const, label: 'Hoods' },
    { value: 'drops' as const, label: 'Drops' },
  ];
</script>

<div class="wrap" bind:clientWidth={boxW} bind:clientHeight={boxH}>
  <svg viewBox="{vb.x} {vb.y} {vb.w} {vb.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Side view of the bike and rider">
    <g transform="scale(1,-1)" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <line x1={vb.x} x2={vb.x + vb.w} y1={groundY} y2={groundY} stroke="var(--line)" stroke-width="4" />

      <Leg
        pose={farPose} {seg} footStack={components.footStack} cleatOffset={params.cleatOffset} variant="far"
      />
      <line x1="0" y1="0" x2={farPose.spindle.x} y2={farPose.spindle.y} stroke="var(--rider-far)" stroke-width="14" />

      <Bike {frame} {components} {layout} {params} />
      {#if ghostBike}
        <Bike frame={ghostBike.frame} {components} layout={ghostBike.layout} params={ghostBike.params} variant={ghostBike.partsOnly ? 'parts' : 'ghost'} />
      {/if}

      <line x1="0" y1="0" x2={pose.spindle.x} y2={pose.spindle.y} stroke="var(--ink)" stroke-width="16" />
      <circle cx="0" cy="0" r="16" fill="var(--ink)" stroke="none" />

      {#if ghostPose}
        <Torso pose={ghostPose} {height} variant="ghost" />
        <Leg pose={ghostPose} {seg} footStack={components.footStack} cleatOffset={params.cleatOffset} variant="ghost" />
        <Arm pose={ghostPose} variant="ghost" />
      {/if}

      <Torso {pose} {height} />
      <Leg
        {pose} {seg} footStack={components.footStack} cleatOffset={params.cleatOffset}
        showBallMark={level >= 2}
      />
      <Arm {pose} />

      {#each targets as t (t.key)}
        {@const d = Math.hypot(t.cur.x - t.tgt.x, t.cur.y - t.tgt.y)}
        {#if d > 5}
          <line x1={t.cur.x} y1={t.cur.y} x2={t.tgt.x} y2={t.tgt.y} stroke="var(--accent)" stroke-width="5" stroke-dasharray="14 10" />
        {/if}
        <circle cx={t.tgt.x} cy={t.tgt.y} r="16" stroke="var(--accent)" stroke-width="5" stroke-dasharray="8 6" />
        <path
          d="M {t.tgt.x - 34} {t.tgt.y} h 14 M {t.tgt.x + 20} {t.tgt.y} h 14 M {t.tgt.x} {t.tgt.y - 34} v 14 M {t.tgt.x} {t.tgt.y + 20} v 14"
          stroke="var(--accent)" stroke-width="5"
        />
        {#if level >= 2}
          <line x1={t.tgt.x + 14} y1={t.tgt.y + 14} x2={t.tgt.x + 38} y2={t.tgt.y + 38} stroke="var(--accent)" stroke-width="3" />
          <text
            transform="translate({t.tgt.x + 44},{t.tgt.y + 44}) scale(1,-1)" fill="var(--accent)" stroke="none"
            font-size={fs * 0.8} font-weight="700"
          >suggested</text>
        {/if}
      {/each}


      {#each [pose.hip, pose.knee, pose.ankle, pose.shoulder, pose.elbow, pose.hand] as j}
        <circle cx={j.x} cy={j.y} r="16" fill="var(--bg)" stroke="var(--rider)" stroke-width="7" />
      {/each}

      {#if toeTip && toeClearance < 10}
        <circle cx={toeTip.x} cy={toeTip.y} r="26" stroke={toeClearance < 0 ? 'var(--off)' : 'var(--near)'} stroke-width="8" />
      {/if}
      {#if level >= 3}
        <line x1={poseEval.comX} y1={groundY} x2={poseEval.comX} y2={pose.hip.y} stroke="var(--accent)" stroke-width="5" stroke-dasharray="14 10" />
        <circle cx={poseEval.comX} cy={pose.hip.y - 150} r="24" stroke="var(--accent)" stroke-width="7" />
        <path d="M {poseEval.comX - 24} {pose.hip.y - 150} h 48 M {poseEval.comX} {pose.hip.y - 174} v 48" stroke="var(--accent)" stroke-width="7" />
      {/if}
      <line x1={pose.hip.x} y1={pose.hip.y} x2={pose.hip.x + 220} y2={pose.hip.y} stroke="var(--muted)" stroke-width="4" stroke-dasharray="10 10" />
      {#each joints as j (j.id)}
        <path d={j.path} stroke="var(--{j.st})" stroke-width="10" />
      {/each}
      <g
        font-size={fs} font-weight="700" text-anchor="middle" dominant-baseline="central" fill="var(--ink)"
        style="paint-order:stroke; stroke:var(--bg); stroke-width:{fs * 0.35}px; stroke-linejoin:round"
      >
        {#each joints as j (j.id)}
          <text transform="translate({j.lbl.x},{j.lbl.y}) scale(1,-1)">{Math.round(j.shownValue)}°</text>
        {/each}
      </g>
      <Measurements id={ui.measure} {layout} {frame} {components} {params} {pose} {fs} />
    </g>
  </svg>

  {#if ui.measure === 'cleat' || level === 3}
    <FootInset {seg} footStack={components.footStack} cleatOffset={params.cleatOffset} />
  {/if}

  <div class="legend">
    {#if !inBand}<span><i class="t"></i> suggested</span>{/if}
    {#if ghostPose}<span><i class="g"></i> {ghostLabel}</span>{/if}
    {#if ghostBike && !ghostBike.partsOnly}<span><i class="o"></i> {ghostBike.label}</span>{/if}
    {#if (level >= 2 || toeClearance < 0) && Number.isFinite(toeClearance) && toeClearance < 10}
      <span class="warn" class:bad={toeClearance < 0}>
        {toeClearance < 0 ? 'Toe overlap ' + Math.round(-toeClearance) : 'Toe clearance ' + Math.round(toeClearance)} mm
      </span>
    {/if}
  </div>
  <!-- Right-anchored and reversed, View first at the right edge. -->
  <div class="viewctl">
    <PillSelect
      label="View" ariaLabel="What the drawing shows" options={LEVEL_OPTIONS}
      bind:value={() => String(app.detail.results), (v) => { app.detail.results = Number(v) as Level; event('View level', { level: Number(v) }); }}
    />
    <PillSelect label="Hands" ariaLabel="Hand position drawn" options={poseOptions} bind:value={ui.viewPose} />
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
  .legend { position: absolute; top: 10px; left: 14px; max-width: calc(100% - 250px); flex-wrap: wrap; display: flex; gap: 4px 12px; font-size: 12px; color: var(--muted); }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }
  .legend .t { border: 2px dashed var(--accent); }
  .legend .g { background: var(--rider); opacity: 0.2; }
  .legend .o { border: 2px dashed var(--accent); border-radius: 2px; }
  .warn { color: var(--near); font-weight: 600; }
  .warn.bad { color: var(--off); }
  .viewctl { position: absolute; top: 8px; right: 10px; display: flex; flex-direction: row-reverse; gap: 6px; }
  /* Phones: the pills get their own row above the drawing instead of covering it. */
  @media (max-width: 479px) {
    .wrap { padding-top: 46px; }
    .legend { top: 52px; max-width: calc(100% - 28px); }
  }
  .play { position: absolute; left: 12px; bottom: 12px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow); display: grid; place-items: center; }
</style>
