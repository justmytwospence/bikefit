<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import { untrack } from 'svelte';
  import BikePanel from './components/BikePanel.svelte';
  import BikeView from './components/BikeView.svelte';
  import ComparePanel from './components/ComparePanel.svelte';
  import FitPanel from './components/FitPanel.svelte';
  import MetricStrip from './components/MetricStrip.svelte';
  import RiderPanel from './components/RiderPanel.svelte';
  import ScoreCard from './components/ScoreCard.svelte';
  import SettingsMenu from './components/SettingsMenu.svelte';
  import { resolveSegments } from './model/body';
  import { forwardLayout } from './model/geometry';
  import { idealLayout } from './model/optimize';
  import { impossible } from './model/limits';
  import { evaluateFit, riderPose } from './model/pose';
  import type { FitParams } from './model/types';
  import { makeContext, poseWeights } from './model/riding';
  import { fitCost, fitScore, partPenalty } from './model/score';
  import { bandsFor, STYLES } from './model/styles';
  import { activeFrame, app, save, ui, type Tab } from './state.svelte';

  const segments = $derived(resolveSegments(app.body));
  const style = $derived(STYLES[app.styleId]);
  const targets = $derived(bandsFor(style, app.body.flexibility));
  const weights = $derived(poseWeights(app.hands ?? style.defaultHands));
  const effort = $derived(app.effort ?? style.defaultEffort);
  const frame = $derived(activeFrame());
  const ctx = $derived(makeContext(frame, app.components, app.body.ankling, effort));
  const resultsLevel = $derived(app.detail.results);

  const shown = new Tween($state.snapshot(app.current), { duration: 450, easing: cubicOut });
  $effect(() => {
    const next = $state.snapshot(app.current);
    const animate = untrack(() => ui.animate);
    shown.set(next, { duration: animate ? 450 : 0 });
    untrack(() => (ui.animate = false));
  });

  const layout = $derived(forwardLayout(frame, app.components, shown.current));
  const evaluation = $derived(evaluateFit(segments, layout, ctx, targets));
  const score = $derived(fitScore(fitCost(evaluation, targets, weights) + partPenalty(shown.current)));
  const ideal = $derived(
    idealLayout(
      segments, targets, weights, makeContext(null, app.components, app.body.ankling, effort),
      app.components, app.options.crankLengths,
    ),
  );
  /** Why the rider could not ride these settings at all, for the Fit tab's hard stops. */
  const whyImpossible = $derived((p: FitParams) =>
    impossible(evaluateFit(segments, forwardLayout(frame, app.components, p), ctx, targets, 36, false)));
  const contact = $derived(resultsLevel >= 2 ? ui.viewPose : 'hoods');
  const pi = $derived(contact === 'drops' ? 1 : 0);
  // The drops pose has no knee bands of its own; borrow the hoods ones so the knee card stays.
  const shownTarget = $derived(
    pi === 0 ? targets[0] : { ...targets[1], bands: { ...targets[0].bands, ...targets[1].bands } },
  );
  const crankDeg = $derived(ui.playing ? ui.crank : evaluation.peakKneeCrank);
  const pose = $derived(riderPose(segments, layout, ctx, contact, targets[pi].elbowPref, crankDeg));
  const farPose = $derived(riderPose(segments, layout, ctx, contact, targets[pi].elbowPref, crankDeg + 180));
  const ghostPose = $derived(
    ui.ghost
      ? riderPose(segments, forwardLayout(frame, app.components, ui.ghost), ctx, contact, targets[pi].elbowPref, crankDeg)
      : null,
  );
  const toeTip = $derived(
    (resultsLevel >= 2 || evaluation.toeClearance < 0) && Number.isFinite(evaluation.toeClearance)
      && evaluation.toeClearance < 10
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
    if (app.current.spacers > frame.maxSpacers) app.current.spacers = frame.maxSpacers;
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'rider', label: 'Rider' },
    { id: 'bike', label: 'Bike' },
    { id: 'fit', label: 'Fit' },
    { id: 'compare', label: 'Compare' },
  ];
</script>

<div class="app">
  <section class="view">
    <div class="canvas">
      <BikeView
        {frame} components={app.components} {layout} {pose} {farPose} {ghostPose} {ideal}
        target={shownTarget} poseEval={evaluation.poses[pi]} level={resultsLevel}
        height={app.body.height} seg={segments} params={shown.current}
        {toeTip} toeClearance={evaluation.toeClearance} peakCrank={evaluation.peakKneeCrank}
      />
      <ScoreCard {score} />
    </div>
    <MetricStrip poseEval={evaluation.poses[pi]} target={shownTarget} level={resultsLevel} />
  </section>

  <aside class="panel">
    <div class="tabs" role="tablist">
      {#each tabs as t (t.id)}
        <button type="button" role="tab" aria-selected={app.tab === t.id} class:on={app.tab === t.id} onclick={() => (app.tab = t.id)}>{t.label}</button>
      {/each}
      <SettingsMenu />
    </div>
    <div class="body">
      {#if app.tab === 'rider'}<RiderPanel />
      {:else if app.tab === 'bike'}<BikePanel />
      {:else if app.tab === 'fit'}<FitPanel {layout} {evaluation} {whyImpossible} />
      {:else}<ComparePanel />{/if}
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
  .tabs button { flex: 1; min-height: 46px; border: 0; border-bottom: 3px solid transparent; background: transparent; font-weight: 600; color: var(--muted); }
  .tabs :global(.menu) { flex: 0 0 auto; display: flex; align-items: center; }
  .tabs button.on { color: var(--ink); border-bottom-color: var(--accent); }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  @media (min-width: 900px) {
    .app { grid-template: "view panel" minmax(0, 1fr) / minmax(0, 1fr) 400px; }
    .view { height: auto; min-height: 0; }
    .panel { border-top: 0; border-left: 1px solid var(--line); }
  }
</style>
