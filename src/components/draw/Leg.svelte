<script lang="ts">
  import { legArt, TENSION, type ArtBody } from '../../draw/body';
  import { smoothClosedPath } from '../../draw/shapes';
  import type { RiderPose } from '../../model/pose';
  import type { Segments } from '../../model/types';
  import type { Vec2 } from '../../model/vec';
  import Shoe from './Shoe.svelte';

  let {
    pose, seg, body, saddle, nose, footStack, cleatOffset, variant = 'near', showBallMark = false, highlightCleat = false,
  }: {
    pose: RiderPose;
    seg: Segments;
    body: ArtBody;
    saddle: Vec2;
    nose: Vec2;
    footStack: number;
    cleatOffset: number;
    variant?: 'near' | 'far' | 'ghost';
    showBallMark?: boolean;
    highlightCleat?: boolean;
  } = $props();
  const fill = $derived(variant === 'far' ? 'var(--rider-far)' : 'var(--rider)');
  const art = $derived(legArt(pose, body, saddle, nose));
</script>

<g {fill} stroke="none" opacity={variant === 'ghost' ? 0.14 : 1}>
  <path d={smoothClosedPath(art.thigh, TENSION)} />
  <path d={smoothClosedPath(art.calf, TENSION)} />
</g>
<Shoe
  ball={pose.ball} soleDeg={pose.soleDeg} {seg} {footStack} {cleatOffset} {variant}
  {showBallMark} highlight={highlightCleat}
/>
