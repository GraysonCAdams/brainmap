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
 * address bar always holds a shareable /idea/<slug> link. The tooltip is not
 * hover-only: a tap on a dot that cannot open a write-up (stealth, or faded
 * out of the current era) shows it, and focusing a link in the map index or
 * the start-here path pins it to that link's dot.
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
import { createDialog } from './MapDialog';
import { ERAS, eraFor, eraSpan } from './MapEras';

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
  // The index is the page's real content and must survive a failure here: the
  // canvas is a picture of it, not the other way round. Replacing it with an
  // apology would take every project link down with the drawing.
  root.removeAttribute('data-mapped');
  root.querySelector('canvas')?.remove();
  const note = document.createElement('p');
  note.className = 'mi-fallback';
  note.textContent = 'The map could not be drawn. Every idea on it is listed below.';
  document.getElementById('map-index')?.prepend(note);
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

  // The build-time index inside #map-root stays exactly where it is; the
  // canvas is laid over it and the marker attribute is what tells the
  // stylesheet to clip the list down to a screen-reader-only copy. Clearing
  // the container here (which is what this used to do) deleted every project
  // link on the page and left the canvas as the only way to reach a write-up.
  //
  // An inline script in index.astro normally sets this during parse, so the
  // list is never painted full-width. Setting it again covers the case where
  // that script's own rescue timer fired first because this module was slow.
  root.dataset.mapped = '1';
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.cursor = 'grab';
  // Without this, mobile browsers claim pinch/pan for page zoom and scroll.
  canvas.style.touchAction = 'none';
  // role=img, not role=application. The canvas has no focusable descendants
  // and no keyboard model of its own to document: the list underneath it is
  // the keyboard and assistive-technology route to the same nodes, and it is
  // real markup that a screen reader can browse. role=application would put
  // every reader into application mode and hand this file responsibility for
  // all keyboard interaction inside a drawing that has none, which is exactly
  // the misuse ARIA warns about. role=img says what it is: one self-contained
  // picture, with a label describing it.
  canvas.setAttribute('role', 'img');
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
  // The domain panel and the timeline are opaque overlays sitting on top of the
  // canvas, so the area actually free to hold dots is smaller than the canvas
  // is. Every camera decision below frames against this rect rather than the
  // full viewport. Centering on the viewport pushed whichever cluster happened
  // to land on the left edge underneath the panel, where it could not be read
  // or clicked, and no amount of zooming out recovered it because the panel
  // moved with the viewport rather than with the world.
  //
  // Measured from the live elements instead of their CSS width, because the
  // panel collapses to a single button below the mobile breakpoint and its
  // height depends on how many domains and tech chips the content produced.
  let viewLeft = 0;
  let viewWidth = 0;
  let viewHeight = 0;
  const measureView = () => {
    const gap = 24;
    const rect = root.getBoundingClientRect();
    let left = 0;
    let bottom = height;
    const panel = document.getElementById('domain-panel');
    if (panel) {
      const r = panel.getBoundingClientRect();
      // Below the mobile breakpoint the panel keeps its 13rem box while its
      // body is display:none, so only the toggle button paints. Measuring
      // width alone there reserves a column that is not on screen and squashes
      // the map into the right half of a phone. A collapsed panel occludes the
      // top-left corner rather than a column, which the camera can ignore.
      if (r.width > 0 && r.height > height * 0.35) left = Math.max(left, r.right - rect.left + gap);
    }
    const tl = document.getElementById('timeline');
    if (tl) {
      const r = tl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) bottom = Math.min(bottom, r.top - rect.top - gap);
    }
    // Clamped so the chrome can never claim so much that the map is squeezed
    // into a sliver. Past roughly half the viewport the overlay has become the
    // layout, and framing the remainder is worse than simply ignoring it.
    viewLeft = Math.min(left, width * 0.45);
    viewWidth = Math.max(1, width - viewLeft);
    viewHeight = Math.max(1, Math.min(bottom, height));
  };
  const viewCX = () => viewLeft + viewWidth / 2;
  const viewCY = () => viewHeight / 2;
  // Watermark type size, shared with the draw loop so the caption printed
  // underneath can clear the digits without a second copy of the size rule.
  const wmSize = () => Math.min(viewWidth, viewHeight) * 0.3;

  // ---- Era caption: the year watermark's subtitle.
  //
  // DOM rather than canvas, so the sentence wraps on its own, keeps the type
  // tokens and stays selectable. The watermark is a single number and stays
  // where it is drawn.
  //
  // Both are rendered from `focus`. That is the whole point of the pairing:
  // when the sentence came from a schedule index and the year came from
  // `focus`, the two could disagree, and did, for the entire beat the sweep
  // holds still so the sentence can be read.
  const eraEl = document.getElementById('map-era');
  const eraSpanEl = eraEl?.querySelector('.era-span') as HTMLElement | null;
  const eraTextEl = eraEl?.querySelector('.era-text') as HTMLElement | null;
  const renderEra = () => {
    if (!eraEl || !eraSpanEl || !eraTextEl) return;
    const era = eraFor(focus);
    eraSpanEl.textContent = eraSpan(era);
    eraTextEl.textContent = era[2];
    // Centred on the watermark horizontally (CSS pulls it back half its own
    // width) and hung below it. The digits are drawn from a middle baseline at
    // roughly 0.35 of the type size either way, so 0.42 clears them with a gap
    // that scales with the type rather than a fixed pixel value that would
    // collide on a phone.
    eraEl.style.left = `${viewCX()}px`;
    eraEl.style.top = `${viewCY() + wmSize() * 0.42}px`;
    eraEl.hidden = false;
  };

  resize();
  measureView();
  // Not called here: `focus` is declared further down and would be in its
  // temporal dead zone. The first paint comes from renderTimeline() during
  // init, and the observer's own initial callback runs after this module body.
  new ResizeObserver(() => {
    resize();
    measureView();
    renderEra();
  }).observe(root);
  // The panel changes size without the viewport changing, when the mobile
  // toggle opens it or a filter reflows the chip rows, so it needs watching
  // on its own.
  const panelEl = document.getElementById('domain-panel');
  if (panelEl) new ResizeObserver(measureView).observe(panelEl);

  // Domain clusters: centroids on an ellipse, assigned in palette order.
  const domains = [...new Set(data.nodes.map((n) => n.domain))];

  // The canvas is one image, so it gets one description: what is plotted, over
  // what span, and what the visual encoding means. The detail lives in the
  // index, and the label says so rather than pretending to substitute for it.
  const years = data.nodes
    .filter((n) => n.started)
    .map((n) => new Date(n.started!).getUTCFullYear());
  const domainNames = domains.map((d) => data.domainLabels?.[d] ?? d).join(', ');
  canvas.setAttribute(
    'aria-label',
    `Map of ${data.nodes.length} projects from ${Math.min(...years)} to ${Math.max(...years)}, ` +
      `clustered into ${domains.length} domains: ${domainNames}. Colour is the domain, ` +
      `dot size is the scope of the project, and the treatment is its status: a hollow ring ` +
      `is an idea, a solid glowing dot shipped, a dimmed dot retired. ` +
      `The same projects are listed in full in the map index.`,
  );

  // Filter changes are a visual event: dots dim out and cluster rings shrink.
  // This is where that gets said out loud.
  const statusEl = document.getElementById('map-status');
  const announce = (msg: string) => {
    if (statusEl) statusEl.textContent = msg;
  };
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

  // A force layout settling is continuous motion for several seconds, which is
  // the thing prefers-reduced-motion is asking not to see. Run it to its own
  // end state up front instead, so the first frame drawn is the last frame the
  // layout would have reached. sim.tick() advances the model without emitting
  // tick events, hence the explicit placeSatellites() after; the internal
  // timer is deliberately left alone so it still fires 'end' on the next frame
  // and the listeners hanging off it (the pan extent, the deep-link camera)
  // behave exactly as they do at full motion.
  if (reducedMotion) {
    for (let i = 0; i < 600 && sim.alpha() > sim.alphaMin(); i++) sim.tick();
    placeSatellites();
  }

  let transform: ZoomTransform = zoomIdentity.translate(viewCX(), viewCY());
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
    const k = Math.max(0.35, Math.min(1.6, Math.min(viewWidth / w, viewHeight / h)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2 + (padTop - pad) / 2;
    // Critically damped chase: no overshoot, frame-rate independent.
    const s = 1 - Math.exp(-dt / 420);
    const nk = transform.k + (k - transform.k) * s;
    const nx = transform.x + (viewCX() - cx * nk - transform.x) * s;
    const ny = transform.y + (viewCY() - cy * nk - transform.y) * s;
    transform = constrained(zoomIdentity.translate(nx, ny).scale(nk));
    sel.call(zoomer.transform, transform);
  };

  let hovered: GraphNode | null = null;

  // ---- Facet filters: domains and tech; AND across facets, OR within.
  const activeDomains = new Set<string>();
  const activeTech = new Set<string>();
  // A one-member set rather than a boolean, so it rides the same wireFacet
  // path as the other two and inherits their announce and aria-pressed
  // handling instead of growing a parallel one.
  const activeOrg = new Set<string>();
  const matchesFilter = (n: GraphNode) => {
    const okDomain =
      activeDomains.size === 0 ||
      activeDomains.has(n.domain) ||
      (n.tags ?? []).some((t) => activeDomains.has(t));
    const okTech =
      activeTech.size === 0 || (n.tech ?? []).some((t) => activeTech.has(t));
    // The same test that knocks a briefcase out of the dot further down. If
    // these two ever diverge, the filter selects a set the map is not marking.
    const okOrg = activeOrg.size === 0 || Boolean(n.org && n.visibility === 'public');
    return okDomain && okTech && okOrg;
  };
  const wireFacet = (attr: string, set: Set<string>) => {
    document.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute(attr)!;
        const on = !set.has(v);
        if (on) set.add(v);
        else set.delete(v);
        btn.setAttribute('aria-pressed', String(on));
        // aria-pressed alone reports the button's own state. What a reader
        // needs is the consequence: how much of the map is left.
        const shown = data.nodes.filter(matchesFilter).length;
        // The button's own text carries its match count as a second number,
        // which reads as noise next to the count this sentence is about.
        const label = btn.querySelector('.dname')?.textContent?.trim() ?? v;
        announce(
          activeDomains.size + activeTech.size + activeOrg.size === 0
            ? `Filters cleared. All ${data.nodes.length} projects shown.`
            : `${label} ${on ? 'on' : 'off'}. ${shown} of ${data.nodes.length} projects shown.`,
        );
      });
    });
  };
  wireFacet('data-domain-filter', activeDomains);
  wireFacet('data-tech-filter', activeTech);
  wireFacet('data-org-filter', activeOrg);

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
  // Pre-run state: the script has not executed, so the map holds nothing.
  //
  // This used to be faked by parking `focus` a year before the first node, but
  // that put a real year on the watermark during which, by construction,
  // nothing could ever happen. The clock appeared to be running over a dead
  // year. Emptiness and the displayed year are different facts and now have
  // different variables, so the counter can open honestly on the first year
  // that has something in it.
  let introArmed = false;
  const relevance = (n: GraphNode): number => {
    const [start, end] = spanOf(n);
    if (introArmed) return 0;
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
  const yearAt = (t: number) => new Date(t).getUTCFullYear();
  const FIRST_YEAR = yearAt(T0);
  const THIS_YEAR = yearAt(NOW);
  // How far either edge of the relevance window can be stretched from focus.
  const MAX_SPAN = 40 * YEAR;
  const MAX_SPAN_YEARS = Math.round(MAX_SPAN / YEAR);
  // The three sliders report years, not internal offsets, and each range is
  // the range that value can actually take: focus is clamped to the span the
  // map covers, and each edge can sit up to MAX_SPAN either side of it.
  // Refreshed here rather than in the key handlers so a pointer drag keeps
  // them true too.
  const renderTimeline = () => {
    tl.handle.style.left = `${pct(focus)}%`;
    // true width always; overhang past either end is clipped, never squashed
    const l = pct(focus - behind);
    const r = pct(focus + ahead);
    tl.region.style.left = `${l}%`;
    tl.region.style.width = `${r - l}%`;

    const setSlider = (el: HTMLElement, now: number, min: number, max: number, text: string) => {
      el.setAttribute('aria-valuenow', String(now));
      el.setAttribute('aria-valuemin', String(min));
      el.setAttribute('aria-valuemax', String(max));
      el.setAttribute('aria-valuetext', text);
    };
    const f = yearAt(focus);
    const back = yearAt(focus - behind);
    const fwd = yearAt(focus + ahead);
    setSlider(tl.handle, f, FIRST_YEAR, THIS_YEAR, String(f));
    setSlider(
      tl.edgeL,
      back,
      f - MAX_SPAN_YEARS,
      f,
      `${back}, ${Math.round(behind / YEAR)} years back`,
    );
    setSlider(
      tl.edgeR,
      fwd,
      f,
      f + MAX_SPAN_YEARS,
      `${fwd}, ${Math.round(ahead / YEAR)} years ahead`,
    );
    // The caption rides the same call every focus change already makes, so the
    // sweep, travelTo, the drag and the keyboard steps all update it without
    // four separate hooks that could each be forgotten.
    renderEra();
  };
  // Keyboard equivalent for the drag. Every one of these three is a drag
  // handle and nothing else, so without this the whole time axis is
  // pointer-only (WCAG 2.1.1). Arrow keys follow the slider pattern: right and
  // up raise the year, left and down lower it, Page steps by five, Home and
  // End go to the ends of the run.
  const stepFor = (ev: KeyboardEvent): number | null => {
    switch (ev.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        return YEAR;
      case 'ArrowLeft':
      case 'ArrowDown':
        return -YEAR;
      case 'PageUp':
        return 5 * YEAR;
      case 'PageDown':
        return -5 * YEAR;
      default:
        return null;
    }
  };
  const wireSlider = (
    el: HTMLElement,
    ops: { step: (delta: number) => void; home: () => void; end: () => void },
  ) => {
    el.addEventListener('keydown', (ev) => {
      const delta = stepFor(ev);
      if (delta !== null) ops.step(delta);
      else if (ev.key === 'Home') ops.home();
      else if (ev.key === 'End') ops.end();
      else return;
      ev.preventDefault();
      cancelSweep(); // same as grabbing it with a pointer: the tour yields
      renderTimeline();
    });
  };
  const clampSpan = (v: number) => Math.min(MAX_SPAN, Math.max(0.5 * YEAR, v));
  wireSlider(tl.handle, {
    step: (d) => (focus = Math.min(NOW, Math.max(T0, focus + d))),
    home: () => (focus = T0),
    end: () => (focus = NOW),
  });
  wireSlider(tl.edgeL, {
    // The left edge reports a year, so a positive step moves it later, which
    // means less of the past: `behind` shrinks as the edge rises.
    step: (d) => (behind = clampSpan(behind - d)),
    home: () => (behind = MAX_SPAN),
    end: () => (behind = 0.5 * YEAR),
  });
  wireSlider(tl.edgeR, {
    step: (d) => (ahead = clampSpan(ahead + d)),
    home: () => (ahead = 0.5 * YEAR),
    end: () => (ahead = MAX_SPAN),
  });
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
  // ---- The one line the header ever holds.
  //
  // Typed once at the start of the tour and left there. It is the site's
  // wordmark in its issued form: the prompt is the same `gray@brainmap:~$` the
  // static wordmark shows, so the header reads as one shell where a command
  // was run, not as a log that scrolls. Nothing else is ever appended.
  const CMD = 'chmod +x load_projects.sh && ./load_projects.sh';
  const PROMPT =
    '<span class="p-user">gray</span><span class="p-path">@</span>' +
    '<span class="p-host">brainmap</span><span class="p-path">:~$</span> ';
  let cmdEl: HTMLDivElement | null = null;
  const drawCommand = (upTo: number, caret: boolean) => {
    if (!cmdEl) return;
    cmdEl.innerHTML = `${PROMPT}<span class="cmd">${CMD.slice(0, upTo)}</span>${
      caret ? '<span class="cursor"></span>' : ''
    }`;
  };
  /** Complete a command interrupted mid-type, and retire its caret. */
  const settleCommand = () => drawCommand(CMD.length, false);

  // The tour's visible exit. Every other way out (grabbing the timeline, the
  // reset button) is a control a first-time visitor has to discover means
  // "skip"; this one says so, stays on screen for the whole ~50s run, and
  // leaves through the same cancelSweep path the others take.
  const skipBtn = document.getElementById('skip-intro') as HTMLButtonElement | null;
  // Skipping lands on the finished map, not on whichever year the tour had
  // reached: travelTo runs cancelSweep first, then brings the clock to today.
  skipBtn?.addEventListener('click', () => travelTo(NOW, 500));

  const cancelSweep = () => {
    if (!sweepActive) return;
    sweepActive = false;
    cancelAnimationFrame(sweepRaf);
    // Bail out of every intro-only mode; leaving accumulate on would pin all
    // 26 years of dots on screen permanently, and leaving the map armed would
    // leave a visitor who skips the intro staring at empty ground.
    introArmed = false;
    introAccumulate = false;
    introCam = false;
    behind = DEFAULT_BEHIND;
    ahead = DEFAULT_AHEAD;
    tl.wrap?.classList.remove('tl-enter');
    // The command stays on screen. Skipping the tour skips the tour, not the
    // shell it was issued from, so the only thing to settle is a command caught
    // mid-keystroke: finish it and drop the caret rather than stranding half a
    // filename in the header.
    settleCommand();
    if (skipBtn) skipBtn.hidden = true;
    renderTimeline();
  };
  // The tour only starts once the whoami modal is gone; running it behind the
  // backdrop wastes it on the exact visitor it exists for.
  const whenBegun = (fn: () => void) => {
    if ((window as unknown as { brainmapBegin?: boolean }).brainmapBegin) fn();
    else addEventListener('brainmap:begin', fn, { once: true });
  };

  if (!reducedMotion && !location.hash) {
    // Open on an EMPTY map, but with the clock already reading the year the
    // story actually starts. Nothing renders until the command has run.
    introArmed = true;
    focus = T0;
    renderTimeline();
    sweepActive = true;

    const termEl = document.getElementById('term');
    const headerEl = document.querySelector('header');

    // Pacing is driven by READING TIME, not by idea density: an era holds the
    // screen for as long as its own sentence takes to read, so a long line is
    // never yanked away mid-clause. 31ms/char is around 320wpm: brisk, and
    // defensible only because these are plain conversational sentences rather
    // than dense prose. A settle beat runs before the eye starts.
    //
    // Both numbers came down (from 52 and 1500) as the sentences grew from ~70
    // characters to ~140, which holds the whole tour near its old ~52s instead
    // of pushing it past a minute. The caption is what makes that affordable:
    // it outlives the sweep and tracks the scrubber, so this window is no
    // longer anyone's only chance to read a line.
    const PER_CHAR = 31;
    const SETTLE_MS = 1000;
    // Fraction of an era spent travelling. The remainder is a dead stop: the
    // year stops counting and the dots stop arriving so the sentence can be
    // read against a still frame. Reading against motion is the thing that
    // made this feel rushed even at a generous words-per-minute.
    const TRAVEL = 0.62;
    // `to` is the last instant INSIDE the era, not the first of the next one.
    // Ending on January 1 of era[1] + 1 pushed focus into the following year at
    // the end of every travel phase, so the watermark read one year while the
    // caption underneath it still named the old range, and it held that way
    // through the whole dead stop below. The caption reads eraFor(focus), so
    // an off-by-one here is visible on screen rather than merely internal.
    // Timings only. The words are no longer pulled from here: the caption
    // reads eraFor(focus), so the schedule's one job is to say how long the
    // clock spends in each era and where it sits while it does.
    const schedule = ERAS.map((era) => ({
      from: Date.UTC(era[0], 0, 1),
      to: Math.min(NOW, Date.UTC(era[1], 11, 31, 23, 59, 59, 999)),
      dur: SETTLE_MS + era[2].length * PER_CHAR,
    }));
    const SWEEP_MS = schedule.reduce((acc, e) => acc + e.dur, 0);
    // Maps elapsed wall-clock onto the focus year. It emits nothing: the
    // caption is a function of the focus this returns, so moving the clock is
    // the only thing the sweep has to do to narrate.
    const focusAt = (elapsed: number) => {
      let acc = 0;
      for (let i = 0; i < schedule.length; i++) {
        const e = schedule[i];
        const last = i === schedule.length - 1;
        if (elapsed < acc + e.dur || last) {
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

    const typeCommand = (done: () => void) => {
      if (!termEl) return done();
      headerEl?.classList.add('has-log');
      cmdEl = document.createElement('div');
      cmdEl.className = 'log-line cmd-line enter';
      termEl.appendChild(cmdEl);
      const el = cmdEl;
      requestAnimationFrame(() => el.classList.remove('enter'));
      let i = 0;
      drawCommand(i, true);
      const tick = () => {
        if (!sweepActive) return;
        i++;
        drawCommand(i, true);
        if (i < CMD.length) setTimeout(tick, 26);
        // Beat after the command lands, before anything loads. Caret goes:
        // the command has been issued, it is not still being typed.
        else
          setTimeout(() => {
            drawCommand(i, false);
            done();
          }, 640);
      };
      tick();
    };

  const OPENING_HOLD_MS = 3000; // beat on the first year before the clock runs
  const LINGER_MS = 1600;
    const HOLD_MS = 2600; // sit on the finished map before explaining it
    const NARROW_MS = 2200; // range selector shrinking to its resting width

    // Phase 1 begins: accumulate, and let the camera pull back to hold it all.
    introAccumulate = true;
    introCam = true;
    tl.wrap?.classList.add('tl-enter');

    whenBegun(() => {
      // Revealed here, not when sweepActive was set: the whoami modal is
      // still up until this callback fires, and a skip control behind an
      // inert backdrop is chrome nobody can use yet.
      if (skipBtn && sweepActive) skipBtn.hidden = false;
      typeCommand(() => setTimeout(() => {
      if (!sweepActive) return;
      // The script has run. The first year is the first event, and it is on
      // screen from the opening frame rather than being counted up to.
      introArmed = false;
      const t0ms = performance.now();
      const step = (nowMs: number) => {
        if (!sweepActive) return;
        const elapsed = Math.max(0, nowMs - t0ms);
        // Hold on the very first year before the clock starts moving. The
        // opening dot is the only one that arrives with no prior context, and
        // without a beat here it is on screen and superseded before a reader
        // has registered that anything appeared. Every later dot lands against
        // a map that already means something; this one has to establish it.
        const u = Math.min(1, elapsed / (SWEEP_MS + OPENING_HOLD_MS));
        focus = focusAt(Math.max(0, elapsed - OPENING_HOLD_MS));
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
                // The tour is over, so its exit goes with it. That is the
                // only cleanup the ending needs: the era caption under the
                // watermark keeps narrating at rest, and the command in the
                // header simply stays issued.
                if (skipBtn) skipBtn.hidden = true;
              }
            };
            sweepRaf = requestAnimationFrame(narrow);
          }, 700); // let the selector land before it starts moving
        }, HOLD_MS);
      };
      sweepRaf = requestAnimationFrame(step);
      }, LINGER_MS));
    });
  } else {
    renderTimeline();
    // No sweep to frame the map, and no drift toward a fit either: one
    // constrained jump straight to the transform the intro camera would have
    // eased to. The dt is large enough that the chase term saturates, which is
    // the same code path arriving at its own end state in a single step.
    if (reducedMotion) fitCamera(data.nodes.filter((n) => relevance(n) > 0.05), 1e6);
  }
  const panel = document.getElementById('domain-panel');
  const toggle = document.getElementById('panel-toggle');
  toggle?.addEventListener('click', () => {
    const open = panel!.toggleAttribute('data-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // ---- Node tooltip: follows the cursor while hovering a dot; also pinned
  // to a dot by taps that cannot open a write-up and by keyboard focus on
  // index or start-here links (wired further down).
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
    // Hover is mouse/pen only; on touch a moving finger is a pan. Touch gets
    // the tooltip from the click handler instead, for taps on dots that
    // cannot open a write-up and so would otherwise answer with nothing.
    if (ev.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    hovered = pick(px, py);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    // Same rule the watermark follows a few hundred lines down: ambient
    // context steps back while a dot is being read. Toggled here rather than
    // in the draw loop so it is one class change per hover, not one per frame.
    eraEl?.classList.toggle('is-dimmed', Boolean(hovered));
    if (hovered) showTip(hovered, px, py);
    else tip.hidden = true;
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    eraEl?.classList.remove('is-dimmed');
    tip.hidden = true;
  });
  // A gesture starting is the tip's cue to leave: a pan drags the map out
  // from under it, and on touch this is also what clears a tapped dot's tip
  // when the next touch lands somewhere else. Mouse hover re-shows it on the
  // next pointermove, so nothing is lost there.
  canvas.addEventListener('pointerdown', () => {
    tip.hidden = true;
  });

  // ---- Expanded project: modal overlay, real URL via pushState.
  const modal = document.getElementById('node-modal') as HTMLElement;
  const shell = modal.querySelector('.node-shell') as HTMLElement;
  const frame = document.getElementById('node-frame') as HTMLIFrameElement;
  const closeBtn = modal.querySelector('.node-close') as HTMLButtonElement | null;
  const barPath = document.getElementById('node-bar-path');
  const nodeDialog = createDialog(shell, {
    initialFocus: () => closeBtn,
    onClose: () => closeNode(false),
  });
  // Escape has to work from inside the frame too. The embedded page is its own
  // document, so its keydown events never reach this one; same origin is what
  // makes reaching in the other direction legal.
  frame.addEventListener('load', () => {
    frame.contentDocument?.addEventListener('keydown', (ev) => {
      if ((ev as KeyboardEvent).key === 'Escape') closeNode(false);
    });
  });
  const openNode = (id: string, push: boolean) => {
    frame.src = `/idea/${id}?embed=1`;
    if (barPath) barPath.textContent = `/idea/${id}`;
    // "Project" told a screen reader nothing about which of 95 it had landed
    // in. The dialog and its frame are named after the thing they contain.
    const title = byId.get(id)?.title ?? id;
    shell.setAttribute('aria-label', `${title}, project write-up`);
    frame.title = `${title}, project write-up`;
    modal.hidden = false;
    tip.hidden = true;
    if (push) history.pushState({ node: id }, '', `/idea/${id}`);
    nodeDialog.activate();
  };
  const closeNode = (fromHistory: boolean) => {
    if (modal.hidden) return;
    modal.hidden = true;
    frame.src = 'about:blank';
    // After the modal is hidden, so the trigger is focusable again by the time
    // focus is handed back to it.
    nodeDialog.deactivate();
    if (!fromHistory && history.state?.node) history.back();
  };
  // ---- The index list and the start-here path open nodes through exactly
  // this path.
  //
  // The handler reads the slug back out of the href rather than a data
  // attribute, so the link a crawler follows and the node the click opens
  // cannot drift apart: they are the same string. A modified click (new tab,
  // download, middle button) is left alone, since the href is a real page.
  const openFromLink = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement | null;
    const a = target?.closest?.('a[href^="/idea/"]') as HTMLAnchorElement | null;
    if (!a) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (ev.button !== 0) return;
    const m = a.getAttribute('href')!.match(/^\/idea\/([^/?#]+)/);
    if (!m || !byId.has(m[1])) return;
    ev.preventDefault();
    // Unlike a click on the canvas, which travels to a faded node's era
    // instead of opening it, a click here is an explicit request for the
    // write-up. Travel as well, so closing the modal leaves the dot on screen
    // rather than in an era the map is no longer showing.
    const n = byId.get(m[1])!;
    if (relevance(n) < 0.85 && n.started) travelTo(Date.parse(n.started) + behind * 0.4);
    openNode(m[1], true);
  };
  const indexEl = document.getElementById('map-index');
  const startHereEl = document.getElementById('start-here');
  indexEl?.addEventListener('click', openFromLink);
  startHereEl?.addEventListener('click', openFromLink);

  // Start-here disclosure. The list stays closed at rest: five numbered
  // titles are index content, and the map already has an index. What earns a
  // permanent place on the canvas is the single quiet pointer to the one
  // genuinely ordered path.
  const shToggle = document.getElementById('sh-toggle');
  const shList = document.getElementById('sh-list');
  shToggle?.addEventListener('click', () => {
    if (!shList) return;
    const closed = shList.toggleAttribute('hidden');
    shToggle.setAttribute('aria-expanded', String(!closed));
  });

  // Keyboard route to the tooltip. The canvas is one picture (role=img), so
  // the links in the index and the start-here path are how a keyboard user
  // reaches a node. Focusing one gives it the pointer's treatment: the dot
  // takes the hover ring and the tooltip pins to it, clamped to the viewport
  // when the dot itself is outside the current view.
  const nodeOfLink = (el: EventTarget | null): GraphNode | null => {
    const a = (el as HTMLElement | null)?.closest?.('a[href^="/idea/"]');
    const m = a?.getAttribute('href')?.match(/^\/idea\/([^/?#]+)/);
    return m ? (byId.get(m[1]) ?? null) : null;
  };
  const focusTip = (ev: FocusEvent) => {
    const n = nodeOfLink(ev.target);
    if (!n) return;
    hovered = n;
    eraEl?.classList.add('is-dimmed');
    showTip(
      n,
      Math.max(12, Math.min(width - 12, transform.applyX(n.x ?? 0))),
      Math.max(12, Math.min(height - 12, transform.applyY(n.y ?? 0))),
    );
  };
  const blurTip = () => {
    hovered = null;
    eraEl?.classList.remove('is-dimmed');
    tip.hidden = true;
  };
  for (const host of [indexEl, startHereEl]) {
    host?.addEventListener('focusin', focusTip);
    host?.addEventListener('focusout', blurTip);
  }
  // The embedded page hands its internal links back rather than following
  // them, so the modal's path readout and the browser's history keep
  // describing what is actually on screen. Navigating a node from inside a
  // node is the common case now that satellites link to their parents.
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    const d = ev.data as { brainmap?: string; id?: string } | null;
    if (!d || d.brainmap !== 'open' || typeof d.id !== 'string') return;
    if (!data.nodes.some((n) => n.id === d.id)) return;
    openNode(d.id, true);
  });
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    const n = pick(px, py);
    if (!n) {
      tip.hidden = true;
      return;
    }
    // A faded node from another era travels you back to its time instead of
    // opening; fully-relevant nodes open the write-up. The two branches that
    // do not open show the tooltip: on touch a tap is the only way to reach
    // it at all, and on mouse it is already showing, so the call is idle.
    if (relevance(n) < 0.85 && n.started) {
      showTip(n, px, py);
      travelTo(Date.parse(n.started) + behind * 0.4);
      return;
    }
    if (n.visibility !== 'public') {
      // A stealth dot never opens, so the tooltip's "stays locked" line is
      // the whole answer a tap can get.
      showTip(n, px, py);
      return;
    }
    // A node can be its own dot without being its own essay. Deferring nodes
    // open the parent's write-up, because that is where their story is told.
    const target = n.detail === 'parent' && n.parent ? n.parent : n.id;
    openNode(target, true);
  });
  closeBtn?.addEventListener('click', () => closeNode(false));
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) closeNode(false);
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
          zoomIdentity.translate(viewCX(), viewCY()).scale(1.4).translate(-(n.x ?? 0), -(n.y ?? 0)),
        );
      }
    });
  }

  // Animation state: labels fade in and out (and type in, during the sweep);
  // node visibility and cluster
  // geometry are smoothed so nothing pops or snaps as the era changes.
  const labelAnim = new Map<string, { alpha: number; typed: number; bornAt: number }>();
  // Title widths at a fixed 11px, measured once per node for the label
  // placement pass. Mono glyph advances scale linearly with font size, so the
  // per-frame world-space width is just this divided by the zoom factor.
  const labelWidth = new Map<string, number>();
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
    // Under reduced motion every smoothed value lands on its target in a
    // single frame. The easing is not decoration around the change, it IS the
    // change being animated, so the honest reduction is to remove it rather
    // than to shorten it. What is left is a still picture that redraws when
    // the data behind it actually differs.
    const chase = (ms: number) => (reducedMotion ? 1 : 1 - Math.exp(-dt / ms));

    // Smooth every node's visibility toward its raw relevance: dots grow in
    // and shrink away instead of jumping between eras.
    for (const n of data.nodes) {
      const target = relevance(n);
      const cur = nodeVis.get(n.id) ?? 0;
      const diff = target - cur;
      const step = reducedMotion ? 1 : dt / (diff > 0 ? 300 : 420);
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
    // The era caption is printed directly under it from the same `focus`, and
    // positions itself off wmSize(), so the two stay one caption.
    ctx.font = `600 ${wmSize()}px ${FONT_DATA}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    // The year is ambient context, not content. When a dot is engaged it steps
    // further back so it cannot compete with the thing being read.
    const wmTarget = hovered ? 0.018 : 0.05;
    watermark += (wmTarget - watermark) * chase(180);
    ctx.globalAlpha = watermark;
    ctx.fillText(String(new Date(focus).getUTCFullYear()), viewCX(), viewCY());
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
      if (reducedMotion) ca = target;
      else ca = target ? Math.min(1, ca + dt / 260) : Math.max(0, ca - dt / 380);
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
      const k = chase(300);
      geo.cx += (tx - geo.cx) * k;
      geo.cy += (ty - geo.cy) * k;
      // Growth and shrink are not symmetric. Lagging while growing leaves a dot
      // stranded outside the ring, which is the whole bug this guards against;
      // lagging while shrinking is merely a circle that stays roomy a moment
      // longer. So expand quickly and contract lazily.
      geo.r += (tr - geo.r) * chase(tr > geo.r ? 80 : 420);
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

    // ---- Label placement: greedy, one pass per frame.
    //
    // A label is centred under its own dot with no knowledge of its
    // neighbours, and forceCollide reserves footprint + 11 with nothing for
    // the text, so in a dense cluster the boxes overlap into one smear
    // ("Terraform Pl.Homelab Kubernetes"). Growing the collide radius would
    // fix the text by scattering the dots, and the tight packing IS the
    // clustering. So the layout stands and the labels negotiate instead:
    // measure the box of every label that qualifies this frame, admit them in
    // priority order (the hovered node first, since its label must never
    // lose, then dot size, so the biggest work keeps its name), and skip any
    // box that intersects one already admitted. A skipped label is not lost:
    // it fades back in the moment zoom or motion gives it room.
    const labelOk = new Set<string>();
    {
      type Box = { id: string; x0: number; y0: number; x1: number; y1: number; pri: number };
      const candidates: Box[] = [];
      for (const n of data.nodes) {
        const sv = svOf(n);
        // Birth bookkeeping runs for every node, admitted or not: bornAt
        // marks when the dot first appeared during the sweep, not when its
        // label won a slot.
        const st = labelAnim.get(n.id) ?? { alpha: 0, typed: 0, bornAt: 0 };
        labelAnim.set(n.id, st);
        if (sweepActive && sv > 0.03 && st.bornAt === 0) st.bornAt = t;
        if (!sweepActive && st.bornAt !== 0) st.bornAt = 0;
        if (sv < 0.03 || !matchesFilter(n)) continue;
        // Label hierarchy: flagships and the hovered node at rest; everything
        // when zoomed in. During the intro sweep, ideas being born near the
        // focus year announce themselves so the tour reads as a story, each
        // holding ~2.6s before fading.
        const birthLabel = sweepActive && st.bornAt > 0 && t - st.bornAt < 2600;
        const isActive = hovered === n;
        // Satellites label on hover and on deep zoom only.
        //
        // They are packed at roughly a third of the ambient node spacing,
        // which is what makes a system read as one object, but their labels
        // are full width horizontal text. Twelve of them inside one ring is a
        // solid block of overlapping words that hides the parent's own label
        // underneath it.
        //
        // The grouping is the information at this scale: a reader should see
        // one system with a dozen members and reach for a specific member on
        // purpose, via hover or by zooming into it. Naming all twelve
        // unprompted answers a question nobody asked and destroys the thing
        // it is labelling.
        const labelWorthy = isChild(n)
          ? isActive || transform.k >= 2.6
          : isActive || (n.scale ?? 2) >= 4 || transform.k >= 1.2 || birthLabel;
        if (!labelWorthy) continue;
        let w = labelWidth.get(n.id);
        if (w === undefined) {
          ctx.font = `11px ${FONT_DATA}`;
          w = ctx.measureText(n.title).width;
          labelWidth.set(n.id, w);
        }
        const k = transform.k;
        // Same geometry the draw below uses: centred, hung under the dot at
        // its current (era-scaled) radius, 11px type. The box gets a small
        // pad so admitted neighbours do not sit flush letter-to-letter.
        const r = radiusOf(n) * (0.45 + 0.55 * sv);
        const half = w / k / 2 + 2 / k;
        const ly = (n.y ?? 0) + r + 14 / k;
        candidates.push({
          id: n.id,
          x0: (n.x ?? 0) - half,
          y0: ly - 11 / k,
          x1: (n.x ?? 0) + half,
          y1: ly + 3 / k,
          pri: (isActive ? 1000 : 0) + radiusOf(n),
        });
      }
      // The id tie-break keeps equal-radius neighbours in a stable order, so
      // which of two colliding labels yields cannot flicker between frames.
      candidates.sort((a, b) => b.pri - a.pri || (a.id < b.id ? -1 : 1));
      const placed: Box[] = [];
      for (const c of candidates) {
        if (placed.some((p) => c.x0 < p.x1 && c.x1 > p.x0 && c.y0 < p.y1 && c.y1 > p.y0)) {
          continue;
        }
        placed.push(c);
        labelOk.add(c.id);
      }
    }

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

      // Employer work carries a briefcase. Drawn as paths rather than an emoji
      // or an icon font: it has to stay crisp through the full zoom range and
      // must not depend on a glyph the visitor's system may not have.
      //
      // It appears the moment the sweep reaches the first professional role and
      // never before, which is the point. Whether a thing was built for an
      // employer or for himself is the single fact most likely to be misread
      // on a portfolio, and the map otherwise draws them identically.
      if (n.org && n.visibility === 'public') {
        // Cut out of the dot itself rather than badged onto its shoulder. A
        // badge adds a second object to track at every node and collides with
        // neighbours in a dense cluster; a knockout changes the dot's own
        // texture, so employer work reads as a different KIND of dot instead
        // of a dot wearing a sticker.
        //
        // Drawn as paths, not an emoji, so it stays crisp across the zoom
        // range and depends on no font the visitor may lack.
        const w = r * 0.92; // case width
        const h = r * 0.62; // case height
        const cut = n.status === 'idea' ? color : GROUND;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = cut;
        ctx.strokeStyle = cut;
        ctx.lineWidth = Math.max(0.5, Math.min(1.1, r * 0.11));
        // handle, sitting on the lid
        ctx.beginPath();
        ctx.moveTo(x - w * 0.2, y - h * 0.42);
        ctx.lineTo(x - w * 0.2, y - h * 0.78);
        ctx.lineTo(x + w * 0.2, y - h * 0.78);
        ctx.lineTo(x + w * 0.2, y - h * 0.42);
        ctx.stroke();
        // case body
        ctx.fillRect(x - w * 0.5, y - h * 0.42, w, h);
        // clasp: a sliver of the dot's own colour back through the middle, so
        // the shape reads as a case rather than a plain rectangle
        ctx.fillStyle = n.status === 'idea' ? GROUND : color;
        ctx.fillRect(x - w * 0.09, y - h * 0.42, w * 0.18, h * 0.42);
      }

      // Which labels get drawn is decided by the placement pass above; here
      // the label only animates toward that verdict, so one denied a slot
      // fades out rather than vanishing. The pass seeded every node's state,
      // hence the bare get.
      const st = labelAnim.get(n.id)!;
      const zoomAlpha = Math.max(0, Math.min(1, (transform.k - 0.45) / 0.35));
      const wanted = labelOk.has(n.id);
      if (wanted) {
        st.alpha = reducedMotion ? 1 : Math.min(1, st.alpha + dt / 150);
        // The type-in is the sweep's narration: during the tour each dot is
        // born alone, and its name typing out reads as an event. Everywhere
        // else the label arrives whole, because the trigger at rest is the
        // zoom threshold, which crosses on ~60 labels in the same frame, and
        // sixty simultaneous type-ins read as noise rather than narration.
        // The 150ms alpha fade above is the whole entrance.
        st.typed =
          reducedMotion || !sweepActive
            ? n.title.length
            : Math.min(n.title.length, st.typed + dt / 26);
      } else {
        st.alpha = reducedMotion ? 0 : Math.max(0, st.alpha - dt / 380);
        if (st.alpha === 0) st.typed = 0;
      }

      if (st.alpha > 0.02 && zoomAlpha > 0.02) {
        const typing = wanted && st.typed < n.title.length;
        const shown = wanted ? n.title.slice(0, Math.ceil(st.typed)) : n.title;
        const label = typing ? `${shown}_` : shown;
        // sqrt(sv): the label brightens ahead of the still-growing newborn
        // dot so the type-in is legible from its first character.
        //
        // baseAlpha is deliberately not a factor. It carries the status
        // dimming (retired sits at 0.38) and the building pulse, and both of
        // those belong to the dot rather than to its name. A dot at 38%
        // opacity still reads as a dot; the same 38% took a label from 7.9:1
        // contrast against the ground down to 2.2:1, which is not a dimmer
        // label but an unreadable one, and most of the map is retired. Status
        // already has a treatment of its own (hollow, solid, dimmed, pulsing),
        // so spending the label's legibility to encode it a second time buys
        // nothing. Era and zoom still fade the label, because those decide
        // whether it belongs on screen at all.
        const la = (visible ? Math.sqrt(sv) : 0.07) * zoomAlpha * st.alpha;
        const lx = x;
        const ly = y + r + 14 / transform.k;
        ctx.font = `${11 / transform.k}px ${FONT_DATA}`;
        ctx.textAlign = 'center';

        // Halo. A label is drawn semi-transparent, so without this the dashed
        // edges and cluster rings behind it composite THROUGH the letterforms
        // and read as a strikethrough. Knocking the ground out from under the
        // glyphs is the fix; drawing the label opaque instead would flatten
        // the depth cue that dims distant eras.
        // Kept more opaque than the text, and ramped steeply, so that it has
        // already saturated by the time the label is faint enough to need it.
        // Scaling the halo in step with the label was self-defeating: the
        // protection thinned out at exactly the alpha where the edges began
        // showing through the glyphs.
        ctx.globalAlpha = Math.min(1, la * 3);
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
