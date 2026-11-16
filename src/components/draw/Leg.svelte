<script lang="ts">
  import { capsulePath, type Radii } from '../../draw/shapes';
  import type { RiderPose } from '../../model/pose';
  import type { Segments } from '../../model/types';
  import Shoe from './Shoe.svelte';

  let {
    pose, seg, radii, footStack, cleatOffset, variant = 'near', showBallMark = false, highlightCleat = false,
  }: {
    pose: RiderPose;
    seg: Segments;
    radii: Radii;
    footStack: number;
    cleatOffset: number;
    variant?: 'near' | 'far' | 'ghost';
    showBallMark?: boolean;
    highlightCleat?: boolean;
  } = $props();
  const fill = $derived(variant === 'far' ? 'var(--rider-far)' : 'var(--rider)');
</script>

<g {fill} stroke="none" opacity={variant === 'ghost' ? 0.14 : 1}>
  <path d={capsulePath(pose.hip, pose.knee, radii.thighHip, radii.thighKnee)} />
  <path d={capsulePath(pose.knee, pose.ankle, radii.shinKnee, radii.shinAnkle)} />
</g>
<Shoe
  ball={pose.ball} soleDeg={pose.soleDeg} {seg} {footStack} {cleatOffset} {variant}
  {showBallMark} highlight={highlightCleat}
/>
