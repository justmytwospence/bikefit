<script lang="ts">
  import { reveal, togglePin } from '../../lib/link.svelte';
  import type { LinkId } from '../../lib/linkIds';
  import type { Tab } from '../../lib/appData';
  import type { frameSkeleton } from '../../model/geometry';
  import type { RiderPose } from '../../model/pose';
  import type { Layout, MetricId } from '../../model/types';
  import type { Vec2 } from '../../model/vec';
  import { ui } from '../../state.svelte';

  /** Invisible targets over the parts and angles of the drawing, linking each back to its number in the panel. */
  let { layout, pose, joints, sk, tab }: {
    layout: Layout; pose: RiderPose; joints: { id: MetricId; path: string }[];
    sk: ReturnType<typeof frameSkeleton>; tab: Tab;
  } = $props();

  const line = (a: Vec2, b: Vec2) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const targets = $derived.by(() => {
    const out: { id: LinkId; d: string }[] = [];
    if (tab === 'mybike') {
      out.push(
        { id: 'f:seatTubeLength', d: line(sk.bb, sk.seatCluster) },
        { id: 'f:headTubeLength', d: line(sk.headBottom, sk.headTop) },
        { id: 'f:chainstay', d: line(sk.rearAxle, sk.bb) },
      );
    }
    if (tab === 'rider') {
      out.push(
        { id: 'b:femur', d: line(pose.hip, pose.knee) },
        { id: 'b:tibia', d: line(pose.knee, pose.ankle) },
        { id: 'b:torso', d: line(pose.hip, pose.shoulder) },
        { id: 'b:upperArm', d: line(pose.shoulder, pose.elbow) },
        { id: 'b:forearmGrip', d: line(pose.elbow, pose.hand) },
      );
    }
    out.push(
      { id: 'saddleHeight', d: line({ x: layout.saddle.x - 120, y: layout.saddle.y }, layout.nose) },
      { id: 'spacers', d: line(layout.headTop, layout.stemBase) },
      { id: 'stem', d: line(layout.stemBase, layout.clamp) },
      { id: 'crank', d: line({ x: 0, y: 0 }, pose.spindle) },
      { id: 'cleat', d: line(pose.ankle, pose.toe) },
      ...joints.map((j) => ({ id: `m:${j.id}` as LinkId, d: j.path })),
    );
    return out;
  });

  function enter(e: PointerEvent, id: LinkId) {
    if (e.pointerType !== 'touch') ui.hover = id;
  }
  function leave(id: LinkId) {
    if (ui.hover === id) ui.hover = null;
  }
  function tap(e: MouseEvent, id: LinkId) {
    e.stopPropagation();
    togglePin(id);
    if (ui.pin === id) reveal(id);
  }
</script>

{#each targets as t (t.id)}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <path
    d={t.d} stroke="transparent" stroke-width="60" fill="none" pointer-events="stroke" style="cursor:pointer"
    onpointerenter={(e) => enter(e, t.id)} onpointerleave={() => leave(t.id)} onclick={(e) => tap(e, t.id)}
  />
{/each}
