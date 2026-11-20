<script lang="ts" module>
  import type { Layout } from '../../model/types';
  import type { Vec2 } from '../../model/vec';

  function words(a: Vec2, b: Vec2): string {
    const out: string[] = [];
    const dy = Math.round(b.y - a.y);
    const dx = Math.round(b.x - a.x);
    if (Math.abs(dy) >= 3) out.push(`${Math.abs(dy)} mm ${dy > 0 ? 'up' : 'down'}`);
    // x grows towards the front wheel.
    if (Math.abs(dx) >= 3) out.push(`${Math.abs(dx)} mm ${dx > 0 ? 'forward' : 'back'}`);
    return out.join(', ');
  }

  /** How far the saddle and bars move from one layout to the other; only the ones that move 3 mm or more. */
  export function moves(from: Layout, to: Layout) {
    return [
      { key: 'saddle', name: 'Saddle', a: from.saddle, b: to.saddle },
      { key: 'bars', name: 'Bars', a: from.hoods, b: to.hoods },
    ]
      .map((m) => ({ ...m, text: words(m.a, m.b) }))
      .filter((m) => m.text)
      .map((m) => ({ ...m, label: `${m.name} ${m.text}` }));
  }
</script>

<script lang="ts">
  /** Arrows from where the saddle and bars are now to where the target puts them; labelled when there is room. */
  let { from, to, fs, vb, labels = true }: {
    from: Layout; to: Layout; fs: number; vb: { x: number; w: number }; labels?: boolean;
  } = $props();

  const size = $derived(0.85 * fs);
  const items = $derived(
    moves(from, to)
      .map((m) => {
        const w = m.label.length * 0.56 * size;
        return m.key === 'saddle'
          ? { ...m, anchor: 'end', at: { x: Math.max(vb.x + w + 10, m.b.x - 150), y: m.b.y - 1.5 * fs } }
          : { ...m, anchor: 'start', at: { x: Math.min(vb.x + vb.w - w - 10, m.b.x + 60), y: m.b.y + 2.5 * fs } };
      }),
  );
</script>

{#each items as m (m.key)}
  <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke="var(--accent)" stroke-width="6" />
  <circle cx={m.a.x} cy={m.a.y} r="10" stroke="var(--muted)" stroke-width="5" fill="none" />
  <circle cx={m.b.x} cy={m.b.y} r="10" fill="var(--accent)" stroke="none" />
  {#if labels}<text
    transform="translate({m.at.x},{m.at.y}) scale(1,-1)" text-anchor={m.anchor} dominant-baseline="central"
    font-size={size} font-weight="700" fill="var(--accent)"
    style="paint-order:stroke; stroke:var(--bg); stroke-width:{size * 0.35}px; stroke-linejoin:round"
  >{m.label}</text>{/if}
{/each}
