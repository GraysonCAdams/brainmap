/**
 * The map: d3-force simulation + hand-rolled canvas renderer.
 *
 * Encoding contract (DESIGN.md + dataviz pass):
 *   hue = domain lamp (validated palette), treatment = status,
 *   dot size = project scale (1-5: codebase size / reach / ambition).
 *   idea = hollow ring, building = breathing, shipped = solid + glow,
 *   retired = dimmed, teaser = dashed gray ring (locked).
 * Titles are always drawn: identity is never color-alone.
 *
 * Interaction: hover = cursor-following tooltip; click = modal overlay
 * iframing the node's real page, with the URL updated via pushState so the
 * address bar always holds a shareable /idea/<slug> link.
 */
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  tagline: string;
  status: 'idea' | 'building' | 'shipped' | 'retired';
  domain: string;
  tags?: string[];
  visibility: 'public' | 'teaser';
  parent?: string | null;
  detail?: 'own' | 'parent';
  started?: string;
  ended?: string | null;
  org?: string | null;
  repo?: string | null;
  tech?: string[];
  scale?: number;
  freshness?: number;
}
type GraphEdge = SimulationLinkDatum<GraphNode> & { kind?: 'parent' | 'link' };

const root = document.getElementById('map-root');
if (root) init(root).catch((err) => {
  root.textContent = 'The map failed to load. Everything on it is in /bio.';
  console.error(err);
});

