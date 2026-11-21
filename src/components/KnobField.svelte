<script lang="ts">
  import { noseSetback, railForSetback, setbackRange } from '../model/geometry';
  import { IMPOSSIBLE_SHORT, IMPOSSIBLE_TEXT, possibleRange, type Impossible } from '../model/limits';
  import type { FitParams, ParamKey } from '../model/types';
  import { CRANK_CHOICES } from '../model/presets';
  import { crankFor } from '../model/score';
  import { clamp } from '../model/vec';
  import { link } from '../lib/link.svelte';
  import { activeFrame, app, kneeRangeFor, setKnob, ui } from '../state.svelte';
  import ChipRow from './ChipRow.svelte';
  import Info from './Info.svelte';
  import SliderField from './SliderField.svelte';

  /** One fit setting's control, on the setup being edited. */
  let { k, whyImpossible }: { k: ParamKey; whyImpossible: (p: FitParams) => Impossible | null } = $props();

  const frame = $derived(activeFrame());
  const o = $derived(app.options);
  const c = $derived(app.current);
  const b = $derived(app.baseline);
  /** The setup the settings change. */
  const ed = $derived(ui.editing === 'current' ? app.baseline : app.current);
  const isTarget = $derived(ui.editing === 'target');
  /** Hard stops apply to targets only: the current setup is what you measured, so it is never blocked. */
  const stops = $derived(isTarget);
  const cur = $derived($state.snapshot(ed) as FitParams);

  const setback = $derived(noseSetback(frame, app.components, ed));
  const setbackDelta = $derived(noseSetback(frame, app.components, c) - noseSetback(frame, app.components, b));
  const sbRange = $derived(setbackRange(frame, app.components, ed, o.railRange));

  // Hard stops: each knob may move only as far as the rider's body can still ride the bike.
  const with_ = (patch: Partial<FitParams>) => whyImpossible({ ...cur, ...patch });
  const saddleLim = $derived(possibleRange(
    o.saddleHeightRange[0], o.saddleHeightRange[1], 0.5, cur.saddleHeight, (v) => with_({ saddleHeight: v }),
  ));
  const sbMin = $derived(Math.ceil(sbRange[0] * 2) / 2);
  const sbMax = $derived(Math.floor(sbRange[1] * 2) / 2);
  const sbLim = $derived(possibleRange(
    sbMin, sbMax, 0.5, Math.round(setback * 2) / 2,
    (v) => with_({ railOffset: railForSetback(frame, app.components, cur, v) }),
  ));
  const spacerLim = $derived(possibleRange(0, frame.maxSpacers, o.spacerStep, cur.spacers, (v) => with_({ spacers: v })));
  const cleatLim = $derived(possibleRange(o.cleatRange[0], o.cleatRange[1], 1, cur.cleatOffset, (v) => with_({ cleatOffset: v })));
  type Lim = ReturnType<typeof possibleRange>;
  /** Whether the setup cannot be ridden at all; a banner says so once, instead of every slider. */
  const blocked = $derived(whyImpossible(cur));
  /** Says why the thumb cannot go further, while it sits against a limit. */
  function stopText(l: Lim, v: number): string | undefined {
    if (blocked) return undefined;
    if (v <= l.lo && l.lowWhy) return `Stops: ${IMPOSSIBLE_SHORT[l.lowWhy]}`;
    if (v >= l.hi && l.highWhy) return `Stops: ${IMPOSSIBLE_SHORT[l.highWhy]}`;
    return undefined;
  }
  /** Part choices the rider could not ride; the current one always stays available. */
  function blockedChips(key: ParamKey, options: number[]): Map<number, string> {
    const out = new Map<number, string>();
    for (const n of options) {
      if (n === cur[key]) continue;
      const w = with_({ [key]: n });
      if (w) out.set(n, `Out of reach: ${IMPOSSIBLE_TEXT[w]}`);
    }
    return out.size === options.filter((n) => n !== cur[key]).length && blocked ? new Map() : out;
  }

  function setSetback(v: number) {
    setKnob('railOffset', clamp(railForSetback(frame, app.components, cur, v), o.railRange[0], o.railRange[1]));
  }
  const kneeOk = $derived(k === 'saddleHeight' ? kneeRangeFor(cur) : null);
  const setbackLabel = (n: number) => (n === 0 ? 'Inline' : n + ' mm');
