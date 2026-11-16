<script lang="ts">
  import { armArt, TENSION, type ArtBody } from '../../draw/body';
  import { smoothClosedPath } from '../../draw/shapes';
  import type { RiderPose } from '../../model/pose';
  import type { Vec2 } from '../../model/vec';

  let { pose, body, variant = 'near' }: { pose: RiderPose; body: ArtBody; variant?: 'near' | 'ghost' } = $props();
  const art = $derived(armArt(pose, body));
  const d = (pts: Vec2[]) => smoothClosedPath(pts, TENSION);
</script>

<g fill="var(--rider)" stroke="none" opacity={variant === 'ghost' ? 0.14 : 1}>
  <path d={d(art.upper)} />
  <path d={d(art.forearm)} />
  <path d={d(art.fist)} />
</g>
{#if variant === 'near'}
  <path d={d(art.sleeve)} fill="var(--jersey)" stroke="none" />
{/if}
