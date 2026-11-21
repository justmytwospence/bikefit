<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion, Tween } from 'svelte/motion';
  import { untrack } from 'svelte';
  import BikeView from './components/BikeView.svelte';
  import FindPanel from './components/FindPanel.svelte';
  import MetricStrip from './components/MetricStrip.svelte';
  import MyBikePanel from './components/MyBikePanel.svelte';
  import RiderPanel from './components/RiderPanel.svelte';
  import ScoreCard from './components/ScoreCard.svelte';
  import SettingsMenu from './components/SettingsMenu.svelte';
  import { sameParams } from './lib/ladder';
  import { resolveSegments } from './model/body';
  import { forwardLayout } from './model/geometry';
  import { idealLayout } from './model/optimize';
  import { impossible } from './model/limits';
  import { evaluateFit, riderPose, type RiderPose } from './model/pose';
  import type { Components, FitParams, Frame, Layout, Segments } from './model/types';
  import type { Vec2 } from './model/vec';
  import { makeContext, poseWeights } from './model/riding';
  import { TOE_OVERLAP_FLAG } from './model/verdict';
  import { crankFor, fitCost, fitScore, partPenalty, scoreBreakdown } from './model/score';
  import { bandsFor, STYLES } from './model/styles';
  import { event } from './lib/analytics';
  import { activeFrame, app, save, setupScore, ui, type Tab } from './state.svelte';
  import { focus } from './lib/link.svelte';
  import { clearPeek } from './lib/peek.svelte';

  const segments = $derived(resolveSegments(app.body));
  /** What the pointer rests on, drawn in place of the committed choice. */
  const peekNow = $derived(ui.peek);
  const styleId = $derived(peekNow?.kind === 'style' ? peekNow.styleId : app.styleId);
  const style = $derived(STYLES[styleId]);
  const targets = $derived(bandsFor(style, app.body.flexibility, app.body.height));
  const weights = $derived(poseWeights(app.hands ?? style.defaultHands));
  const effort = $derived(app.effort ?? style.defaultEffort);
  /** Your own bike; the drawing shows another one only while Find a bike has one on show. */
  const mine = $derived(activeFrame());
  const peekBike = $derived(app.tab === 'find' && peekNow?.kind === 'bike' ? peekNow : null);
  const peekSetup = $derived(app.tab === 'mybike' && peekNow?.kind === 'setup' ? peekNow : null);
  /** The bike drawn from Find a bike: the one pointed at, else the one kept on show. */
  const shownBike = $derived(peekBike ?? (app.tab === 'find' ? ui.preview : null));
  const previewing = $derived(!!shownBike);
  const frame = $derived(previewing ? shownBike!.frame : mine);
  /** The setup the settings change. */
  const yours = $derived(ui.editing === 'current' ? app.baseline : app.current);
  const viewParams = $derived(previewing ? shownBike!.row.result.params : peekSetup ? peekSetup.params : yours);
  /**
   * What the drawing shows moves to a new value instead of jumping there: the frame, the body, the parts, the
   * hand position and the cranks. The numbers that decide anything (limits, targets, the ideal position) use the
   * real values above. Nothing moves for people who ask for reduced motion.
   */
  const MOVE = 450;
  const ms = (n: number) => (prefersReducedMotion.current ? 0 : n);
  /** Moves a tween to a new value; one equal to where it is already heading starts nothing. */
  function move<T>(t: Tween<T>, to: T, duration = MOVE) {
    if (JSON.stringify(to) !== JSON.stringify(untrack(() => t.target))) t.set(to, { duration: ms(duration) });
  }
  const frameT = new Tween(untrack(() => $state.snapshot(frame) as Frame), { easing: cubicOut });
  $effect(() => move(frameT, $state.snapshot(frame) as Frame));
  const segT = new Tween(untrack(() => segments), { easing: cubicOut });
  $effect(() => move(segT, segments));
  const compT = new Tween(untrack(() => $state.snapshot(app.components) as Components), { easing: cubicOut });
  $effect(() => move(compT, $state.snapshot(app.components) as Components));
  const dFrame = $derived(frameT.current);
  const dSeg: Segments = $derived(segT.current);
  const dComp = $derived(compT.current);
  /** While a target is shown on Fit my bike, the current setup is drawn in outline behind it. */
  const otherShown = $derived(
    !previewing && app.tab === 'mybike'
      && (ui.editing === 'target' || !!peekSetup)
      && !sameParams($state.snapshot(app.baseline) as FitParams, (peekSetup ? peekSetup.params : $state.snapshot(app.current)) as FitParams)
      ? ($state.snapshot(app.baseline) as FitParams) : null,
  );
  const ctx = $derived(makeContext(dFrame, dComp, app.body.ankling, effort));
  const resultsLevel = $derived(app.detail.results);
  /** The size the one on the drawing is too close to call against, drawn in outline behind it. */
  const otherSize = $derived(previewing ? shownBike!.other : null);
  /** The bike kept on show stays in outline while another one is pointed at. */
  const keptBike = $derived(
    peekBike && ui.preview && ui.preview.frame.id !== peekBike.frame.id && !peekBike.other ? ui.preview : null,
  );
  const ghostBike = $derived(
    otherSize
      ? {
          frame: otherSize.frame, params: otherSize.row.result.params, label: `size ${otherSize.size}`,
          layout: forwardLayout(otherSize.frame, app.components, otherSize.row.result.params),
        }
      : keptBike
        ? {
            frame: keptBike.frame, params: keptBike.row.result.params, label: keptBike.row.frameName,
            layout: forwardLayout(keptBike.frame, app.components, keptBike.row.result.params),
          }
      : otherShown
        ? {
            frame: dFrame, params: otherShown, label: 'current setup', partsOnly: true,
            layout: forwardLayout(dFrame, dComp, otherShown),
          }
        : null,
  );

  const shown = new Tween($state.snapshot(app.current), { duration: 450, easing: cubicOut });
  $effect(() => {
    const next = $state.snapshot(viewParams);
    const animate = untrack(() => ui.animate);
    shown.set(next, { duration: ms(animate ? MOVE : 0) });
    untrack(() => (ui.animate = false));
  });
  // A request to animate that changed nothing on the drawing must not make the next slider move glide.
  $effect(() => {
    if (!ui.animate) return;
    const t = setTimeout(() => (ui.animate = false), 50);
    return () => clearTimeout(t);
  });

  const crankRef = $derived(crankFor(app.body.inseam));
  const layout = $derived(forwardLayout(dFrame, dComp, shown.current));
  const evaluation = $derived(evaluateFit(dSeg, layout, ctx, targets));
  const rawScore = $derived(
    previewing ? shownBike!.row.result.score : fitScore(fitCost(evaluation, targets, weights) + partPenalty(shown.current, crankRef)),
  );
  /** A bike on show has one score for its whole build, so going from one bike to the next the number counts across. */
  const scoreT = new Tween(untrack(() => rawScore));
  let wasPreviewing = false;
  $effect(() => {
    const p = previewing;
    scoreT.set(rawScore, { duration: ms(p || wasPreviewing ? 300 : 0) });
    wasPreviewing = p;
  });
  const score = $derived(Math.round(scoreT.current));
  const breakdown = $derived(previewing ? null : scoreBreakdown(evaluation, targets, weights, shown.current, crankRef));
  const ideal = $derived(
    idealLayout(
      segments, targets, weights, makeContext(null, app.components, app.body.ankling, effort),
      app.components, app.options.crankLengths, app.body.inseam,
    ),
  );
  const idealT = new Tween(untrack(() => ideal), { easing: cubicOut });
  $effect(() => move(idealT, ideal));
  /** Why the rider could not ride these settings at all, for Fit my bike's hard stops. */
  const evalMine = (p: FitParams) => evaluateFit(
    segments, forwardLayout(mine, app.components, p),
    makeContext(mine, app.components, app.body.ankling, effort), targets, 36, false,
  );
  const whyImpossible = $derived((p: FitParams) => impossible(evalMine(p), p.saddleHeight - mine.seatTubeLength));
  /** Whether the foot reaches the pedal with these settings, whatever the frame allows. */
  const reaches = $derived((p: FitParams) => !evalMine(p).poses.some((x) => x.overextended));
  const contact = $derived(ui.viewPose);
  const pi = $derived(contact === 'drops' ? 1 : 0);
  // The drops pose has no knee bands of its own; borrow the hoods ones so the knee card stays.
  const shownTarget = $derived(
    pi === 0 ? targets[0] : { ...targets[1], bands: { ...targets[0].bands, ...targets[1].bands } },
  );
  /** A hip or top-of-stroke knee angle is measured elsewhere in the stroke: show the cranks there while it is linked. */
  const linked = $derived(focus());
  const focusCrank = $derived(
    linked === 'm:hip' ? evaluation.poses[pi].hipCrank
      : linked === 'm:kneeTop' ? evaluation.poses[pi].kneeTopCrank
        : linked === 'm:kops' || linked === 'r:toe' ? 0 : null,
  );
  const crankDeg = $derived(ui.playing ? ui.crank : (focusCrank ?? ui.manualCrank ?? evaluation.peakKneeCrank));
  /** The cranks turn to a new angle the short way round; Play and a dragged pedal are followed as they are. */
  const crankT = new Tween(untrack(() => crankDeg), { easing: cubicOut });
  $effect(() => {
    const from = untrack(() => crankT.current);
    const to = from + ((((crankDeg - from) % 360) + 540) % 360) - 180;
    crankT.set(to, { duration: ms(ui.playing || ui.dragging === 'crank' ? 0 : 300) });
  });
  const crankNow = $derived(((crankT.current % 360) + 360) % 360);
  /** The hands slide between the hoods and the drops, and the elbow bends to what the position assumes. */
  const handT = new Tween(untrack(() => pi), { easing: cubicOut });
  $effect(() => move(handT, pi, 300));
  const elbowT = new Tween(untrack(() => targets[pi].elbowPref), { easing: cubicOut });
  $effect(() => move(elbowT, targets[pi].elbowPref, 300));
  function poseAt(lay: Layout, deg: number): RiderPose {
    const m = handT.current;
    const mid: Vec2 = { x: lay.hoods.x + (lay.drops.x - lay.hoods.x) * m, y: lay.hoods.y + (lay.drops.y - lay.hoods.y) * m };
    const hand = m <= 0 ? lay.hoods : m >= 1 ? lay.drops : mid;
    return { ...riderPose(dSeg, { ...lay, hoods: hand }, ctx, 'hoods', elbowT.current, deg), contact };
  }
  const pose = $derived(poseAt(layout, crankNow));
  const farPose = $derived(poseAt(layout, crankNow + 180));
  const ghostPose = $derived(otherShown ? poseAt(forwardLayout(dFrame, dComp, otherShown), crankNow) : null);
  const toeTip = $derived(
    Number.isFinite(evaluation.toeClearance)
      && (linked === 'r:toe' || ((resultsLevel >= 2 || evaluation.toeClearance < -TOE_OVERLAP_FLAG) && evaluation.toeClearance < 10))
      ? poseAt(layout, 0).toe
      : null,
  );

  $effect(() => {
    if (!ui.playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      ui.crank = (((ui.crank - (360 * dt) / 1200) % 360) + 360) % 360;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    save();
  });

  $effect(() => {
    if (app.current.spacers > mine.maxSpacers) app.current.spacers = mine.maxSpacers;
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'rider', label: 'Rider' },
    { id: 'mybike', label: 'Fit my bike' },
    { id: 'find', label: 'Find a bike' },
  ];
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { ui.pin = null; ui.statusPin = null; ui.manualCrank = null; } }} />

