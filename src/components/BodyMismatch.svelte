<script lang="ts">
  import { event } from '../lib/analytics';
  import type { Mismatch } from '../lib/mismatch';
  import { lengthField, toDisplay } from '../lib/units';
  import { app } from '../state.svelte';

  /** The current setup and the body measurements cannot both be right; offers the inseam that matches the setup. */
  let { mismatch }: { mismatch: Mismatch } = $props();

  const f = $derived(lengthField(app.units, 'cm', 600, 1050));
  const show = (mm: number) => `${toDisplay(mm, f)} ${f.unit}`;

  function match() {
    if (mismatch.inseam === null) return;
    app.body.inseam = mismatch.inseam;
    event('Inseam matched');
  }
</script>

<div class="banner" role="status">
  <b>Your saddle height and inseam disagree.</b>
  <p>
    {#if mismatch.over}
      With a {show(app.body.inseam)} inseam your foot could not reach the pedal at this saddle height.
    {:else}
      With a {show(app.body.inseam)} inseam your leg would be almost straight ({Math.round(mismatch.knee)}°) at this
      saddle height.
    {/if}
    {#if mismatch.inseam !== null}
      If this is how you ride, your inseam is probably nearer {show(mismatch.inseam)}: measure it barefoot, with a book
      pressed up firmly.
    {:else}
      Check the leg measurements on the Rider tab.
    {/if}
  </p>
  {#if mismatch.inseam !== null}
    <div class="row">
      <button type="button" class="btn small primary" onclick={match}>Set inseam to {show(mismatch.inseam)}</button>
    </div>
  {/if}
</div>

<style>
  .banner {
    margin: 0 0 14px; padding: 12px 14px; border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--near) 45%, transparent);
    background: color-mix(in srgb, var(--near) 10%, transparent);
  }
  b { color: var(--near); }
  p { margin: 4px 0 0; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .btn { margin: 0; }
</style>
