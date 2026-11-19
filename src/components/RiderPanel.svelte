<script lang="ts">
  import { hiddenRiderValues, LEVEL_OPTIONS, type Level } from '../lib/appData';
  import { effectiveShoeSize, resolveSegments, SEGMENT_LABELS } from '../model/body';
  import { ANKLING, EFFORT_LABELS, HANDS_LABELS, shoeLabel } from '../model/riding';
  import { feetInches, fromDisplay, fromFeetInches, lengthField, toDisplay } from '../lib/units';
  import { STYLES } from '../model/styles';
  import type { Ankling, Effort, Flexibility, HandsPref, Sex } from '../model/types';
  import { app } from '../state.svelte';
  import NumberField from './NumberField.svelte';
  import QuestionBar from './QuestionBar.svelte';
  import Segmented from './Segmented.svelte';

  const lv = $derived(app.detail.rider);
  const est = $derived(resolveSegments({ ...app.body, overrides: {} }));
  const keys = Object.keys(SEGMENT_LABELS) as (keyof typeof SEGMENT_LABELS)[];
  const style = $derived(STYLES[app.styleId]);
  const hidden = $derived(hiddenRiderValues(app));
  const styleOptions = Object.values(STYLES).map((s) => ({ value: s.id, label: s.name }));
  const shoes = Array.from({ length: 29 }, (_, i) => 36 + i * 0.5);

  const sexes: { value: Sex; label: string }[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ];
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
  const getOv = (k: keyof typeof SEGMENT_LABELS) => app.body.overrides[k] ?? est[k];
  const imperial = $derived(app.units === 'imperial');
  const heightF = $derived(lengthField(app.units, 'cm', 1400, 2100));
  const inseamF = $derived(lengthField(app.units, 'cm', 600, 1050));
  const armF = $derived(lengthField(app.units, 'cm', 500, 900));
  const segF = $derived(lengthField(app.units, 'mm', 50, 900));
  const fi = $derived(feetInches(app.body.height));
</script>

<QuestionBar
  label="Measurements" ariaLabel="How much you measured" options={LEVEL_OPTIONS}
  bind:value={() => String(app.detail.rider), (v) => (app.detail.rider = Number(v) as Level)}
