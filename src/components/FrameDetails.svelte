<script lang="ts">
  import { activeFrame, app } from '../state.svelte';
  import NumberField from './NumberField.svelte';

  const full = $derived(app.detail.bikeFull);
  const frame = $derived(activeFrame());
  const isCatalog = $derived(frame.id.startsWith('cat:'));
  const o = $derived(app.options);
  const list = (a: number[], u: string) => a.map((x) => x + u).join(', ');
</script>

{#key frame.id}
  {#if !isCatalog}
    <label class="name">
      <span>Name</span>
      <input type="text" bind:value={frame.name} />
    </label>
  {/if}
  <div class="grid">
    <NumberField label="Stack" link="f:stack" unit="mm" min={400} max={800} step={1} bind:value={frame.stack} />
    <NumberField label="Reach" link="f:reach" unit="mm" min={300} max={500} step={1} bind:value={frame.reach} />
    {#if full}
      <NumberField label="Seat tube angle" link="f:seatTubeAngle" unit="°" min={65} max={80} step={0.1} bind:value={frame.seatTubeAngle} />
      <NumberField label="Head tube angle" link="f:headTubeAngle" unit="°" min={65} max={80} step={0.1} bind:value={frame.headTubeAngle} />
      <NumberField label="Head tube length" link="f:headTubeLength" unit="mm" min={80} max={260} step={1} bind:value={frame.headTubeLength} />
      <NumberField label="Seat tube length" link="f:seatTubeLength" unit="mm" min={330} max={650} step={1} bind:value={frame.seatTubeLength} />
      <NumberField label="Chainstay" link="f:chainstay" unit="mm" min={380} max={470} step={1} bind:value={frame.chainstay} />
      <NumberField label="Wheelbase" link="f:wheelbase" unit="mm" min={900} max={1200} step={1} bind:value={frame.wheelbase} />
      <NumberField label="BB drop" link="f:bbDrop" unit="mm" min={40} max={90} step={1} bind:value={frame.bbDrop} />
      <NumberField label="Max spacers" link="f:maxSpacers" unit="mm" min={0} max={80} step={5} hint="Steerer room above the headset. Catalog frames use a typical value for their category; check yours." bind:value={frame.maxSpacers} />
      <NumberField label="Tyre width" link="f:tyreWidth" unit="mm" min={23} max={60} step={1} hint="Catalog frames use a typical width for their category." bind:value={frame.tyreWidth} />
    {/if}
  </div>
{/key}
<button type="button" class="link" onclick={() => (app.detail.bikeFull = !app.detail.bikeFull)}>
  {full ? 'Show fewer measurements' : 'Show all measurements'}
</button>

{#if full}
  <h2>Cockpit and saddle</h2>
  <div class="grid">
    <NumberField label="Bar reach" link="c:barReach" unit="mm" min={60} max={110} step={1} bind:value={app.components.barReach} />
    <NumberField label="Bar drop" link="c:barDrop" unit="mm" min={100} max={160} step={1} bind:value={app.components.barDrop} />
    <NumberField label="Saddle length" link="c:saddleLength" unit="mm" min={230} max={300} step={1} hint="Tip to tail; short-nose saddles are about 245" bind:value={app.components.saddleLength} />
  </div>
{/if}

{#if full}
  <h2>Contact details</h2>
  <div class="grid">
    <NumberField label="Shoe + pedal stack" link="c:footStack" unit="mm" min={5} max={40} step={1} bind:value={app.components.footStack} />
    <NumberField label="Headset cap" link="c:headsetCap" unit="mm" min={0} max={30} step={1} bind:value={app.components.headsetCap} />
    <NumberField label="Hood reach" link="c:hoodReach" unit="mm" min={0} max={50} step={1} bind:value={app.components.hoodReach} />
    <NumberField label="Hood rise" link="c:hoodRise" unit="mm" min={0} max={50} step={1} bind:value={app.components.hoodRise} />
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

<style>
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 600; padding: 8px 0; min-height: 36px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 0 10px; }
  @media (min-width: 420px) { .grid { grid-template-columns: 1fr 1fr; } }
  .name { display: block; margin-bottom: 12px; font-weight: 600; font-size: 13px; }
  .name span { display: block; margin-bottom: 4px; }
</style>