</script>

  {#if k === 'saddleHeight'}
    <div use:link={'saddleHeight'}>
    <SliderField
      label="Saddle height" min={o.saddleHeightRange[0]} max={o.saddleHeightRange[1]} step={0.5}
      bind:value={() => ed.saddleHeight, (v) => setKnob('saddleHeight', v)}
      limit={stops ? [saddleLim.lo, saddleLim.hi] : undefined} stop={stops ? stopText(saddleLim, cur.saddleHeight) : undefined}
      delta={isTarget ? c.saddleHeight - b.saddleHeight : 0}
      note={kneeOk ? `Knee in range: ${kneeOk[0]}–${kneeOk[1]} mm` : undefined}
      hint="BB centre to saddle top, along the seat tube. The model is good to about ±15 mm: fine-tune by feel, or check your knee angle on a side-on video."
    />
    </div>
  {:else if k === 'railOffset'}
    <div use:link={'setback'}>
    <SliderField
      label="Setback to saddle nose" min={sbMin} max={sbMax} step={0.5}
      bind:value={() => Math.round(setback * 2) / 2, setSetback}
      limit={stops ? [sbLim.lo, sbLim.hi] : undefined} stop={stops ? stopText(sbLim, Math.round(setback * 2) / 2) : undefined}
      delta={isTarget ? setbackDelta : 0} hint="Plumb from the saddle nose, behind the BB"
    />
    <p class="muted small rails">
      Rails: {cur.railOffset === 0 ? 'centred' : Math.abs(cur.railOffset) + ' mm ' + (cur.railOffset > 0 ? 'forward' : 'back') + ' of centre'}
    </p>
    </div>
  {:else if k === 'seatpostSetback'}
    <div use:link={'setback'}>
    <div class="chiphead">Seatpost setback</div>
    <div class="chips">
    <ChipRow options={o.seatpostSetbacks} bind:value={() => ed.seatpostSetback, (v) => setKnob('seatpostSetback', v)} format={setbackLabel} blocked={stops ? blockedChips('seatpostSetback', o.seatpostSetbacks) : undefined} />
    </div>
    </div>
  {:else if k === 'spacers'}
    <div use:link={'spacers'}>
    <SliderField
      label="Spacers" min={0} max={frame.maxSpacers} step={o.spacerStep}
      bind:value={() => ed.spacers, (v) => setKnob('spacers', v)}
      limit={stops ? [spacerLim.lo, spacerLim.hi] : undefined} stop={stops ? stopText(spacerLim, cur.spacers) : undefined}
      delta={isTarget ? c.spacers - b.spacers : 0} hint="Under the stem, above the headset"
    />
    </div>
  {:else if k === 'stemLength'}
    <div use:link={'stem'}>
    <div class="chiphead">Stem length</div>
    <div class="chips">
    <ChipRow options={o.stemLengths} bind:value={() => ed.stemLength, (v) => setKnob('stemLength', v)} format={(n) => n + ' mm'} blocked={stops ? blockedChips('stemLength', o.stemLengths) : undefined} />
    </div>
    </div>
  {:else if k === 'stemAngle'}
    <div use:link={'stem'}>
    <div class="chiphead">Stem angle</div>
    <div class="chips">
    <ChipRow
      options={o.stemAngles} bind:value={() => ed.stemAngle, (v) => setKnob('stemAngle', v)} blocked={stops ? blockedChips('stemAngle', o.stemAngles) : undefined}
      format={(n) => (n === 0 ? '0°' : (n > 0 ? '+' : '−') + Math.abs(n) + '°')}
    />
    </div>
    </div>
  {:else if k === 'cleatOffset'}
    <div use:link={'cleat'}>
    <SliderField
      label="Cleat position" unit="mm back" min={o.cleatRange[0]} max={o.cleatRange[1]} step={1}
      bind:value={() => ed.cleatOffset, (v) => setKnob('cleatOffset', v)}
      limit={stops ? [cleatLim.lo, cleatLim.hi] : undefined} stop={stops ? stopText(cleatLim, cur.cleatOffset) : undefined}
      delta={isTarget ? c.cleatOffset - b.cleatOffset : 0} hint="0 = pedal axle under the ball of the foot"
    />
    </div>
  {:else if k === 'crankLength'}
    <div use:link={'crank'}>
    <div class="chiphead">Crank length<Info text="Targets choose among the lengths nearest 20.5% of your inseam ({Math.round(crankFor(app.body.inseam))} mm). Set any length by hand." label="About crank length" /></div>
    <div class="chips">
    <ChipRow options={CRANK_CHOICES} bind:value={() => ed.crankLength, (v) => setKnob('crankLength', v)} format={(n) => n + ' mm'} blocked={stops ? blockedChips('crankLength', CRANK_CHOICES) : undefined} />
    </div>
    </div>
  {/if}

<style>
  .chiphead { display: flex; align-items: center; min-height: 36px; font-weight: 600; }
  .rails { margin: -4px 0 10px; }
</style>
