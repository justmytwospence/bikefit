<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
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
  import { evaluateFit, riderPose } from './model/pose';
  import type { FitParams } from './model/types';
  import { makeContext, poseWeights } from './model/riding';
  import { fitCost, fitScore, partPenalty, scoreBreakdown } from './model/score';
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
  /** While a target is shown on Fit my bike, the current setup is drawn in outline behind it. */
  const otherShown = $derived(
    !previewing && app.tab === 'mybike'
      && (ui.editing === 'target' || !!peekSetup)
      && !sameParams($state.snapshot(app.baseline) as FitParams, (peekSetup ? peekSetup.params : $state.snapshot(app.current)) as FitParams)
      ? ($state.snapshot(app.baseline) as FitParams) : null,
  );
  const ctx = $derived(makeContext(frame, app.components, app.body.ankling, effort));
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
            frame: mine, params: otherShown, label: 'current setup', partsOnly: true,
            layout: forwardLayout(mine, app.components, otherShown),
          }
        : null,
  );

  const shown = new Tween($state.snapshot(app.current), { duration: 450, easing: cubicOut });
  $effect(() => {
    const next = $state.snapshot(viewParams);
    const animate = untrack(() => ui.animate);
    shown.set(next, { duration: animate ? 450 : 0 });
    untrack(() => (ui.animate = false));
  });

  const layout = $derived(forwardLayout(frame, app.components, shown.current));
  const evaluation = $derived(evaluateFit(segments, layout, ctx, targets));
  const score = $derived(
    previewing ? shownBike!.row.result.score : fitScore(fitCost(evaluation, targets, weights) + partPenalty(shown.current)),
  );
  const breakdown = $derived(previewing ? null : scoreBreakdown(evaluation, targets, weights, shown.current));
  const ideal = $derived(
    idealLayout(
      segments, targets, weights, makeContext(null, app.components, app.body.ankling, effort),
      app.components, app.options.crankLengths,
    ),
  );
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
  const crankDeg = $derived(ui.playing ? ui.crank : (focusCrank ?? evaluation.peakKneeCrank));
  const pose = $derived(riderPose(segments, layout, ctx, contact, targets[pi].elbowPref, crankDeg));
  const farPose = $derived(riderPose(segments, layout, ctx, contact, targets[pi].elbowPref, crankDeg + 180));
  const ghostPose = $derived(
    otherShown
      ? riderPose(segments, forwardLayout(frame, app.components, otherShown), ctx, contact, targets[pi].elbowPref, crankDeg)
      : null,
  );
  const toeTip = $derived(
    Number.isFinite(evaluation.toeClearance)
      && (linked === 'r:toe' || ((resultsLevel >= 2 || evaluation.toeClearance < 0) && evaluation.toeClearance < 10))
      ? riderPose(segments, layout, ctx, contact, targets[pi].elbowPref, 0).toe
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

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') ui.pin = null; }} />

<div class="app">
  <section class="view">
    <div class="canvas">
      <BikeView
        {frame} components={app.components} {layout} {pose} {farPose} {ghostPose} {ghostBike} {ideal}
        target={shownTarget} poseEval={evaluation.poses[pi]} level={resultsLevel}
        height={app.body.height} seg={segments} params={shown.current}
        {toeTip} toeClearance={evaluation.toeClearance} peakCrank={evaluation.peakKneeCrank} units={app.units}
      />
      <ScoreCard {score} {styleId} {breakdown} previewStyle={styleId !== app.styleId} from={otherShown ? setupScore(otherShown) : null} />
    </div>
    <MetricStrip poses={evaluation.poses} {targets} level={resultsLevel} />
  </section>

  <aside class="panel">
    <div class="tabs" role="tablist">
      {#each tabs as t (t.id)}
        <button type="button" role="tab" aria-selected={app.tab === t.id} class:on={app.tab === t.id} onclick={() => { if (app.tab !== t.id) event('Tab opened', { tab: t.id }); app.tab = t.id; ui.pin = null; clearPeek(); }}>{t.label}</button>
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
