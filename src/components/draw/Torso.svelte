<script lang="ts">
  import { HEAD_R, headCenter } from '../../draw/body';
  import type { RiderPose } from '../../model/pose';
  import { pts } from './line';

  let { pose, height, variant = 'near' }: { pose: RiderPose; height: number; variant?: 'near' | 'ghost' } = $props();
  const head = $derived(headCenter(pose, height));
  const ghost = $derived(variant === 'ghost');
</script>

<g stroke="var(--rider)" fill="none" opacity={ghost ? 0.25 : 1} stroke-dasharray={ghost ? '18 14' : undefined}>
  <polyline points={pts(pose.hip, pose.shoulder, head)} stroke-width="12" />
  <circle cx={head.x} cy={head.y} r={HEAD_R * height} stroke-width="10" fill={ghost ? 'none' : 'var(--bg)'} />
</g>
