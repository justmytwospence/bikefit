<script lang="ts">
  import { capsulePath, type Radii } from '../../draw/shapes';
  import type { RiderPose } from '../../model/pose';

  let { pose, radii, variant = 'near' }: { pose: RiderPose; radii: Radii; variant?: 'near' | 'ghost' } = $props();
</script>

<g fill="var(--rider)" stroke="none" opacity={variant === 'ghost' ? 0.14 : 1}>
  <path d={capsulePath(pose.shoulder, pose.elbow, radii.upperArmShoulder, radii.upperArmElbow)} />
  <path d={capsulePath(pose.elbow, pose.hand, radii.forearmElbow, radii.forearmWrist)} />
  <circle cx={pose.hand.x} cy={pose.hand.y} r={radii.hand} />
</g>