/>
<div class="scroll">
  {#if !app.seenIntro}
    <div class="card intro">
      <b>Start here</b>
      <ol>
        <li>Enter your height and inseam below, and pick how you ride.</li>
        <li>Have a bike? Pick it in Fit my bike and press Optimize.</li>
        <li>Shopping? Find a bike ranks the catalog for your body.</li>
      </ol>
      <button type="button" class="btn small" onclick={() => (app.seenIntro = true)}>Got it</button>
    </div>
  {/if}
  <h2>Body</h2>
  <Segmented options={sexes} bind:value={app.body.sex} ariaLabel="Body type" />
  <p class="muted small hint sexhint">Sets typical proportions. Your own measurements override them.</p>
  <div class="two">
    {#if imperial}
      <NumberField
        label="Height" unit="ft" min={4} max={7} step={1}
        bind:value={() => fi.ft, (v) => (app.body.height = fromFeetInches(v, fi.inch))}
      />
      <NumberField
        label="Height" unit="in" min={0} max={11.5} step={0.5}
        bind:value={() => fi.inch, (v) => (app.body.height = fromFeetInches(fi.ft, v))}
      />
    {:else}
      <NumberField
        label="Height" unit={heightF.unit} min={heightF.min} max={heightF.max} step={heightF.step}
        bind:value={() => toDisplay(app.body.height, heightF), (v) => (app.body.height = fromDisplay(v, heightF))}
      />
    {/if}
    <NumberField
      label="Inseam" unit={inseamF.unit} min={inseamF.min} max={inseamF.max} step={inseamF.step}
      bind:value={() => toDisplay(app.body.inseam, inseamF), (v) => (app.body.inseam = fromDisplay(v, inseamF))}
    />
  </div>
  <p class="muted small">Inseam: barefoot, floor to crotch with a book pressed up firmly; 3 to 5 cm more than trouser inseam.</p>

  <div class="shoe">
    <div class="lrow">
      <label for="shoe">Shoe size</label>
      {#if app.body.shoeSizeAuto}<span class="estb">suggested</span>
      {:else}<button type="button" class="relink" onclick={() => (app.body.shoeSizeAuto = true)}>Use suggested</button>{/if}
    </div>
    <select
      id="shoe" value={String(effectiveShoeSize(app.body))}
      onchange={(e) => { app.body.shoeSize = Number(e.currentTarget.value); app.body.shoeSizeAuto = false; }}
    >
      {#each shoes as s (s)}<option value={String(s)}>{shoeLabel(s, app.units)}</option>{/each}
    </select>
  </div>
  <p class="muted small hint">The size of your cycling shoes.</p>

  <h2>Flexibility</h2>
  <Segmented options={flex} bind:value={app.body.flexibility} ariaLabel="Flexibility" />
  <p class="muted small hint">Can you touch your toes with straight legs? Easily = High.</p>

  <h2>How you ride</h2>
  <Segmented options={styleOptions} compact bind:value={app.styleId} ariaLabel="Riding style" />
  <p class="muted small hint">{style.blurb}</p>
  {#if lv >= 2}
    <div class="lrow">
      <span>Effort</span>
      {#if app.effort != null}<button type="button" class="relink" onclick={() => (app.effort = null)}>Use default</button>{/if}
    </div>
    <Segmented options={efforts} ariaLabel="Effort" bind:value={() => effort, (v) => (app.effort = v)} />
    <p class="muted small hint">{EFFORT_LABELS[effort].hint}</p>
    <div class="lrow">
      <span>Where your hands are</span>
      {#if app.hands != null}<button type="button" class="relink" onclick={() => (app.hands = null)}>Use default</button>{/if}
    </div>
    <Segmented options={hands} ariaLabel="Hand position" bind:value={() => handsPref, (v) => (app.hands = v)} />

    <h2>Arms and feet</h2>
    <NumberField
      label="Arm length" unit={armF.unit} min={armF.min} max={armF.max} step={armF.step}
      estimated={app.body.armLength == null} onreset={() => (app.body.armLength = null)}
      hint="Arm hanging straight: bony point of the shoulder to the centre of your closed fist"
      bind:value={() => toDisplay(app.body.armLength ?? 0.375 * app.body.height, armF), (v) => (app.body.armLength = fromDisplay(v, armF))}
    />
    <div class="label">Ankling</div>
    <Segmented options={ankles} bind:value={app.body.ankling} ariaLabel="Ankling" />
    <p class="muted small hint">{ANKLING[app.body.ankling].hint}</p>
  {/if}

  {#if lv >= 3}
    <h2>Body segments</h2>
    <p class="muted small">Estimated from your height and inseam. Enter measured values to override.</p>
    <div class="two">
      {#each keys as k (k)}
        <NumberField
          label={SEGMENT_LABELS[k]} unit={segF.unit} min={segF.min} max={segF.max} step={segF.step}
          estimated={app.body.overrides[k] == null}
          bind:value={() => toDisplay(getOv(k), segF), (v) => (app.body.overrides[k] = fromDisplay(v, segF))}
        />
      {/each}
    </div>
    <button type="button" class="btn small" onclick={() => (app.body.overrides = {})}>Use estimates</button>
  {/if}

  {#if hidden > 0}
    <p class="muted small hid">
      Using {hidden} value{hidden === 1 ? '' : 's'} from a more detailed level.
      <button type="button" class="link" onclick={() => (app.detail.rider = Object.keys(app.body.overrides).length ? 3 : 2)}>Show</button>
    </p>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hint { margin-top: 6px; }
  .sexhint { margin-bottom: 14px; }
  .estb { font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface-2); border-radius: 999px; padding: 1px 6px; margin-left: 2px; }
  .label { display: block; font-weight: 600; font-size: 13px; margin: 12px 0 4px; }
  /* A label with an optional reset link on the right; the row's height never changes. */
  .lrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; font-weight: 600; font-size: 13px; margin: 12px 0 4px; }
  .shoe .lrow { margin-top: 4px; }
  .relink { border: 0; background: transparent; color: var(--accent); font-weight: 600; font-size: 12px; padding: 0; min-height: 28px; }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 600; padding: 8px 0; min-height: 36px; }
  .hid { margin-top: 22px; }
  .intro ol { margin: 6px 0 10px; padding-left: 20px; }
</style>
