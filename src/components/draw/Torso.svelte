<script lang="ts">
  import { TENSION, torsoArt, type ArtBody } from '../../draw/body';
  import { smoothClosedPath } from '../../draw/shapes';
  import type { RiderPose } from '../../model/pose';
  import type { Vec2 } from '../../model/vec';

  let { pose, body, saddle, nose, variant = 'near' }: {
    pose: RiderPose;
    body: ArtBody;
    saddle: Vec2;
    nose: Vec2;
    variant?: 'near' | 'ghost';
  } = $props();
  const art = $derived(torsoArt(pose, body, saddle, nose));
  const d = (pts: Vec2[]) => smoothClosedPath(pts, TENSION);
</script>

<g fill="var(--rider)" stroke="none" opacity={variant === 'ghost' ? 0.14 : 1}>
  <path d={d(art.torso)} />
  <path d={d(art.seat)} />
  <path d={d(art.head)} />
</g>
{#if variant === 'near'}
  <path d={d(art.jersey)} fill="var(--jersey)" stroke="none" />
  <path d={d(art.helmet)} fill="var(--helmet)" stroke="none" />
{/if}
