<script lang="ts">
  import {
    barPath, forkPath, hoodPoints, leverPath, saddlePoints, seatpostHead, smoothClosedPath,
  } from '../../draw/shapes';
  import { frameSkeleton, steerAxis } from '../../model/geometry';
  import type { Components, FitParams, Frame, Layout } from '../../model/types';
  import { add, scale as vscale, type Vec2 } from '../../model/vec';

  let { frame, components, layout, params }: {
    frame: Frame;
    components: Components;
    layout: Layout;
    params: FitParams;
  } = $props();

  const sk = $derived(frameSkeleton(frame));
  const h = $derived(steerAxis(frame));
  const tyre = $derived(frame.tyreWidth);
  const post = $derived(seatpostHead(layout.seatAxisTop, frame.seatTubeAngle, params.seatpostSetback));
  const rear = $derived(layout.saddle.x - 120);
  const spacerTop = $derived(add(layout.headTop, vscale(h, params.spacers + components.headsetCap)));
  const P = (q: Vec2) => `${q.x},${q.y}`;
</script>

{#each [sk.rearAxle, sk.frontAxle] as a}
  <circle cx={a.x} cy={a.y} r={311 + tyre / 2} stroke="var(--frame)" stroke-width={tyre} opacity=".55" />
  <circle cx={a.x} cy={a.y} r={311 + tyre - 3} stroke="#8f9399" stroke-width="3" stroke-dasharray="4 10" opacity=".5" />
  <circle cx={a.x} cy={a.y} r="292" stroke="var(--frame)" stroke-width="10" opacity=".7" />
  <circle cx={a.x} cy={a.y} r="22" fill="var(--frame)" stroke="none" />
{/each}
<g stroke="var(--frame)" stroke-width="24">
  <polyline points={[sk.bb, sk.seatCluster, sk.headTop].map(P).join(' ')} />
  <polyline points={[sk.headTop, sk.headBottom].map(P).join(' ')} stroke-width="34" />
  <polyline points={[sk.headBottom, sk.bb].map(P).join(' ')} stroke-width="30" />
  <polyline points={[sk.bb, sk.rearAxle, sk.seatCluster].map(P).join(' ')} stroke-width="16" />
  <path d={forkPath(sk.headBottom, sk.frontAxle, h)} stroke-width="20" />
</g>
<g stroke="var(--part)">
  <line x1={sk.seatCluster.x} y1={sk.seatCluster.y} x2={post.postTop.x} y2={post.postTop.y} stroke-width="16" />
  <line x1={post.postTop.x} y1={post.postTop.y} x2={post.head.x} y2={post.head.y} stroke-width="14" />
  <line x1={rear + 50} y1={layout.saddle.y - 30} x2={layout.nose.x - 50} y2={layout.nose.y - 30} stroke-width="6" />
</g>
<rect x={post.head.x - 18} y={layout.saddle.y - 40} width="36" height="20" rx="4" fill="var(--part)" stroke="none" />
<path d={smoothClosedPath(saddlePoints(layout.saddle, layout.nose))} fill="var(--ink)" stroke="none" />
<line x1={layout.headTop.x} y1={layout.headTop.y} x2={spacerTop.x} y2={spacerTop.y} stroke="var(--part)" stroke-width="30" />
<line x1={layout.stemBase.x} y1={layout.stemBase.y} x2={layout.clamp.x} y2={layout.clamp.y} stroke="var(--ink)" stroke-width="16" />
<path d={barPath(layout.clamp, components.barReach, components.barDrop)} stroke="var(--ink)" stroke-width="13" />
<path d={leverPath(layout.clamp, components.barReach, components.barDrop)} stroke="var(--ink)" stroke-width="9" />
<path d={smoothClosedPath(hoodPoints(layout.clamp, layout.hoods, components.barReach))} fill="var(--ink)" stroke="none" />
<circle cx="0" cy="0" r="98" stroke="#5d6066" stroke-width="10" stroke-dasharray="5 5" />
<circle cx="0" cy="0" r="90" stroke="#7a7e85" stroke-width="5" />
