<script lang="ts">
  import { capsulePath, helmetPoints, smoothClosedPath, type Radii } from '../../draw/shapes';
  import type { RiderPose } from '../../model/pose';
  import type { Vec2 } from '../../model/vec';

  let { pose, saddle, radii, variant = 'near' }: {
    pose: RiderPose;
    saddle: Vec2;
    radii: Radii;
    variant?: 'near' | 'ghost';
  } = $props();
</script>

<g fill="var(--rider)" stroke="none" opacity={variant === 'ghost' ? 0.14 : 1}>
  <path d={capsulePath({ x: saddle.x - 25, y: saddle.y + radii.pelvis }, pose.hip, radii.pelvis, radii.torsoHip)} />
  <path d={capsulePath(pose.hip, pose.shoulder, radii.torsoHip, radii.torsoShoulder)} />
  <path d={capsulePath(pose.shoulder, pose.head, radii.neck, radii.neck)} />
  <circle cx={pose.head.x} cy={pose.head.y} r={radii.head} />
</g>
{#if variant === 'near'}
  <path d={smoothClosedPath(helmetPoints(pose.head, radii.head))} fill="var(--helmet)" stroke="none" />
{/if}
