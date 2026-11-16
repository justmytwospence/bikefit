<script lang="ts">
  import { resolveSegments, SEGMENT_LABELS } from '../model/body';
  import type { Flexibility, Segments } from '../model/types';
  import { app } from '../state.svelte';
  import NumberField from './NumberField.svelte';
  import Segmented from './Segmented.svelte';

  const est = $derived(resolveSegments({ ...app.body, overrides: {} }));
  const keys = Object.keys(SEGMENT_LABELS) as (keyof typeof SEGMENT_LABELS)[];
  const flex: { value: Flexibility; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];
  const getOv = (k: keyof Segments) => app.body.overrides[k] ?? Math.round(est[k]);
</script>

<div class="scroll">
  <h2>Body</h2>
  <div class="two">
    <NumberField
      label="Height" unit="cm" min={140} max={210} step={0.5}
      bind:value={() => app.body.height / 10, (v) => (app.body.height = v * 10)}
    />
    <NumberField
      label="Inseam" unit="cm" min={60} max={105} step={0.5}
      bind:value={() => app.body.inseam / 10, (v) => (app.body.inseam = v * 10)}
    />
  </div>
  <p class="muted small">Inseam: barefoot, floor to crotch with a book pressed up firmly.</p>

  <h2>Flexibility</h2>
  <Segmented options={flex} bind:value={app.body.flexibility} ariaLabel="Flexibility" />
  <p class="muted small hint">Can you touch your toes with straight legs? Easily = High.</p>

  <details>
    <summary>Body segments (advanced)</summary>
    <p class="muted small">Estimated from your height and inseam. Enter measured values to override.</p>
    <div class="two">
      {#each keys as k (k)}
        <NumberField
          label={SEGMENT_LABELS[k]} unit="mm" min={50} max={900} step={5}
          bind:value={() => getOv(k), (v) => (app.body.overrides[k] = v)}
        />
      {/each}
    </div>
    <button type="button" class="btn small" onclick={() => (app.body.overrides = {})}>Use estimates</button>
  </details>
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hint { margin-top: 6px; }
  details { margin-top: 22px; }
  summary { font-weight: 600; cursor: pointer; min-height: 44px; display: flex; align-items: center; }
</style>
