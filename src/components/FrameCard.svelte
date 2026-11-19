<script lang="ts">
  import { buildSummary } from '../model/advice';
  import type { CompareRow } from '../model/optimize';
  import type { Verdict } from '../model/verdict';
  import type { ModelGroup } from '../lib/sizes';

  let { group, withCleats, showScore = false, showing = null, onshow, onuse }: {
    group: ModelGroup;
    withCleats: boolean;
    showScore?: boolean;
    /** Frame id currently shown on the drawing, if any. */
    showing?: string | null;
    onshow: (row: CompareRow) => void;
    onuse: (row: CompareRow) => void;
  } = $props();

  const OK = 'Every angle is inside its target range.';
  const VERDICT_TEXT = { fits: 'fits', compromise: 'fits with compromises', no: 'does not fit' } as const;
  const CHIP: Record<Verdict, string> = { fits: 'Fits', compromise: 'Compromise', no: 'No fit' };

  let shownId = $state<string | null>(null);
  const row = $derived(group.sizes.find((s) => s.row.frameId === shownId)?.row ?? group.best);
  const size = $derived(group.sizes.find((s) => s.row === row)?.size ?? '');
  const notes = $derived([...row.result.flags, ...row.result.notes.filter((n) => n !== OK)].slice(0, 3));
  const facts = $derived.by(() => {
    const f = row.result.facts;
    const drop = Math.round(f.barDrop);
    const parts = [
      drop < 0 ? `Bars ${-drop} mm above the saddle` : `Bars ${drop} mm below the saddle`,
      f.standover < 0 ? 'no standover clearance' : `standover about ${Math.round(f.standover)} mm`,
    ];
    if (f.toeClearance < 0) parts.push(`toe overlap ${Math.round(-f.toeClearance)} mm`);
    return parts.join(' · ');
  });
</script>

<div class="card">
  <div class="top">
    <span class="fname">{group.name}</span>
    {#if showScore}<span class="score" title="Fit score">{row.result.score}</span>{/if}
    <span class="chip {row.result.verdict}">{CHIP[row.result.verdict]}</span>
  </div>
  {#if group.sizes.length > 1}
    <div class="sizes" role="group" aria-label="Sizes of {group.name}">
      {#each group.sizes as s (s.row.frameId)}
        <button
          type="button" class="sz {s.row.result.verdict}" class:on={s.row === row}
          aria-pressed={s.row === row} aria-label="Size {s.size}: {VERDICT_TEXT[s.row.result.verdict]}"
          title={VERDICT_TEXT[s.row.result.verdict]} onclick={() => { shownId = s.row.frameId; onshow(s.row); }}
        >{s.size}</button>
      {/each}
    </div>
  {/if}
  <div class="small">{buildSummary(row.result.params, withCleats)}</div>
  <div class="small muted">{facts}</div>
  {#if notes.length}
    {#each notes as n}<div class="small muted">{n}</div>{/each}
  {:else}
    <div class="small okc">Fits within every target</div>
  {/if}
  <div class="btnrow">
    <button type="button" class="btn small" disabled={showing === row.frameId} onclick={() => onshow(row)}>
      {showing === row.frameId ? 'Showing' : size ? `Show size ${size}` : 'Show'}
    </button>
    <button type="button" class="btn small primary" onclick={() => onuse(row)}>Make it my bike</button>
  </div>
</div>

<style>
  .btnrow { display: flex; gap: 8px; flex-wrap: wrap; }
  .sizes { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .sz { min-width: 44px; min-height: 36px; border-radius: 10px; border: 2px solid transparent; font-weight: 700; background: var(--surface-2); }
  .sz.fits { color: var(--ok); }
  .sz.compromise { color: var(--near); }
  .sz.no { color: var(--off); }
  .sz.on { border-color: currentColor; background: var(--surface); }
  .top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .fname { flex: 1; font-weight: 600; }
  .score { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); background: var(--surface-2); border-radius: 999px; padding: 2px 9px; font-size: 12px; }
  .chip { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .chip.fits { color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent); }
  .chip.compromise { color: var(--near); background: color-mix(in srgb, var(--near) 16%, transparent); }
  .chip.no { color: var(--off); background: color-mix(in srgb, var(--off) 14%, transparent); }
  .okc { color: var(--ok); font-weight: 600; }
  .btn { margin-top: 10px; }
</style>
