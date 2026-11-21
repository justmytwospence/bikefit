<script lang="ts">
  import { buildSummary } from '../model/advice';
  import type { CompareRow } from '../model/optimize';
  import type { Verdict } from '../model/verdict';
  import { betweenSizes, type ModelGroup, type SizeEntry, type Standing } from '../lib/sizes';
  import { peek } from '../lib/peek.svelte';
  import { ui, type Peek } from '../state.svelte';
  import SizeCompare from './SizeCompare.svelte';

  let { group, withCleats, showScore = false, showing = null, onshow, onuse }: {
    group: ModelGroup;
    withCleats: boolean;
    showScore?: boolean;
    /** Frame id currently shown on the drawing, if any. */
    showing?: string | null;
    /** Show a size on the drawing; `other` is the size it is too close to call against, if any. */
    onshow: (e: SizeEntry, other: SizeEntry | null) => void;
    onuse: (row: CompareRow) => void;
  } = $props();

  const OK = 'Every angle is inside its target range.';
  const CHIP: Record<Verdict, string> = { fits: 'Fits', compromise: 'Compromise', no: 'No fit' };
  const STANDING_TEXT: Record<Standing, string> = {
    pick: 'best size', alt: 'fits as well', ok: 'can be made to work', far: 'too far off', no: 'does not fit',
  };

  let shownId = $state<string | null>(null);
  const pair = $derived(betweenSizes(group.sizes));
  const entry = $derived(
    group.sizes.find((s) => s.row.frameId === shownId) ?? group.sizes.find((s) => s.row === group.best) ?? group.sizes[0],
  );
  const row = $derived(entry.row);
  const pickSize = $derived(group.sizes.find((s) => s.standing === 'pick')?.size ?? '');
  const size = $derived(entry.size);
  const notes = $derived([...row.result.flags, ...row.result.notes.filter((n) => n !== OK)].slice(0, 3));
  const facts = $derived.by(() => {
    const f = row.result.facts;
    const drop = Math.round(f.barDrop);
    const parts = [
      drop < 0 ? `Bars ${-drop} mm above the saddle` : `Bars ${drop} mm below the saddle`,
      f.standover < 0 ? 'standover looks tight' : `about ${Math.round(f.standover)} mm of standover clearance`,
    ];
    if (f.toeClearance < 0) parts.push(`toe overlap ${Math.round(-f.toeClearance)} mm`);
    return parts.join(' · ');
  });
  /** The other half of a between-sizes pair, when this size is one half. */
  const otherOf = (e: SizeEntry): SizeEntry | null => (pair && pair.includes(e) ? pair.find((x) => x !== e)! : null);
  /** What pointing at a size shows on the drawing, with its between-sizes partner in outline. */
  function bikePeek(e: SizeEntry): Peek {
    const o = otherOf(e);
    return {
      kind: 'bike', row: e.row, frame: e.frame,
      other: o ? { row: o.row, frame: o.frame, size: o.size } : null,
    };
  }
  const peekId = $derived(ui.peek?.kind === 'bike' ? ui.peek.row.frameId : null);
  function show(e: SizeEntry) {
    shownId = e.row.frameId;
    onshow(e, otherOf(e));
  }
</script>

<div class="card" class:peeked={peekId !== null && group.sizes.some((s) => s.row.frameId === peekId)} use:peek={() => bikePeek(entry)}>
  <div class="top">
    <span class="fname">{group.name}</span>
    {#if showScore}<span class="score" title="How close this size gets to your ideal position with the parts it is sold with">{row.result.score}</span>{/if}
    <span class="chip {row.result.verdict}">{CHIP[row.result.verdict]}</span>
  </div>
  {#if group.sizes.length > 1}
    <div class="sizes" role="group" aria-label="Sizes of {group.name}">
      {#each group.sizes as s (s.row.frameId)}
        <button
          type="button" class="sz {s.standing}" class:on={s === entry}
          aria-pressed={s === entry} aria-label="Size {s.size}: {STANDING_TEXT[s.standing]}"
          title="{STANDING_TEXT[s.standing]} ({s.row.result.score})" onclick={() => show(s)}
          use:peek={() => bikePeek(s)}
        >{s.size}</button>
      {/each}
    </div>
  {/if}
  {#if pair}
    <SizeCompare {pair} entries={group.sizes} activeId={showing} onpick={show} peekOf={bikePeek} />
  {/if}
  <div class="small">{buildSummary(row.result.params, withCleats)}</div>
  <div class="small muted">{facts}</div>
  <!-- Room for three notes when sizes can be switched, so the cards below stay put. -->
  <div class="notes" class:reserve={group.sizes.length > 1}>
    {#if notes.length}
      {#each notes as n}<div class="small muted">{n}</div>{/each}
    {:else if entry.standing === 'pick' || entry.standing === 'alt'}
      <div class="small okc">Fits within every target</div>
    {:else}
      <div class="small muted">{entry.standing === 'ok' ? 'Can be made to work, but' : 'Too far off:'} size {pickSize} suits you better.</div>
    {/if}
  </div>
  <div class="btnrow">
    <button type="button" class="btn small show" disabled={showing === row.frameId} onclick={() => show(entry)}>
      {showing === row.frameId ? 'Showing' : size ? `Show size ${size}` : 'Show'}
    </button>
    <button type="button" class="btn small primary" onclick={() => onuse(row)}>Make it my bike</button>
  </div>
</div>

<style>
  .card.peeked { outline: 2px solid var(--accent); outline-offset: -1px; }
  .btnrow { display: flex; gap: 8px; flex-wrap: wrap; }
  .sizes { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .sz { min-width: 44px; min-height: 36px; border-radius: 10px; border: 2px solid transparent; font-weight: 700; background: var(--surface-2); }
  .sz.pick { color: var(--accent-ink); background: var(--ok); }
  .sz.alt { color: var(--ok); }
  .sz.ok { color: var(--near); }
  .sz.far { color: var(--muted); opacity: 0.7; }
  .sz.no { color: var(--off); opacity: 0.6; }
  .sz.on { border-color: currentColor; background: var(--surface); }
  .sz.pick.on { color: var(--ok); }
  .top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .fname { flex: 1; font-weight: 600; }
  .score { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); background: var(--surface-2); border-radius: 999px; padding: 2px 9px; font-size: 12px; }
  .chip { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .chip.fits { color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent); }
  .chip.compromise { color: var(--near); background: color-mix(in srgb, var(--near) 16%, transparent); }
  .chip.no { color: var(--off); background: color-mix(in srgb, var(--off) 14%, transparent); }
  .okc { color: var(--ok); font-weight: 600; }
  .btn { margin-top: 10px; }
  .show { min-width: 128px; }
  .notes.reserve { min-height: calc(3 * 1.4 * 13px); }
</style>
