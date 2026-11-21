<script lang="ts">
  /** A small (i) that shows an explanation on hover, focus or tap, so the panels carry no sentences of their own. */
  let { text, label = 'More about this' }: { text: string; label?: string } = $props();

  let btn: HTMLButtonElement | undefined = $state();
  let pinned = $state(false);
  let hovering = $state(false);
  let at = $state({ left: 0, top: 0, w: 260, above: false });
  const open = $derived(pinned || hovering);

  /** Fixed to the viewport, so a scrolling panel never clips it; flips above when there is no room below. */
  function place() {
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 16);
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const above = r.bottom + 160 > window.innerHeight && r.top > 160;
    at = { left, top: above ? r.top - 6 : r.bottom + 6, w, above };
  }
  function show(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    place();
    hovering = true;
  }
</script>

<svelte:window
  onkeydown={(e) => { if (e.key === 'Escape') pinned = false; }}
  onpointerdown={(e) => { if (pinned && btn && !btn.contains(e.target as Node)) pinned = false; }}
  onscroll={() => { pinned = false; hovering = false; }}
/>

<button
  bind:this={btn} type="button" class="info" aria-label={label} aria-expanded={open}
  onclick={(e) => { e.preventDefault(); e.stopPropagation(); place(); pinned = !pinned; }}
  onpointerenter={show} onpointerleave={() => (hovering = false)}
  onfocus={() => { place(); hovering = true; }} onblur={() => (hovering = false)}
>
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4" />
    <rect x="7.2" y="7" width="1.6" height="4.6" rx="0.8" fill="currentColor" />
    <circle cx="8" cy="4.8" r="1" fill="currentColor" />
  </svg>
</button>
{#if open}
  <span class="tip" role="tooltip" style="left:{at.left}px; top:{at.top}px; width:{at.w}px" class:above={at.above}>{text}</span>
{/if}

<style>
  .info {
    display: inline-grid; place-items: center; width: 22px; height: 22px; min-height: 0; padding: 0; margin: 0 0 0 2px;
    border: 0; border-radius: 50%; background: transparent; color: var(--muted); vertical-align: middle; cursor: help;
    flex: none;
  }
  .info:hover, .info[aria-expanded='true'] { color: var(--ink); }
  .tip {
    position: fixed; z-index: 50; padding: 8px 10px; border-radius: 10px; background: var(--ink); color: var(--bg);
    font-size: 12.5px; font-weight: 400; line-height: 1.4; text-transform: none; letter-spacing: normal;
    box-shadow: var(--shadow); pointer-events: none;
  }
  .tip.above { transform: translateY(-100%); }
</style>
