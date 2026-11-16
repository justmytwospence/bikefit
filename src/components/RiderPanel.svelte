<script lang="ts">
  import { hiddenRiderValues, level } from '../lib/appData';
  import { resolveSegments, SEGMENT_LABELS } from '../model/body';
  import { ANKLING, EFFORT_LABELS, HANDS_LABELS, shoeLabel } from '../model/riding';
  import { STYLES } from '../model/styles';
  import type { Ankling, Effort, Flexibility, HandsPref } from '../model/types';
  import { app, setSectionDetail } from '../state.svelte';
  import DetailToggle from './DetailToggle.svelte';
  import NumberField from './NumberField.svelte';
  import Segmented from './Segmented.svelte';

  const lv = $derived(level(app, 'rider'));
  const est = $derived(resolveSegments({ ...app.body, overrides: {} }));
  const keys = Object.keys(SEGMENT_LABELS) as (keyof typeof SEGMENT_LABELS)[];
  const style = $derived(STYLES[app.styleId]);
  const hidden = $derived(hiddenRiderValues(app));
  const shoes = Array.from({ length: 29 }, (_, i) => 36 + i * 0.5);

  const flex: { value: Flexibility; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];
  const ankles = (Object.keys(ANKLING) as Ankling[]).map((k) => ({ value: k, label: ANKLING[k].label }));
  const efforts = (Object.keys(EFFORT_LABELS) as Effort[]).map((k) => ({ value: k, label: EFFORT_LABELS[k].label }));
  const hands = (Object.keys(HANDS_LABELS) as HandsPref[]).map((k) => ({ value: k, label: HANDS_LABELS[k] }));
  const effort = $derived(app.effort ?? style.defaultEffort);
  const handsPref = $derived(app.hands ?? style.defaultHands);
  const getOv = (k: keyof typeof SEGMENT_LABELS) => app.body.overrides[k] ?? Math.round(est[k]);
</script>

<DetailToggle section="rider" />
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

  <label class="shoe">
    <span class="l">Shoe size {#if app.body.shoeSize == null}<span class="estb">est.</span>{/if}</span>
    <select
      value={app.body.shoeSize == null ? '' : String(app.body.shoeSize)}
      onchange={(e) => (app.body.shoeSize = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
    >
      <option value="">Estimate from height</option>
      {#each shoes as s (s)}<option value={String(s)}>{shoeLabel(s)}</option>{/each}
    </select>
  </label>

  <h2>Flexibility</h2>
  <Segmented options={flex} bind:value={app.body.flexibility} ariaLabel="Flexibility" />
  <p class="muted small hint">Can you touch your toes with straight legs? Easily = High.</p>

  {#if lv >= 2}
    <h2>Arms and feet</h2>
    <NumberField
      label="Arm length" unit="cm" min={50} max={90} step={0.5}
      estimated={app.body.armLength == null}
      hint="Arm hanging straight: bony point of the shoulder to the centre of your closed fist"
      bind:value={() => Math.round((app.body.armLength ?? 0.375 * app.body.height) / 1) / 10, (v) => (app.body.armLength = v * 10)}
    />
    {#if app.body.armLength != null}
      <button type="button" class="link" onclick={() => (app.body.armLength = null)}>Use estimate</button>
    {/if}
    <div class="label">Ankling</div>
    <Segmented options={ankles} bind:value={app.body.ankling} ariaLabel="Ankling" />
    <p class="muted small hint">{ANKLING[app.body.ankling].hint}</p>

    <h2>Riding</h2>
    <div class="label">Effort</div>
    <Segmented options={efforts} ariaLabel="Effort" bind:value={() => effort, (v) => (app.effort = v)} />
    <p class="muted small hint">{EFFORT_LABELS[effort].hint}</p>
    <div class="label">Where your hands are</div>
    <Segmented options={hands} ariaLabel="Hand position" bind:value={() => handsPref, (v) => (app.hands = v)} />
    {#if app.effort != null || app.hands != null}
      <button type="button" class="link" onclick={() => { app.effort = null; app.hands = null; }}>Use style default</button>
    {/if}
  {/if}

  {#if lv >= 3}
    <h2>Body segments</h2>
    <p class="muted small">Estimated from your height and inseam. Enter measured values to override.</p>
    <div class="two">
      {#each keys as k (k)}
        <NumberField
          label={SEGMENT_LABELS[k]} unit="mm" min={50} max={900} step={5}
          estimated={app.body.overrides[k] == null}
          bind:value={() => getOv(k), (v) => (app.body.overrides[k] = v)}
        />
      {/each}
    </div>
    <button type="button" class="btn small" onclick={() => (app.body.overrides = {})}>Use estimates</button>
  {/if}

  {#if hidden > 0}
    <p class="muted small hid">
      Using {hidden} value{hidden === 1 ? '' : 's'} from a more detailed level.
      <button type="button" class="link" onclick={() => setSectionDetail('rider', Object.keys(app.body.overrides).length ? 3 : 2)}>Show</button>
    </p>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hint { margin-top: 6px; }
  .shoe { display: block; margin-top: 4px; }
  .l, .label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
  .label { margin-top: 12px; }
  .estb { font-size: 11px; color: var(--muted); background: var(--surface-2); border-radius: 999px; padding: 1px 6px; }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 600; padding: 8px 0; min-height: 36px; }
  .hid { margin-top: 22px; }
</style>
