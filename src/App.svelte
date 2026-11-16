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
  import ScoreRing from './components/ScoreRing.svelte';
  import Segmented from './components/Segmented.svelte';
  import { resolveSegments } from './model/body';
  import { forwardLayout } from './model/geometry';
  import { idealLayout } from './model/optimize';
  import { evaluateFit, riderPose } from './model/pose';
  import { evaluationCost, fitScore, partPenalty } from './model/score';
  import { bandsFor, STYLES } from './model/styles';
  import type { StyleId } from './model/types';
  import { activeFrame, app, save, ui, type Tab } from './state.svelte';

  const segments = $derived(resolveSegments(app.body));
  const style = $derived(STYLES[app.styleId]);
  const bands = $derived(bandsFor(style, app.body.flexibility));
  const elbowPref = $derived(style.poses[0].elbowPref);
  const frame = $derived(activeFrame());
  const foot = $derived(app.components.footStack);

  const shown = new Tween($state.snapshot(app.current), { duration: 450, easing: cubicOut });
  $effect(() => {
    const next = $state.snapshot(app.current);
    const animate = untrack(() => ui.animate);
    shown.set(next, { duration: animate ? 450 : 0 });
    untrack(() => (ui.animate = false));
  });

  const layout = $derived(forwardLayout(frame, app.components, shown.current));
  const evaluation = $derived(evaluateFit(segments, layout, foot, elbowPref));
  const score = $derived(
    fitScore(evaluationCost(evaluation, bands) + partPenalty(shown.current)),
  );
  const ideal = $derived(idealLayout(segments, bands, elbowPref, app.components, app.options.crankLengths));
  const crankDeg = $derived(ui.playing ? ui.crank : evaluation.peakKneeCrank);
  const pose = $derived(riderPose(segments, layout, foot, elbowPref, crankDeg));
  const ghostPose = $derived(
    ui.ghost ? riderPose(segments, forwardLayout(frame, app.components, ui.ghost), foot, elbowPref, crankDeg) : null,
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

  const styleOptions = Object.values(STYLES).map((s) => ({ value: s.id as StyleId, label: s.name, title: s.blurb }));
  const tabs: { id: Tab; label: string }[] = [
    { id: 'rider', label: 'Rider' },
    { id: 'bike', label: 'Bike' },
    { id: 'fit', label: 'Fit' },
    { id: 'compare', label: 'Compare' },
  ];
</script>

<div class="app">
  <header>
    <div class="brand"><i></i>bikefit</div>
    <div class="styles"><Segmented options={styleOptions} bind:value={app.styleId} ariaLabel="Riding style" compact /></div>
    <ScoreRing {score} />
  </header>

  <section class="view">
    <div class="canvas">
      <BikeView
        {frame} components={app.components} {layout} {pose} {ghostPose} {ideal} {bands} {evaluation}
        height={app.body.height} spacers={shown.current.spacers}
      />
    </div>
    <MetricStrip {evaluation} {bands} />
  </section>

  <aside class="panel">
    <div class="tabs" role="tablist">
      {#each tabs as t (t.id)}
        <button type="button" role="tab" aria-selected={app.tab === t.id} class:on={app.tab === t.id} onclick={() => (app.tab = t.id)}>{t.label}</button>
      {/each}
    </div>
    <div class="body">
      {#if app.tab === 'rider'}<RiderPanel />
      {:else if app.tab === 'bike'}<BikePanel />
      {:else if app.tab === 'fit'}<FitPanel />
      {:else}<ComparePanel />{/if}
    </div>
  </aside>
</div>

<style>
  .app {
    height: 100dvh; display: grid; overflow: hidden;
    grid-template: "head" 52px "view" auto "panel" minmax(0, 1fr) / minmax(0, 1fr);
  }
  header { grid-area: head; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 12px; border-bottom: 1px solid var(--line); }
  .brand { font-weight: 600; font-size: 17px; display: flex; align-items: center; gap: 7px; letter-spacing: -0.01em; }
  .brand i { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
  .styles { flex: 1; min-width: 0; display: flex; justify-content: center; max-width: 360px; margin: 0 auto; }
  .styles :global(.seg) { width: 100%; }
  .view { grid-area: view; height: 46dvh; display: flex; flex-direction: column; min-height: 0; }
  .canvas { flex: 1; min-height: 0; }
  .panel { grid-area: panel; display: flex; flex-direction: column; min-height: 0; border-top: 1px solid var(--line); background: var(--bg); }
  .tabs { display: flex; border-bottom: 1px solid var(--line); background: var(--surface); }
  .tabs button { flex: 1; min-height: 46px; border: 0; border-bottom: 3px solid transparent; background: transparent; font-weight: 600; color: var(--muted); }
  .tabs button.on { color: var(--ink); border-bottom-color: var(--accent); }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  @media (min-width: 900px) {
    .app { grid-template: "head head" 56px "view panel" minmax(0, 1fr) / minmax(0, 1fr) 400px; }
    header { padding: 0 20px; }
    .view { height: auto; min-height: 0; }
    .panel { border-top: 0; border-left: 1px solid var(--line); }
  }
</style>