<div class="app">
  <section class="view">
    <div class="canvas">
      <BikeView
        frame={dFrame} components={dComp} {layout} {pose} {farPose} {ghostPose} {ghostBike} ideal={idealT.current}
        target={shownTarget} poseEval={evaluation.poses[pi]} level={resultsLevel}
        height={dSeg.stature} seg={dSeg} params={shown.current}
        {toeTip} toeClearance={evaluation.toeClearance} peakCrank={evaluation.peakKneeCrank} units={app.units}
        editable={app.tab === 'mybike' && !previewing && !peekSetup} {whyImpossible} options={app.options}
      />
      <ScoreCard {score} {styleId} {breakdown} previewStyle={styleId !== app.styleId} from={otherShown ? setupScore(otherShown) : null} />
    </div>
    <MetricStrip poses={evaluation.poses} {targets} level={resultsLevel} toeClearance={evaluation.toeClearance} />
  </section>

  <aside class="panel">
    <div class="tabs" role="tablist">
      {#each tabs as t (t.id)}
        <button type="button" role="tab" aria-selected={app.tab === t.id} class:on={app.tab === t.id} onclick={() => { if (app.tab !== t.id) { event('Tab opened', { tab: t.id }); ui.animate = true; } app.tab = t.id; ui.pin = null; clearPeek(); }}>{t.label}</button>
      {/each}
      <SettingsMenu />
    </div>
    {#if ui.storageFailed}
      <p class="warn" role="status">This browser is not saving what you enter, so it will be gone when you leave. Export it from the settings menu (gear) to keep it.</p>
    {/if}
    <div class="body">
      {#if app.tab === 'rider'}<RiderPanel />
      {:else if app.tab === 'mybike'}<MyBikePanel {layout} {evaluation} {whyImpossible} {reaches} />
      {:else}<FindPanel />{/if}
    </div>
  </aside>
</div>

<style>
  .app {
    height: 100dvh; display: grid; overflow: hidden; padding-top: env(safe-area-inset-top);
    grid-template: "view" auto "panel" minmax(0, 1fr) / minmax(0, 1fr);
  }
  .view { grid-area: view; height: 50dvh; display: flex; flex-direction: column; min-height: 0; }
  .canvas { position: relative; flex: 1; min-height: 0; }
  .canvas > :global(.score) { position: absolute; right: 12px; bottom: 12px; }
  .panel { grid-area: panel; display: flex; flex-direction: column; min-height: 0; border-top: 1px solid var(--line); background: var(--bg); }
  .tabs { display: flex; border-bottom: 1px solid var(--line); background: var(--surface); }
  .tabs button { flex: 1; min-height: 46px; padding: 0 6px; white-space: nowrap; border: 0; border-bottom: 3px solid transparent; background: transparent; font-weight: 600; color: var(--muted); }
  @media (max-width: 400px) { .tabs button { font-size: 14px; } }
  .tabs :global(.menu) { flex: 0 0 auto; display: flex; align-items: center; }
  .tabs button.on { color: var(--ink); border-bottom-color: var(--accent); }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  @media (min-width: 900px) {
    .app { grid-template: "view panel" minmax(0, 1fr) / minmax(0, 1fr) 400px; }
    .view { height: auto; min-height: 0; }
    .panel { border-top: 0; border-left: 1px solid var(--line); }
  }
</style>
