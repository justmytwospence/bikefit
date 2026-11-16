<script lang="ts">
  import type { RiderPose } from '../../model/pose';
  import { pts } from './line';

  let { pose, variant = 'near' }: { pose: RiderPose; variant?: 'near' | 'ghost' } = $props();
  const ghost = $derived(variant === 'ghost');
</script>

<polyline
  points={pts(pose.shoulder, pose.elbow, pose.hand)} stroke="var(--rider)" stroke-width="12" fill="none"
  opacity={ghost ? 0.25 : 1} stroke-dasharray={ghost ? '18 14' : undefined}
/>
