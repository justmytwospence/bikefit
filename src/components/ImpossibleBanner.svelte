<script lang="ts">
  import { onMount } from 'svelte';
  import { addCatalogFrame, selectFrame } from '../frames';
  import { sizeFamily } from '../lib/sizes';
  import { highestWhere, IMPOSSIBLE_TEXT, nearestPossible, POST_SHOWING, type Impossible } from '../model/limits';
  import type { FitParams, Frame } from '../model/types';
  import { app, clearGhost, optimize, ui } from '../state.svelte';

  /**
   * One message for a setup the rider's body cannot ride, in place of a stop under every slider: what is
   * wrong, and the nearest fix. When no saddle height works on this frame at all, says the frame is the
   * wrong size and offers the nearest size that fits.
   */
  let { frame, why, current, whyImpossible, reaches }: {
    frame: Frame;
    why: Impossible;
    current: FitParams;
    whyImpossible: (p: FitParams) => Impossible | null;
    reaches: (p: FitParams) => boolean;
  } = $props();

  type Cat = typeof import('../data/catalog');
  let cat = $state.raw<Cat | null>(null);
  onMount(async () => {
    cat = await import('../data/catalog');
  });

  const range = $derived(app.options.saddleHeightRange);
  /** The saddle height nearest the current one that the body can ride with every other setting as it is. */
  const saddleFix = $derived(
    nearestPossible(range[0], range[1], 0.5, current.saddleHeight, (v) => whyImpossible({ ...current, saddleHeight: v })),
  );
  /** Highest saddle height at which the foot still reaches the pedal, whatever the frame allows. */
  const legTop = $derived(highestWhere(300, range[1], 0.5, (v) => reaches({ ...current, saddleHeight: v })));
  const lowestSaddle = $derived(frame.seatTubeLength + POST_SHOWING[0]);
  const tooBig = $derived(saddleFix === null && legTop !== null && lowestSaddle > legTop);
  /** For a frame too big: the largest size of its model whose lowest saddle the legs reach. */
  const smaller = $derived.by(() => {
    if (!tooBig || !cat || legTop === null) return null;
    const fam = sizeFamily(frame, cat.CATALOG, cat.toFrame);
    if (!fam) return null;
    const fits = fam.filter((o) => o.frame.seatTubeLength + POST_SHOWING[0] <= legTop);
    return fits.length ? fits.reduce((a, b) => (b.frame.seatTubeLength > a.frame.seatTubeLength ? b : a)) : null;
  });

  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  function setSaddle(v: number) {
    ui.animate = true;
    app.current.saddleHeight = v;
    clearGhost();
  }
  function useSize(f: Frame) {
    if (app.frames.some((x) => x.id === f.id)) selectFrame(f.id);
    else addCatalogFrame(f);
    // Start the smaller frame from the highest saddle the legs reach, so it is ridable at once.
    if (legTop !== null) setSaddle(Math.max(f.seatTubeLength + POST_SHOWING[0], Math.min(current.saddleHeight, legTop)));
  }
</script>

<div class="banner" role="alert">
  {#if tooBig && legTop !== null}
    <b>This frame is too big for you.</b>
    <p>
      With the seatpost all the way down the saddle sits {fmt(lowestSaddle)} mm above the bottom bracket, and your
      feet leave the pedals above {fmt(legTop)} mm.
    </p>
    {#if smaller}
      <div class="row">
        <button type="button" class="btn small primary" onclick={() => useSize(smaller!.frame)}>Try size {smaller.size}</button>
      </div>
    {:else}
      <p>Find a bike lists the frames and sizes that fit you.</p>
    {/if}
  {:else if saddleFix !== null}
    <b>{cap(IMPOSSIBLE_TEXT[why])}.</b>
    <p>
      {saddleFix < current.saddleHeight ? 'Lowering' : 'Raising'} the saddle to {fmt(saddleFix)} mm
      ({fmt(Math.abs(saddleFix - current.saddleHeight))} mm {saddleFix < current.saddleHeight ? 'down' : 'up'}) fixes it, or let Optimize find a setup.
    </p>
    <div class="row">
      <button type="button" class="btn small primary" onclick={() => setSaddle(saddleFix!)}>
        {saddleFix < current.saddleHeight ? 'Lower' : 'Raise'} saddle to {fmt(saddleFix)} mm
      </button>
      <button type="button" class="btn small" disabled={ui.busy} onclick={optimize}>Optimize</button>
    </div>
  {:else}
    <b>{cap(IMPOSSIBLE_TEXT[why])}.</b>
    <p>No saddle height fixes it with these parts. Optimize can try others.</p>
    <div class="row">
      <button type="button" class="btn small primary" disabled={ui.busy} onclick={optimize}>Optimize</button>
    </div>
  {/if}
</div>

<style>
  .banner {
    margin: 0 0 14px; padding: 12px 14px; border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--off) 45%, transparent);
    background: color-mix(in srgb, var(--off) 10%, transparent);
  }
  b { color: var(--off); }
  p { margin: 4px 0 0; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .btn { margin: 0; }
</style>
