<script lang="ts">
  import { level } from '../lib/appData';
  import { activeFrame, app, deleteFrame, duplicateFrame, newFrame, selectFrame } from '../state.svelte';
  import FramePicker from './FramePicker.svelte';
  import DetailToggle from './DetailToggle.svelte';
  import NumberField from './NumberField.svelte';

  let picking = $state(false);
  const lv = $derived(level(app, 'bike'));
  const frame = $derived(activeFrame());
  const o = $derived(app.options);
  const list = (a: number[], u: string) => a.map((x) => x + u).join(', ');
</script>

<DetailToggle section="bike" />
<div class="scroll">
  <h2>Frame</h2>
  <select aria-label="Frame" value={app.activeFrameId} onchange={(e) => selectFrame(e.currentTarget.value)}>
    {#each app.frames as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
  </select>
  <div class="btns">
    <button type="button" class="btn small" onclick={() => (picking = !picking)}>Find a bike</button>
    <button type="button" class="btn small" onclick={duplicateFrame}>Duplicate</button>
    <button type="button" class="btn small" onclick={newFrame}>New</button>
    <button type="button" class="btn small" disabled={app.frames.length <= 1} onclick={() => deleteFrame(frame.id)}>Delete</button>
  </div>
  {#if picking}<div class="card picker"><FramePicker onclose={() => (picking = false)} /></div>{/if}

  <h2>Frame geometry</h2>
  {#key frame.id}
    <label class="name">
      <span>Name</span>
      <input type="text" bind:value={frame.name} />
    </label>
    <div class="grid">
      <NumberField label="Stack" unit="mm" min={400} max={800} step={1} bind:value={frame.stack} />
      <NumberField label="Reach" unit="mm" min={300} max={500} step={1} bind:value={frame.reach} />
      {#if lv >= 2}
        <NumberField label="Seat tube angle" unit="°" min={65} max={80} step={0.1} bind:value={frame.seatTubeAngle} />
        <NumberField label="Head tube angle" unit="°" min={65} max={80} step={0.1} bind:value={frame.headTubeAngle} />
        <NumberField label="Head tube length" unit="mm" min={80} max={260} step={1} bind:value={frame.headTubeLength} />
        <NumberField label="Seat tube length" unit="mm" min={330} max={650} step={1} bind:value={frame.seatTubeLength} />
        <NumberField label="Chainstay" unit="mm" min={380} max={470} step={1} bind:value={frame.chainstay} />
        <NumberField label="Wheelbase" unit="mm" min={900} max={1200} step={1} bind:value={frame.wheelbase} />
        <NumberField label="BB drop" unit="mm" min={40} max={90} step={1} bind:value={frame.bbDrop} />
        <NumberField label="Max spacers" unit="mm" min={0} max={80} step={5} hint="Steerer room above the headset" bind:value={frame.maxSpacers} />
        <NumberField label="Tyre width" unit="mm" min={23} max={60} step={1} bind:value={frame.tyreWidth} />
      {/if}
    </div>
  {/key}

  {#if lv >= 2}
    <h2>Cockpit and saddle</h2>
    <div class="grid">
      <NumberField label="Bar reach" unit="mm" min={60} max={110} step={1} bind:value={app.components.barReach} />
      <NumberField label="Bar drop" unit="mm" min={100} max={160} step={1} bind:value={app.components.barDrop} />
      <NumberField label="Saddle length" unit="mm" min={230} max={300} step={1} hint="Tip to tail; short-nose saddles are about 245" bind:value={app.components.saddleLength} />
    </div>
  {/if}

  {#if lv >= 3}
    <h2>Contact details</h2>
    <div class="grid">
      <NumberField label="Shoe + pedal stack" unit="mm" min={5} max={40} step={1} bind:value={app.components.footStack} />
      <NumberField label="Headset cap" unit="mm" min={0} max={30} step={1} bind:value={app.components.headsetCap} />
      <NumberField label="Hood reach" unit="mm" min={0} max={50} step={1} bind:value={app.components.hoodReach} />
      <NumberField label="Hood rise" unit="mm" min={0} max={50} step={1} bind:value={app.components.hoodRise} />
    </div>

    <h2>Parts the optimizer may choose</h2>
    <div class="card small">
      <div><b>Stem length</b> {list(o.stemLengths, '')} mm</div>
      <div><b>Stem angle</b> {list(o.stemAngles, '°')}</div>
      <div><b>Cranks</b> {list(o.crankLengths, '')} mm</div>
      <div><b>Seatpost setback</b> {list(o.seatpostSetbacks, '')} mm</div>
      <p class="muted" style="margin:8px 0 0">Defaults cover common parts.</p>
    </div>
  {/if}
</div>

<style>
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }
  .picker { margin-top: 12px; }
  .btns { display: flex; gap: 8px; margin-top: 10px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 0 10px; }
  @media (min-width: 420px) { .grid { grid-template-columns: 1fr 1fr; } }
  .name { display: block; margin-bottom: 12px; font-weight: 600; font-size: 13px; }
  .name span { display: block; margin-bottom: 4px; }
</style>