async function init(root: HTMLElement) {
  const res = await fetch('/graph.json');
  if (!res.ok) throw new Error(`graph.json ${res.status}`);
  const data: {
    nodes: GraphNode[];
    edges: { source: string; target: string; kind?: 'parent' | 'link' }[];
    domainLabels?: Record<string, string>;
  } = await res.json();

  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const lamp = (domain: string) => token(`--lamp-${domain}`) || token('--ink-faint');
  const INK = token('--ink');
  const INK_DIM = token('--ink-dim');
  const INK_FAINT = token('--ink-faint');
  const GROUND = token('--ground');
  const RETIRED_DIM = parseFloat(token('--retired-dim')) || 0.38;
  const FONT_DATA = token('--font-data');

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.textContent = '';
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.cursor = 'grab';
  // Without this, mobile browsers claim pinch/pan for page zoom and scroll.
  canvas.style.touchAction = 'none';
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');

  let width = 0;
  let height = 0;
  const resize = () => {
    const rect = root.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  new ResizeObserver(resize).observe(root);

  // Domain clusters: centroids on an ellipse, assigned in palette order.
  const domains = [...new Set(data.nodes.map((n) => n.domain))];
  const centroid = new Map<string, { x: number; y: number }>();
  domains.forEach((d, i) => {
    const angle = (i / domains.length) * Math.PI * 2 - Math.PI / 2;
    centroid.set(d, { x: Math.cos(angle) * 430, y: Math.sin(angle) * 290 });
  });

  // Size = scale (1-5). Teasers stay small regardless.
  const radiusOf = (n: GraphNode) =>
    n.visibility === 'teaser' ? 5 : 5.5 + (n.scale ?? 2) * 2;

  // A cluster's radius comes from HOW MANY nodes it holds, not from how far
  // the furthest one happens to have drifted. An enclosing-circle radius lets
  // a single outlier inflate the whole ring, so size stopped meaning
  // membership and started meaning scatter. This is the area a circle packing
  // of that many dots needs, at an empirical packing efficiency, which makes
  // a one-node group legibly small and a 25-node group legibly large.
  const NODE_GAP = 9;
  const BOUNDARY_PAD = 26;
  const PACK = 0.62;
  // Members are free bodies only; a parent contributes its whole footprint,
  // since the space its satellites take up is space the cluster must hold.
  const clusterRadius = (members: GraphNode[]) => {
    if (!members.length) return 0;
    const avg = members.reduce((sum, n) => sum + footprintOf(n), 0) / members.length;
    return BOUNDARY_PAD + Math.sqrt(members.length / PACK) * (avg + NODE_GAP);
  };

  // Containment index. A node with `parent` is one facet of a bigger thing and
  // orbits it instead of floating free in the domain cluster.
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, GraphNode[]>();
  for (const n of data.nodes) {
    if (!n.parent || !byId.has(n.parent)) continue;
    const list = childrenOf.get(n.parent);
    if (list) list.push(n);
    else childrenOf.set(n.parent, [n]);
  }
  const isChild = (n: GraphNode) => Boolean(n.parent && byId.has(n.parent));

  // Satellites are NOT simulation bodies. They are drawn at a fixed offset
  // from their parent every tick.
  //
  // The first attempt made them ordinary nodes with an orbit force, and it
  // failed for a reason worth recording: collision spacing between unrelated
  // nodes is radius+11 each, so any two dots sit at least ~41px apart, and an
  // orbit that respects collision lands at ~45. A child ended up FARTHER from
  // its parent than a stranger was, which is not a weak grouping cue, it is
  // an inverted one. Containment only reads if the gap inside a system is
  // clearly smaller than the gap between systems, and no arrangement of forces
  // that treats children as peers can produce that.
  const CHILD_GAP = 6;
  const orbitRadius = (p: GraphNode, kids: GraphNode[]) => {
    const widest = Math.max(...kids.map(radiusOf));
    const snug = radiusOf(p) + widest + CHILD_GAP;
    // With enough satellites the ring has to grow or they overlap each other.
    const circumference = (kids.length * (2 * widest + CHILD_GAP)) / (2 * Math.PI);
    return Math.max(snug, circumference);
  };
  // The space a node actually occupies. A parent's footprint swallows the ring
  // of satellites travelling with it, so the ambient layout treats the whole
  // system as one body and no unrelated dot can drift into the gap between a
  // parent and its children.
  const footprintOf = (n: GraphNode) => {
    const kids = childrenOf.get(n.id);
    if (!kids?.length) return radiusOf(n);
    return orbitRadius(n, kids) + Math.max(...kids.map(radiusOf));
  };
  const placeSatellites = () => {
    for (const [pid, kids] of childrenOf) {
      const p = byId.get(pid);
      if (!p) continue;
      const R = orbitRadius(p, kids);
      // Fixed angular slots: stable across reloads, and a child appearing as
      // the timeline reaches its year drops into the gap it always had rather
      // than reshuffling the siblings already placed.
      kids.forEach((c, i) => {
        const angle = (i / kids.length) * Math.PI * 2 - Math.PI / 2;
        c.x = (p.x ?? 0) + Math.cos(angle) * R;
        c.y = (p.y ?? 0) + Math.sin(angle) * R;
        c.vx = 0;
        c.vy = 0;
      });
    }
  };

  // Only free bodies are simulated. Edges touching a satellite are still
  // drawn, they just exert no force, which is correct: a satellite's position
  // is dictated by what it belongs to, not by what it references.
  const simNodes = data.nodes.filter((n) => !isChild(n));

  // Tight round clumps: strong centroid gravity + modest repulsion means the
  // members themselves form the circle the boundary traces.
  // Edge endpoints are resolved by hand so that satellite edges keep real node
  // references even though forceLink never sees them.
  const edges: GraphEdge[] = data.edges.map((e) => ({
    ...e,
    source: byId.get(e.source as unknown as string) ?? e.source,
    target: byId.get(e.target as unknown as string) ?? e.target,
  }));
  const simEdges = edges.filter(
    (e) => !isChild(e.source as GraphNode) && !isChild(e.target as GraphNode),
  );
  const sim = forceSimulation(simNodes)
    .force(
      'link',
      forceLink<GraphNode, GraphEdge>(simEdges).id((n) => n.id).distance(60).strength(0.25),
    )
    .force('charge', forceManyBody().strength(-90))
    // Footprint, not radius: a parent shoulders its satellites aside as one body.
    .force('collide', forceCollide<GraphNode>((n) => footprintOf(n) + 11))
    .force('x', forceX<GraphNode>((n) => centroid.get(n.domain)?.x ?? 0).strength(0.24))
    .force('y', forceY<GraphNode>((n) => centroid.get(n.domain)?.y ?? 0).strength(0.24))
    // Keep every member inside its own count-sized circle. Without this the
    // ring would be a claim the layout does not honour.
    .force('contain', () => {
      for (const d of domains) {
        const members = simNodes.filter((n) => n.domain === d);
        if (!members.length) continue;
        const cx = members.reduce((sum, n) => sum + (n.x ?? 0), 0) / members.length;
        const cy = members.reduce((sum, n) => sum + (n.y ?? 0), 0) / members.length;
        const R = clusterRadius(members);
        for (const n of members) {
          const dx = (n.x ?? 0) - cx;
          const dy = (n.y ?? 0) - cy;
          const dist = Math.hypot(dx, dy) || 1;
          // A parent must fit its whole system inside the boundary, not just
          // its own dot, or its satellites hang outside the circle.
          const maxD = Math.max(0, R - footprintOf(n) - 6);
          if (dist <= maxD) continue;
          const pull = ((dist - maxD) / dist) * 0.32;
          n.x = (n.x ?? 0) - dx * pull;
          n.y = (n.y ?? 0) - dy * pull;
        }
      }
    })
    // cluster de-overlap: treat each domain as a circle (same geometry the
    // boundary draws) and push whole clusters apart when circles collide
    .force('declump', (alpha: number) => {
      const GAP = 52;
      const clusters = domains
        .map((d) => {
          const members = simNodes.filter((n) => n.domain === d);
          if (members.length === 0) return null;
          const cx = members.reduce((s, n) => s + (n.x ?? 0), 0) / members.length;
          const cy = members.reduce((s, n) => s + (n.y ?? 0), 0) / members.length;
          return { members, cx, cy, r: clusterRadius(members) };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const a = clusters[i];
          const b = clusters[j];
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const dist = Math.hypot(dx, dy) || 1;
          const need = a.r + b.r + GAP;
          if (dist >= need) continue;
          const push = ((need - dist) / dist) * 0.5 * Math.min(1, alpha * 6);
          const px = dx * push;
          const py = dy * push;
          for (const n of a.members) {
            n.x = (n.x ?? 0) - px;
            n.y = (n.y ?? 0) - py;
          }
          for (const n of b.members) {
            n.x = (n.x ?? 0) + px;
            n.y = (n.y ?? 0) + py;
          }
        }
      }
    });

  // Satellites ride along on every tick, and once more up front so they have
  // positions before the first frame, the first hit test or the first camera fit.
  sim.on('tick.satellites', placeSatellites);
  placeSatellites();

  let transform: ZoomTransform = zoomIdentity.translate(width / 2, height / 2);
  // Panning is bounded to the world the layout actually occupies plus a margin.
  // Without this you can drag the entire graph off-screen and be left staring
  // at empty ground with no way back except the reset button, which is a dead
  // end a first-time visitor has no reason to look for.
  // Recomputed on resize because d3 clamps translation against the viewport.
  // Derived from where the layout actually ended up, plus a full viewport of
  // slack on each side. The slack is deliberately dead space: a wall right at
  // the content edge feels cramped even when there is nothing out there to
  // look at, and X gets the most because that is the axis people drag along.
  const applyExtent = () => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of data.nodes) {
      const nx = n.x ?? 0;
      const ny = n.y ?? 0;
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
    }
    // Before the simulation has placed anything, fall back to a sane box.
    if (!Number.isFinite(minX)) {
      minX = -400;
      maxX = 400;
      minY = -300;
      maxY = 300;
    }
    const slackX = Math.max(width, 640);
    const slackY = Math.max(height * 0.7, 360);
    zoomer.translateExtent([
      [minX - slackX, minY - slackY],
      [maxX + slackX, maxY + slackY],
    ]);
  };
  const zoomer = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.35, 3.5])
    .on('zoom', (ev) => {
      transform = ev.transform;
    })
    .on('start', () => (canvas.style.cursor = 'grabbing'))
    .on('end', () => (canvas.style.cursor = 'grab'));
  const sel = select(canvas);
  applyExtent();
  // d3 enforces translateExtent only during gestures. A programmatic transform
  // that sits outside it looks fine until the first drag, which then snaps the
  // view. Push ours through d3's own constrain so there is nothing to snap to.
  const constrained = (t: ZoomTransform): ZoomTransform =>
    zoomer.constrain()(
      t,
      [
        [0, 0],
        [width, height],
      ],
      zoomer.translateExtent(),
    );
  sel.call(zoomer);
  transform = constrained(transform);
  sel.call(zoomer.transform, transform);
  // The extent depends on both the layout and the viewport, so recompute as
  // the simulation settles and whenever the window changes.
  new ResizeObserver(applyExtent).observe(root);
  sim.on('end', applyExtent);
  setTimeout(applyExtent, 2000);

  // ---- Intro camera: eases toward a transform that frames every visible dot,
  // so the view pulls back as the map fills instead of letting early years
  // drift off screen. Any real user gesture hands the camera back immediately.
  let introCam = false;
  const releaseIntroCam = () => {
    introCam = false;
  };
  sel.on('wheel.introcam pointerdown.introcam touchstart.introcam', releaseIntroCam);
  const fitCamera = (nodes: GraphNode[], dt: number) => {
    if (!nodes.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const nx = n.x ?? 0;
      const ny = n.y ?? 0;
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
    }
    // Asymmetric on purpose: node labels hang BELOW their dot, and cluster
    // legend labels sit ABOVE their circle, so the top needs the most room.
    const pad = 90;
    const padTop = 150;
    const w = Math.max(1, maxX - minX + pad * 2);
    const h = Math.max(1, maxY - minY + padTop + pad);
    const k = Math.max(0.35, Math.min(1.6, Math.min(width / w, height / h)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2 + (padTop - pad) / 2;
    // Critically damped chase: no overshoot, frame-rate independent.
    const s = 1 - Math.exp(-dt / 420);
    const nk = transform.k + (k - transform.k) * s;
    const nx = transform.x + (width / 2 - cx * nk - transform.x) * s;
    const ny = transform.y + (height / 2 - cy * nk - transform.y) * s;
    transform = constrained(zoomIdentity.translate(nx, ny).scale(nk));
    sel.call(zoomer.transform, transform);
  };

  let hovered: GraphNode | null = null;

  // ---- Facet filters: domains and tech; AND across facets, OR within.
  const activeDomains = new Set<string>();
  const activeTech = new Set<string>();
  const matchesFilter = (n: GraphNode) => {
    const okDomain =
      activeDomains.size === 0 ||
      activeDomains.has(n.domain) ||
      (n.tags ?? []).some((t) => activeDomains.has(t));
    const okTech =
      activeTech.size === 0 || (n.tech ?? []).some((t) => activeTech.has(t));
    return okDomain && okTech;
  };
  const wireFacet = (attr: string, set: Set<string>) => {
    document.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute(attr)!;
        const on = !set.has(v);
        if (on) set.add(v);
        else set.delete(v);
        btn.setAttribute('aria-pressed', String(on));
      });
    });
  };
  wireFacet('data-domain-filter', activeDomains);
  wireFacet('data-tech-filter', activeTech);

  // ---- Time engine: focus year + stretchable relevance window.
  const YEAR = 365.25 * 86400 * 1000;
  // Left edge of time: the year the site first existed. Nothing on the map
  // predates it, and an empty lead-in reads as missing data rather than as
  // a beginning.
  const T0 = Date.UTC(2003, 0, 1);
  const NOW = Date.now();
  const DEFAULT_BEHIND = 4 * YEAR;
  const DEFAULT_AHEAD = 4 * YEAR;
  const FADE_YEARS = 6; // relevance decays to zero this many years past the window
  let focus = NOW;
  let behind = DEFAULT_BEHIND;
  let ahead = DEFAULT_AHEAD;

  const spanOf = (n: GraphNode): [number, number] => {
    // Stealth ideas exist only in the present: they never appear in the past
    // during the tour or while scrubbing.
    if (!n.started) return [NOW, NOW];
    const start = Date.parse(n.started);
    const end = n.ended
      ? Date.parse(n.ended)
      : n.status === 'retired'
        ? Math.min(start + 2 * YEAR, NOW)
        : NOW;
    return [start, end];
  };
  // Intro phase 1: the map ACCUMULATES. Every idea that has been born stays on
  // screen and the camera pulls back to hold them all, so the tour reads as a
  // life filling in rather than a window scrolling over it. The relevance
  // window only starts mattering in phase 4, when the range selector appears
  // and visibly narrows to it.
  let introAccumulate = false;
  const relevance = (n: GraphNode): number => {
    const [start, end] = spanOf(n);
    if (introAccumulate) return start <= focus ? 1 : 0;
    const wStart = focus - behind;
    const wEnd = focus + ahead;
    // The future hasn't happened yet: no pre-echo ghosts ahead of the window.
    if (start > wEnd) return 0;
    if (end >= wStart) return 1;
    // The past fades gradually, like memory.
    return Math.max(0, 1 - (wStart - end) / YEAR / FADE_YEARS);
  };
  const HIDE_BELOW = 0.12;

  // Timeline DOM
  const tl = {
    wrap: document.getElementById('timeline') as HTMLElement | null,
    track: document.getElementById('tl-track') as HTMLElement,
    ticks: document.getElementById('tl-ticks') as HTMLElement,
    region: document.getElementById('tl-region') as HTMLElement,
    edgeL: document.getElementById('tl-edge-l') as HTMLElement,
    edgeR: document.getElementById('tl-edge-r') as HTMLElement,
    handle: document.getElementById('tl-handle') as HTMLElement,
    reset: document.getElementById('tl-reset') as HTMLElement,
  };
  const pct = (t: number) => ((t - T0) / (NOW - T0)) * 100;
  // Deliberately unclamped: clamping the POINTER here made year 2000
  // unreachable as a center point when dragging the band by its left half
  // (the grab-offset math needs virtual positions past the track edge).
  // Only `focus` itself is clamped, at assignment.
  const fromPct = (p: number) => T0 + p * (NOW - T0);
  const renderTimeline = () => {
    tl.handle.style.left = `${pct(focus)}%`;
    // true width always; overhang past either end is clipped, never squashed
    const l = pct(focus - behind);
    const r = pct(focus + ahead);
    tl.region.style.left = `${l}%`;
    tl.region.style.width = `${r - l}%`;
  };
  // tick marks every 5 years
  const tickFrom = Math.ceil(new Date(T0).getUTCFullYear() / 5) * 5;
  for (let y = tickFrom; y <= new Date(NOW).getUTCFullYear(); y += 5) {
    const t = Date.UTC(y, 0, 1);
    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.style.left = `${pct(t)}%`;
    tl.ticks.appendChild(tick);
    const label = document.createElement('span');
    label.className = 'tick-label';
    label.style.left = `${pct(t)}%`;
    if (y === 2000) label.style.transform = 'none'; // don't clip off the left edge
    label.textContent = String(y);
    tl.ticks.appendChild(label);
  }
  const trackX = (ev: PointerEvent) => {
    const r = tl.track.getBoundingClientRect();
    return (ev.clientX - r.left) / r.width;
  };
  // Interaction model:
  //   drag the window band  -> slide the whole window through time (fixed width)
  //   drag its edges        -> stretch behind/ahead
  //   click/drag anywhere else on the track -> jump to that year, then scrub
  type DragMode = null | 'region' | 'edgeL' | 'edgeR' | 'scrub';
  let dragMode: DragMode = null;
  let grabOffset = 0; // region drag: time under the pointer minus focus
  let downX = 0;
  let downAt = 0;
  tl.track.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    cancelSweep(); // the user grabbed the wheel; the tour yields instantly
    tl.track.setPointerCapture?.(ev.pointerId);
    downX = ev.clientX;
    downAt = performance.now();
    const t = fromPct(trackX(ev));
    if (ev.target === tl.edgeL) dragMode = 'edgeL';
    else if (ev.target === tl.edgeR) dragMode = 'edgeR';
    else if (ev.target === tl.region) {
      dragMode = 'region';
      grabOffset = t - focus;
    } else {
      dragMode = 'scrub';
      focus = Math.min(NOW, Math.max(T0, t));
    }
    renderTimeline();
  });
  tl.track.addEventListener('pointermove', (ev) => {
    if (!dragMode) return;
    const t = fromPct(trackX(ev));
    if (dragMode === 'scrub') focus = Math.min(NOW, Math.max(T0, t));
    else if (dragMode === 'region') focus = Math.min(NOW, Math.max(T0, t - grabOffset));
    else if (dragMode === 'edgeL') behind = Math.max(0.5 * YEAR, focus - t);
    else ahead = Math.max(0.5 * YEAR, t - focus);
    renderTimeline();
  });
  tl.track.addEventListener('pointerup', (ev) => {
    // A tap on the band (no real movement) is a jump, not a null drag.
    if (
      dragMode === 'region' &&
      Math.abs(ev.clientX - downX) < 5 &&
      performance.now() - downAt < 350
    ) {
      focus = Math.min(NOW, Math.max(T0, fromPct(trackX(ev))));
      renderTimeline();
    }
    dragMode = null;
  });
  tl.track.addEventListener('pointercancel', () => (dragMode = null));
  tl.reset.addEventListener('click', () => {
    cancelSweep();
    travelTo(NOW, 500);
    behind = DEFAULT_BEHIND;
    ahead = DEFAULT_AHEAD;
  });

  // Smooth travel used by boundary-node clicks and the intro sweep.
  let travelRaf = 0;
  const travelTo = (target: number, ms = 700) => {
    cancelSweep();
    cancelAnimationFrame(travelRaf);
    const from = focus;
    const start = performance.now();
    const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const step = (nowMs: number) => {
      // rAF timestamps are frame-start times and can precede `start`; clamp
      // both ends or the ease extrapolates backward past the year 2000.
      const u = Math.max(0, Math.min(1, (nowMs - start) / ms));
      focus = from + (target - from) * ease(u);
      renderTimeline();
      if (u < 1) travelRaf = requestAnimationFrame(step);
    };
    travelRaf = requestAnimationFrame(step);
  };

  // ---- Intro sweep: linger on the first idea, then travel to today with
  // density-adaptive pacing (slow through crowded years, quick over dead air).
  let sweepActive = false;
  let sweepRaf = 0;
  const startMsOf = new Map<string, number>(
    data.nodes.filter((n) => n.started).map((n) => [n.id, Date.parse(n.started!)]),
  );
  const cancelSweep = () => {
    if (!sweepActive) return;
    sweepActive = false;
    cancelAnimationFrame(sweepRaf);
    // Bail out of every intro-only mode; leaving accumulate on would pin all
    // 26 years of dots on screen permanently.
    introAccumulate = false;
    introCam = false;
    behind = DEFAULT_BEHIND;
    ahead = DEFAULT_AHEAD;
    tl.wrap?.classList.remove('tl-enter');
    // Put the header back the way it was: no reserved log height, no stranded
    // caret, wordmark restored.
    const h = document.querySelector('header');
    h?.classList.remove('has-log');
    const term = document.getElementById('term');
    if (term) term.textContent = '';
    renderTimeline();
  };
  // The tour only starts once the whoami modal is gone; running it behind the
  // backdrop wastes it on the exact visitor it exists for.
  const whenBegun = (fn: () => void) => {
    if ((window as unknown as { brainmapBegin?: boolean }).brainmapBegin) fn();
    else addEventListener('brainmap:begin', fn, { once: true });
  };

  if (!reducedMotion && !location.hash) {
    // Open on an EMPTY map. Nothing has been loaded yet, so the canvas should
    // show nothing until the command has actually run.
    focus = T0 - YEAR;
    renderTimeline();
    sweepActive = true;

    // ---- Header narration. One container, every line a block-level div, so
    // lines stack even before CSS lands. Appending pushes the older line up
    // and out of the two-line window, which is the scroll.
    const termEl = document.getElementById('term');
    const headerEl = document.querySelector('header');
    const line = (cls = '') => {
      const el = document.createElement('div');
      el.className = `log-line enter${cls ? ` ${cls}` : ''}`;
      termEl?.appendChild(el);
      // Keep the current line and the one it displaced; drop the rest.
      while (termEl && termEl.children.length > 2) termEl.removeChild(termEl.firstChild!);
      requestAnimationFrame(() => el.classList.remove('enter'));
      return el;
    };
    // The prompt belongs to the command's own line, so it scrolls away with it.
    const PROMPT =
      '<span class="p-user">gray</span><span class="p-path">@</span>' +
      '<span class="p-host">brainmap</span><span class="p-path">:~$</span> ';
    const pushLine = (txt: string) => {
      const el = line();
      el.textContent = txt;
    };

    // Eras, not a manifest. The giant year watermark already says *when*; this
    // line says what that stretch of time was actually like.
    const ERAS: [number, number, string][] = [
      [2003, 2006, 'a site my dad put up for me. i started changing things to see what would break'],
      [2007, 2009, 'teaching it back on youtube, mostly to figure out if i understood it'],
      [2010, 2011, 'local businesses needed websites. i needed the reps'],
      [2012, 2013, 'free game server hosting, run out of a bedroom, and it kept growing'],
      [2014, 2015, 'college. student radio, the newspaper, and one more matchmaking site'],
      [2016, 2018, 'internships: telecom, hospitality, broadcast. enterprise systems up close'],
      [2019, 2020, 'live streaming at scale, and a homelab that stopped being a hobby'],
      [2021, 2023, 'the chip shortage. a startup on nights and weekends, and a lot of migrations'],
      [2024, 2025, 'platform work. five days of setup down to under ten minutes'],
      [2026, 2026, 'building faster than i can write it down. AI-assisted, openly'],
    ];
    // Pacing is driven by READING TIME, not by idea density: an era holds the
    // screen for as long as its own sentence takes to read, so a long line is
    // never yanked away mid-clause. ~34ms/char lands near a comfortable
    // 250wpm, plus a settle beat before the eye starts.
    const PER_CHAR = 52;
    const SETTLE_MS = 1500;
    // Fraction of an era spent travelling. The remainder is a dead stop: the
    // year stops counting and the dots stop arriving so the sentence can be
    // read against a still frame. Reading against motion is the thing that
    // made this feel rushed even at a generous words-per-minute.
    const TRAVEL = 0.62;
    const schedule = ERAS.map(([a, b, text]) => ({
      from: Date.UTC(a, 0, 1),
      to: Math.min(NOW, Date.UTC(b + 1, 0, 1)),
      span: `${a === b ? a : `${a}-${b}`}`,
      text,
      dur: SETTLE_MS + text.length * PER_CHAR,
    }));
    const SWEEP_MS = schedule.reduce((acc, e) => acc + e.dur, 0);
    let eraIdx = -1;
    // Maps elapsed wall-clock onto the focus year, and emits a line whenever
    // the era changes.
    const focusAt = (elapsed: number) => {
      let acc = 0;
      for (let i = 0; i < schedule.length; i++) {
        const e = schedule[i];
        const last = i === schedule.length - 1;
        if (elapsed < acc + e.dur || last) {
          if (i !== eraIdx) {
            eraIdx = i;
            pushLine(`# ${e.span}  ${e.text}`);
          }
          const raw = Math.max(0, Math.min(1, (elapsed - acc) / e.dur));
          // Ease out into the hold so the year decelerates rather than
          // stopping dead, then sits still for the rest of the beat.
          const t = Math.min(1, raw / TRAVEL);
          const q = 1 - Math.pow(1 - t, 3);
          return e.from + (e.to - e.from) * q;
        }
        acc += e.dur;
      }
      return NOW;
    };

    const CMD = 'chmod +x load_projects.sh && ./load_projects.sh';
    const typeCommand = (done: () => void) => {
      if (!termEl) return done();
      headerEl?.classList.add('has-log');
      const el = line('cmd-line');
      let i = 0;
      const render = (caret: boolean) => {
        el.innerHTML = `${PROMPT}<span class="cmd">${CMD.slice(0, i)}</span>${
          caret ? '<span class="cursor"></span>' : ''
        }`;
      };
      render(true);
      const tick = () => {
        if (!sweepActive) return;
        i++;
        render(true);
        if (i < CMD.length) setTimeout(tick, 26);
        // Beat after the command lands, before anything loads. Caret goes:
        // the command has been issued, it is not still being typed.
        else
          setTimeout(() => {
            render(false);
            done();
          }, 640);
      };
      tick();
    };

  const LINGER_MS = 1600;
    const HOLD_MS = 2600; // sit on the finished map before explaining it
    const NARROW_MS = 2200; // range selector shrinking to its resting width

    // Phase 1 begins: accumulate, and let the camera pull back to hold it all.
    introAccumulate = true;
    introCam = true;
    tl.wrap?.classList.add('tl-enter');

    whenBegun(() =>
      typeCommand(() => setTimeout(() => {
      if (!sweepActive) return;
      const t0ms = performance.now();
      const step = (nowMs: number) => {
        if (!sweepActive) return;
        const elapsed = Math.max(0, nowMs - t0ms);
        const u = Math.min(1, elapsed / SWEEP_MS);
        focus = focusAt(elapsed);
        renderTimeline();
        if (u < 1) {
          sweepRaf = requestAnimationFrame(step);
          return;
        }
        // ---- Phase 2: every dot is on screen. Hold, so the full span reads
        // as a finished picture before anything starts taking it away.
        focus = NOW;
        behind = NOW - T0; // window already spans everything; nothing moves yet
        ahead = DEFAULT_AHEAD;
        renderTimeline();
        setTimeout(() => {
          if (!sweepActive) return;
          // ---- Phase 3: introduce the control that explains the view.
          tl.wrap?.classList.remove('tl-enter');
          // ---- Phase 4: hand the window back to the real relevance math and
          // narrow it. Dots fall away in step with the shrinking selector,
          // which is what teaches the reader what the selector does.
          setTimeout(() => {
            if (!sweepActive) return;
            introAccumulate = false;
            const fromBehind = behind;
            const n0 = performance.now();
            const ease = (u: number) => 1 - Math.pow(1 - u, 3);
            const narrow = (nowMs: number) => {
              if (!sweepActive) return;
              const u = Math.max(0, Math.min(1, (nowMs - n0) / NARROW_MS));
              behind = fromBehind + (DEFAULT_BEHIND - fromBehind) * ease(u);
              renderTimeline();
              if (u < 1) {
                sweepRaf = requestAnimationFrame(narrow);
              } else {
                behind = DEFAULT_BEHIND;
                renderTimeline();
                sweepActive = false;
                introCam = false;
                pushLine(`# ${data.nodes.length} of them, and still growing`);
                // Let the closing line be read, then hand the header back to
                // its resting state: log cleared, wordmark returned.
                setTimeout(() => {
                  if (termEl) termEl.textContent = '';
                  headerEl?.classList.remove('has-log');
                }, 3400);
              }
            };
            sweepRaf = requestAnimationFrame(narrow);
          }, 700); // let the selector land before it starts moving
        }, HOLD_MS);
      };
      sweepRaf = requestAnimationFrame(step);
      }, LINGER_MS)),
    );
  } else {
    renderTimeline();
  }
  const panel = document.getElementById('domain-panel');
  const toggle = document.getElementById('panel-toggle');
  toggle?.addEventListener('click', () => {
    const open = panel!.toggleAttribute('data-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // ---- Hover tooltip: follows the cursor while over a dot.
  const tip = document.getElementById('map-tip') as HTMLElement;
  const tipOrg = tip.querySelector('.tip-org') as HTMLElement;
  const tipTitle = tip.querySelector('.tip-title') as HTMLElement;
  const tipWhen = tip.querySelector('.tip-when') as HTMLElement;
  const tipText = tip.querySelector('.tip-text') as HTMLElement;
  const tipTech = tip.querySelector('.tip-tech') as HTMLElement;
  const yearOf = (d?: string | null) => (d ? d.slice(0, 4) : null);
  // "2019 - 2021", "2024 - present", or a single year when it began and ended
  // in the same one. Teasers carry no dates at all.
  const rangeOf = (n: GraphNode) => {
    const a = yearOf(n.started);
    if (!a) return '';
    const b = yearOf(n.ended);
    if (!b) return `${a} - present`;
    return a === b ? a : `${a} - ${b}`;
  };
  const showTip = (n: GraphNode, px: number, py: number) => {
    // The eyebrow answers "whose is this?" It carries the employer when there
    // is one, so employer work is never read as a side project, and otherwise
    // the parent, so a satellite is never read as a standalone project. Both
    // at once would be noise; an employer's own sub-project inherits the org
    // from context and the parent is the more specific fact.
    const owner = n.parent ? byId.get(n.parent) : undefined;
    const eyebrow = owner ? `part of ${owner.title}` : (n.org ?? '');
    tipOrg.textContent = eyebrow;
    tipOrg.hidden = !eyebrow;
    tipOrg.classList.toggle('is-parent', Boolean(owner));
    tipTitle.textContent = n.title;
    const when = rangeOf(n);
    tipWhen.textContent = when;
    tipWhen.hidden = !when;
    tipText.textContent = n.visibility === 'teaser' ? 'In stealth. This one stays locked.' : n.tagline;
    tipTech.textContent = n.tech?.length ? n.tech.join(' · ') : '';
    tipTech.hidden = !n.tech?.length;
    tip.style.setProperty('--lamp', lamp(n.domain));
    tip.hidden = false;
    // Position near the cursor, flipped when it would leave the map.
    const pad = 14;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = `${px + pad + w > width ? px - pad - w : px + pad}px`;
    tip.style.top = `${py + pad + h > height ? py - pad - h : py + pad}px`;
  };

  const pick = (px: number, py: number): GraphNode | null => {
    const [x, y] = transform.invert([px, py]);
    let best: GraphNode | null = null;
    let bestD = Infinity;
    for (const n of data.nodes) {
      if (!matchesFilter(n) || relevance(n) < HIDE_BELOW) continue;
      const dx = (n.x ?? 0) - x;
      const dy = (n.y ?? 0) - y;
      const d = Math.hypot(dx, dy);
      if (d < radiusOf(n) + 8 && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  canvas.addEventListener('pointermove', (ev) => {
    // Hover affordances are mouse/pen only; on touch a moving finger is a
    // pan, and tap-to-open shows everything the tooltip would.
    if (ev.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    hovered = pick(px, py);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    if (hovered) showTip(hovered, px, py);
    else tip.hidden = true;
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    tip.hidden = true;
  });

  // ---- Expanded project: modal overlay, real URL via pushState.
  const modal = document.getElementById('node-modal') as HTMLElement;
  const frame = document.getElementById('node-frame') as HTMLIFrameElement;
  const barPath = document.getElementById('node-bar-path');
  const openNode = (id: string, push: boolean) => {
    frame.src = `/idea/${id}?embed=1`;
    if (barPath) barPath.textContent = `/idea/${id}`;
    modal.hidden = false;
    tip.hidden = true;
    if (push) history.pushState({ node: id }, '', `/idea/${id}`);
  };
  const closeNode = (fromHistory: boolean) => {
    if (modal.hidden) return;
    modal.hidden = true;
    frame.src = 'about:blank';
    if (!fromHistory && history.state?.node) history.back();
  };
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const n = pick(ev.clientX - r.left, ev.clientY - r.top);
    if (!n) return;
    // A faded node from another era travels you back to its time instead of
    // opening; fully-relevant nodes open the write-up.
    if (relevance(n) < 0.85 && n.started) {
      travelTo(Date.parse(n.started) + behind * 0.4);
      return;
    }
    if (n.visibility !== 'public') return;
    // A node can be its own dot without being its own essay. Deferring nodes
    // open the parent's write-up, because that is where their story is told.
    const target = n.detail === 'parent' && n.parent ? n.parent : n.id;
    openNode(target, true);
  });
  modal.querySelector('.node-close')?.addEventListener('click', () => closeNode(false));
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) closeNode(false);
  });
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeNode(false);
  });
  addEventListener('popstate', () => {
    const m = location.pathname.match(/^\/idea\/([a-z0-9-]+)$/);
    if (m) openNode(m[1], false);
    else closeNode(true);
  });

  // Deep link: /#slug centers that node once positions settle.
  const wanted = location.hash.slice(1);
  if (wanted) {
    sim.on('end.deeplink', () => {
      const n = data.nodes.find((x) => x.id === wanted);
      if (n) {
        sel.call(
          zoomer.transform,
          zoomIdentity.translate(width / 2, height / 2).scale(1.4).translate(-(n.x ?? 0), -(n.y ?? 0)),
        );
      }
    });
  }

  // Animation state: labels type in / fade out; node visibility and cluster
  // geometry are smoothed so nothing pops or snaps as the era changes.
  const labelAnim = new Map<string, { alpha: number; typed: number; bornAt: number }>();
  const clusterAlpha = new Map<string, number>();
  const clusterGeo = new Map<string, { cx: number; cy: number; r: number }>();
  const nodeVis = new Map<string, number>();
  let watermark = 0.05;
  let lastFrame = 0;

  let raf = 0;
  const draw = (t: number) => {
    raf = requestAnimationFrame(draw);
    if (document.hidden) return;
    const dt = Math.min(100, lastFrame ? t - lastFrame : 16);
    lastFrame = t;

    // Smooth every node's visibility toward its raw relevance: dots grow in
    // and shrink away instead of jumping between eras.
    for (const n of data.nodes) {
      const target = relevance(n);
      const cur = nodeVis.get(n.id) ?? 0;
      const diff = target - cur;
      const step = dt / (diff > 0 ? 300 : 420);
      nodeVis.set(n.id, cur + Math.sign(diff) * Math.min(Math.abs(diff), step));
    }
    const svOf = (n: GraphNode) => nodeVis.get(n.id) ?? 0;

    if (introCam) {
      fitCamera(
        data.nodes.filter((n) => svOf(n) > 0.05 && matchesFilter(n)),
        dt,
      );
    }

    ctx.clearRect(0, 0, width, height);

    // The year, dead center, everything floating over it. This IS the time
    // readout; it counts up during the intro sweep and tracks the scrubber.
    ctx.font = `600 ${Math.min(width, height) * 0.3}px ${FONT_DATA}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    // The year is ambient context, not content. When a dot is engaged it steps
    // further back so it cannot compete with the thing being read.
    const wmTarget = hovered ? 0.018 : 0.05;
    watermark += (wmTarget - watermark) * (1 - Math.exp(-dt / 180));
    ctx.globalAlpha = watermark;
    ctx.fillText(String(new Date(focus).getUTCFullYear()), width / 2, height / 2);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // cluster boundaries: one CIRCLE per domain, sized by member count, drawn
    // even around a single node so a lone idea still reads as belonging,
    // label breaking the stroke at the top like a fieldset legend.
    // Boundaries fade in/out instead of popping as eras change.
    for (const d of domains) {
      const members = simNodes.filter(
        (n) => n.domain === d && matchesFilter(n) && svOf(n) > 0.4,
      );
      const target = members.length >= 1 ? 1 : 0;
      let ca = clusterAlpha.get(d) ?? 0;
      ca = target ? Math.min(1, ca + dt / 260) : Math.max(0, ca - dt / 380);
      clusterAlpha.set(d, ca);
      if (ca < 0.02 || members.length === 0) continue;
      const tx = members.reduce((s, n) => s + (n.x ?? 0), 0) / members.length;
      const ty = members.reduce((s, n) => s + (n.y ?? 0), 0) / members.length;
      // The count-derived radius is a FLOOR, not the whole answer.
      //
      // Positions come from a simulation that sees every member of a domain,
      // but only the members alive in the current era are drawn. Early in the
      // sweep three of fifteen apps might be visible while sitting anywhere
      // across the spread of all fifteen, so a circle sized purely by how many
      // are visible draws smaller than the dots it claims to contain and they
      // hang outside it until the era catches up.
      //
      // So take whichever is larger. A settled cluster is sized by membership,
      // which is what makes size mean something; a partly-populated one grows
      // to hold what it is actually enclosing. The boundary never makes a
      // claim that is visibly false.
      //
      // Reach is measured over every dot that is DRAWN, not just the ones
      // solid enough to count toward the size, because a fading ghost outside
      // the ring looks exactly as wrong as a bright one.
      let reach = 0;
      for (const n of simNodes) {
        if (n.domain !== d || !matchesFilter(n) || svOf(n) < 0.03) continue;
        reach = Math.max(
          reach,
          Math.hypot((n.x ?? 0) - tx, (n.y ?? 0) - ty) + footprintOf(n) + 10,
        );
      }
      const tr = Math.max(clusterRadius(members), reach);
      // Boundary geometry chases its target: circles reshape and grow rather
      // than snapping when a member arrives or departs.
      let geo = clusterGeo.get(d);
      if (!geo) {
        geo = { cx: tx, cy: ty, r: tr };
        clusterGeo.set(d, geo);
      }
      const k = 1 - Math.exp(-dt / 300);
      geo.cx += (tx - geo.cx) * k;
      geo.cy += (ty - geo.cy) * k;
      // Growth and shrink are not symmetric. Lagging while growing leaves a dot
      // stranded outside the ring, which is the whole bug this guards against;
      // lagging while shrinking is merely a circle that stays roomy a moment
      // longer. So expand quickly and contract lazily.
      geo.r += (tr - geo.r) * (1 - Math.exp(-dt / (tr > geo.r ? 80 : 420)));
      const cx = geo.cx;
      const cy = geo.cy;
      const cr = geo.r;
      const color = lamp(d);

      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.03 * ca;
      ctx.fill();
      ctx.globalAlpha = 0.26 * ca;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / transform.k;
      ctx.stroke();

      // legend label breaks the circle's top
      const size = 10.5 / transform.k;
      ctx.font = `600 ${size}px ${FONT_DATA}`;
      const text = (data.domainLabels?.[d] ?? d).toUpperCase();
      const tw = ctx.measureText(text).width;
      ctx.globalAlpha = ca;
      ctx.fillStyle = GROUND;
      ctx.fillRect(cx - tw / 2 - 6 / transform.k, cy - cr - size * 0.75, tw + 12 / transform.k, size * 1.5);
      ctx.globalAlpha = 0.5 * ca;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, cy - cr + size * 0.35);
    }
    ctx.globalAlpha = 1;

    // Satellite systems. A filled disc under the parent and its ring is what
    // actually communicates "these are one thing"; the spokes alone read as
    // just more edges. Drawn after the domain boundary and before everything
    // else so it layers as a sub-region of the cluster it sits in.
    for (const [pid, kids] of childrenOf) {
      const p = byId.get(pid);
      if (!p) continue;
      const live = kids.filter((c) => svOf(c) > 0.05 && matchesFilter(c));
      if (!live.length || svOf(p) < 0.05) continue;
      const sysAlpha = Math.min(svOf(p), Math.max(...live.map(svOf)));
      const active = hovered === p || live.includes(hovered as GraphNode);
      const color = lamp(p.domain);
      const R = orbitRadius(p, kids) + Math.max(...kids.map(radiusOf)) + 5;

      ctx.beginPath();
      ctx.arc(p.x ?? 0, p.y ?? 0, R, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = (active ? 0.1 : 0.055) * sysAlpha;
      ctx.fill();

      // Spokes, inside the disc. They point at the parent, which is the
      // direction the relationship actually runs.
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / transform.k;
      for (const c of live) {
        ctx.globalAlpha = (active ? 0.55 : 0.22) * svOf(c);
        ctx.beginPath();
        ctx.moveTo(p.x ?? 0, p.y ?? 0);
        ctx.lineTo(c.x ?? 0, c.y ?? 0);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // edges: dashed threads
    ctx.lineWidth = 1 / transform.k;
    ctx.setLineDash([2 / transform.k, 4 / transform.k]);
    for (const e of edges) {
      if (e.kind === 'parent') continue;
      const s = e.source as GraphNode;
      const g = e.target as GraphNode;
      const relEdge = Math.min(svOf(s), svOf(g));
      if (relEdge < 0.03) continue;
      const active = hovered === s || hovered === g;
      const filtered = !matchesFilter(s) || !matchesFilter(g);
      ctx.strokeStyle = active ? INK_DIM : INK_FAINT;
      // edges are on-demand detail: a whisper at rest, bright on hover
      ctx.globalAlpha = (filtered ? 0.04 : active ? 0.9 : 0.14) * relEdge;
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(g.x ?? 0, g.y ?? 0);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const n of data.nodes) {
      const sv = svOf(n);
      if (sv < 0.03) continue; // not in this era (yet, or anymore)
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      // newborn and out-of-era nodes are smaller; growth is smoothed
      const r = radiusOf(n) * (0.45 + 0.55 * sv);
      const color = n.visibility === 'teaser' ? INK_FAINT : lamp(n.domain);
      const isActive = hovered === n;

      const visible = matchesFilter(n);
      let baseAlpha = 1;
      if (n.status === 'retired') baseAlpha = RETIRED_DIM;
      if (n.status === 'building' && !reducedMotion) {
        baseAlpha = 0.62 + 0.38 * Math.sin(t / 700 + (n.index ?? 0));
      }
      let alpha = baseAlpha * sv;
      if (!visible) alpha = 0.07;
      ctx.globalAlpha = alpha;

      if (n.visibility === 'teaser') {
        ctx.setLineDash([3 / transform.k, 3 / transform.k]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4 / transform.k;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (n.status === 'idea') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r - 1, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        if (n.status === 'shipped' || isActive) {
          // repo freshness feeds the glow: recently-active nodes burn brighter
          ctx.shadowColor = color;
          ctx.shadowBlur = isActive ? 18 : 6 + 10 * (n.freshness ?? 0.35);
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (isActive) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5 / transform.k;
        ctx.beginPath();
        ctx.arc(x, y, r + 4 / transform.k, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Label hierarchy: flagships and the hovered node at rest; everything
      // when zoomed in. During the intro sweep, ideas being born near the
      // focus year announce themselves so the tour reads as a story.
      // During the sweep a label types the moment its dot appears on screen
      // (wall-clock anchored), and holds ~2.6s before fading.
      const st = labelAnim.get(n.id) ?? { alpha: 0, typed: 0, bornAt: 0 };
      if (sweepActive && sv > 0.03 && st.bornAt === 0) st.bornAt = t;
      if (!sweepActive && st.bornAt !== 0) st.bornAt = 0;
      const birthLabel = sweepActive && st.bornAt > 0 && t - st.bornAt < 2600;
      const labelWorthy =
        isActive || (n.scale ?? 2) >= 4 || transform.k >= 1.2 || birthLabel;
      const zoomAlpha = Math.max(0, Math.min(1, (transform.k - 0.45) / 0.35));
      const wanted = labelWorthy && visible;
      if (wanted) {
        st.alpha = Math.min(1, st.alpha + dt / 150);
        st.typed = Math.min(n.title.length, st.typed + dt / 26);
      } else {
        st.alpha = Math.max(0, st.alpha - dt / 380);
        if (st.alpha === 0) st.typed = 0;
      }
      labelAnim.set(n.id, st);

      if (st.alpha > 0.02 && zoomAlpha > 0.02) {
        const typing = wanted && st.typed < n.title.length;
        const shown = wanted ? n.title.slice(0, Math.ceil(st.typed)) : n.title;
        const label = typing ? `${shown}_` : shown;
        // sqrt(sv): the label brightens ahead of the still-growing newborn
        // dot so the type-in is legible from its first character
        const la = (visible ? baseAlpha * Math.sqrt(sv) : 0.07) * zoomAlpha * st.alpha;
        const lx = x;
        const ly = y + r + 14 / transform.k;
        ctx.font = `${11 / transform.k}px ${FONT_DATA}`;
        ctx.textAlign = 'center';

        // Halo. A label is drawn semi-transparent, so without this the dashed
        // edges and cluster rings behind it composite THROUGH the letterforms
        // and read as a strikethrough. Knocking the ground out from under the
        // glyphs is the fix; drawing the label opaque instead would flatten
        // the depth cue that dims distant eras.
        // Kept more opaque than the text so it still clears at low label alpha.
        ctx.globalAlpha = Math.min(1, la * 2.2);
        ctx.strokeStyle = GROUND;
        ctx.lineWidth = 4 / transform.k;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(label, lx, ly);

        ctx.globalAlpha = la;
        ctx.fillStyle = isActive ? INK : INK_DIM;
        ctx.fillText(label, lx, ly);
        ctx.lineJoin = 'miter';
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
  raf = requestAnimationFrame(draw);

  addEventListener('pagehide', () => cancelAnimationFrame(raf));
}
