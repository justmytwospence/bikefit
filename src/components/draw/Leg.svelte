<script lang="ts">
  import type { RiderPose } from '../../model/pose';
  import type { Segments } from '../../model/types';
  import { pts } from './line';
  import Shoe from './Shoe.svelte';

  let {
    pose, seg, footStack, cleatOffset, variant = 'near', showBallMark = false, highlightCleat = false,
  }: {
    pose: RiderPose;
    seg: Segments;
    footStack: number;
    cleatOffset: number;
    variant?: 'near' | 'far' | 'ghost';
    showBallMark?: boolean;
    highlightCleat?: boolean;
  } = $props();
  const stroke = $derived(variant === 'far' ? 'var(--rider-far)' : 'var(--rider)');
</script>

{#if pose.overextended && variant === 'near'}
  <!-- The leg cannot reach the pedal: the shin is drawn stretched, so mark it. -->
  <polyline points={pts(pose.hip, pose.knee)} {stroke} stroke-width="12" fill="none" />
  <polyline points={pts(pose.knee, pose.ankle)} stroke="var(--off)" stroke-width="12" fill="none" stroke-dasharray="22 14" />
{:else}
  <polyline
    points={pts(pose.hip, pose.knee, pose.ankle)} {stroke} stroke-width="12" fill="none"
    opacity={variant === 'ghost' ? 0.25 : 1} stroke-dasharray={variant === 'ghost' ? '18 14' : undefined}
  />
{/if}
<Shoe
  ball={pose.ball} soleDeg={pose.soleDeg} {seg} {footStack} {cleatOffset} {variant}
  {showBallMark} highlight={highlightCleat}
/>
