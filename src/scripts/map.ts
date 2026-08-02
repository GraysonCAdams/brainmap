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
  started?: string;
  ended?: string | null;
  repo?: string | null;
  tech?: string[];
  scale?: number;
  freshness?: number;
}
type GraphEdge = SimulationLinkDatum<GraphNode>;

const root = document.getElementById('map-root');
if (root) init(root).catch((err) => {
  root.textContent = 'The map failed to load. Everything on it is in /bio.';
  console.error(err);
});

async function init(root: HTMLElement) {
  const res = await fetch('/graph.json');
  if (!res.ok) throw new Error(`graph.json ${res.status}`);
  const data: { nodes: GraphNode[]; edges: { source: string; target: string }[] } =
    await res.json();

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
    centroid.set(d, { x: Math.cos(angle) * 240, y: Math.sin(angle) * 150 });
  });

  // Size = scale (1-5). Teasers stay small regardless.
  const radiusOf = (n: GraphNode) =>
    n.visibility === 'teaser' ? 5 : 5.5 + (n.scale ?? 2) * 2;

  // Tight round clumps: strong centroid gravity + modest repulsion means the
  // members themselves form the circle the boundary traces.
  const edges: GraphEdge[] = data.edges.map((e) => ({ ...e }));
  const sim = forceSimulation(data.nodes)
    .force('link', forceLink<GraphNode, GraphEdge>(edges).id((n) => n.id).distance(60).strength(0.25))
    .force('charge', forceManyBody().strength(-90))
    .force('collide', forceCollide<GraphNode>((n) => radiusOf(n) + 11))
    .force('x', forceX<GraphNode>((n) => centroid.get(n.domain)?.x ?? 0).strength(0.24))
    .force('y', forceY<GraphNode>((n) => centroid.get(n.domain)?.y ?? 0).strength(0.24))
    // cluster de-overlap: treat each domain as a circle (same geometry the
    // boundary draws) and push whole clusters apart when circles collide
    .force('declump', (alpha: number) => {
      const BOUNDARY_PAD = 22;
      const GAP = 14;
      const clusters = domains
        .map((d) => {
          const members = data.nodes.filter((n) => n.domain === d);
          if (members.length === 0) return null;
          const cx = members.reduce((s, n) => s + (n.x ?? 0), 0) / members.length;
          const cy = members.reduce((s, n) => s + (n.y ?? 0), 0) / members.length;
          const r =
            Math.max(
              ...members.map((n) => Math.hypot((n.x ?? 0) - cx, (n.y ?? 0) - cy) + radiusOf(n)),
            ) + BOUNDARY_PAD;
          return { members, cx, cy, r };
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

  let transform: ZoomTransform = zoomIdentity.translate(width / 2, height / 2);
  const zoomer = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.35, 3.5])
    .on('zoom', (ev) => {
      transform = ev.transform;
    })
    .on('start', () => (canvas.style.cursor = 'grabbing'))
    .on('end', () => (canvas.style.cursor = 'grab'));
  const sel = select(canvas);
  sel.call(zoomer);
  sel.call(zoomer.transform, transform);

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
    // Padding leaves room for labels, which hang below their dot.
    const pad = 90;
    const w = Math.max(1, maxX - minX + pad * 2);
    const h = Math.max(1, maxY - minY + pad * 2);
    const k = Math.max(0.35, Math.min(1.6, Math.min(width / w, height / h)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Critically damped chase: no overshoot, frame-rate independent.
    const s = 1 - Math.exp(-dt / 420);
    const nk = transform.k + (k - transform.k) * s;
    const nx = transform.x + (width / 2 - cx * nk - transform.x) * s;
    const ny = transform.y + (height / 2 - cy * nk - transform.y) * s;
    transform = zoomIdentity.translate(nx, ny).scale(nk);
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
  const T0 = Date.UTC(2000, 0, 1); // when he started coding
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
  for (let y = 2000; y <= new Date(NOW).getUTCFullYear(); y += 5) {
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
    renderTimeline();
  };
  // The tour only starts once the whoami modal is gone; running it behind the
  // backdrop wastes it on the exact visitor it exists for.
  const whenBegun = (fn: () => void) => {
    if ((window as unknown as { brainmapBegin?: boolean }).brainmapBegin) fn();
    else addEventListener('brainmap:begin', fn, { once: true });
  };

  if (!reducedMotion && !location.hash) {
    const starts = [...startMsOf.values()].sort((a, b) => a - b);
    const first = starts[0] ?? T0;
    focus = first; // open ON the first dot, not on empty January 2000
    renderTimeline();
    sweepActive = true;

    // Density-weighted progress curve: wall-clock spent near time t grows
    // with how many ideas start near t.
    const SAMPLES = 240;
    const weights: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t = first + ((NOW - first) * i) / (SAMPLES - 1);
      const near = starts.filter((s) => Math.abs(s - t) < 1.5 * YEAR).length;
      weights.push(1 + near * 1.6);
    }
    const cum: number[] = [0];
    for (let i = 1; i < SAMPLES; i++) cum.push(cum[i - 1] + (weights[i - 1] + weights[i]) / 2);
    const total = cum[SAMPLES - 1];
    const timeAtU = (u: number) => {
      const target = u * total;
      let i = 1;
      while (i < SAMPLES - 1 && cum[i] < target) i++;
      const seg = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const frac = (i - 1 + seg) / (SAMPLES - 1);
      return first + (NOW - first) * frac;
    };

    const LINGER_MS = 1600;
    const SWEEP_MS = 18400; // ~20s tour total, distributed by idea density
    const HOLD_MS = 2600; // sit on the finished map before explaining it
    const NARROW_MS = 2200; // range selector shrinking to its resting width

    // Phase 1 begins: accumulate, and let the camera pull back to hold it all.
    introAccumulate = true;
    introCam = true;
    tl.wrap?.classList.add('tl-enter');

    whenBegun(() => setTimeout(() => {
      if (!sweepActive) return;
      const t0ms = performance.now();
      const step = (nowMs: number) => {
        if (!sweepActive) return;
        const u = Math.max(0, Math.min(1, (nowMs - t0ms) / SWEEP_MS));
        focus = timeAtU(u);
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
              }
            };
            sweepRaf = requestAnimationFrame(narrow);
          }, 700); // let the selector land before it starts moving
        }, HOLD_MS);
      };
      sweepRaf = requestAnimationFrame(step);
    }, LINGER_MS));
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
  const tipTitle = tip.querySelector('.tip-title') as HTMLElement;
  const tipText = tip.querySelector('.tip-text') as HTMLElement;
  const tipTech = tip.querySelector('.tip-tech') as HTMLElement;
  const showTip = (n: GraphNode, px: number, py: number) => {
    tipTitle.textContent = n.title;
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
    if (n.visibility === 'public') openNode(n.id, true);
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
    ctx.globalAlpha = 0.05;
    ctx.fillText(String(new Date(focus).getUTCFullYear()), width / 2, height / 2);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // cluster boundaries: enclosing CIRCLE per domain (2+ visible members),
    // label breaking the stroke at the top like a fieldset legend.
    // Boundaries fade in/out instead of popping as eras change.
    for (const d of domains) {
      const members = data.nodes.filter(
        (n) => n.domain === d && matchesFilter(n) && svOf(n) > 0.4,
      );
      const target = members.length >= 2 ? 1 : 0;
      let ca = clusterAlpha.get(d) ?? 0;
      ca = target ? Math.min(1, ca + dt / 260) : Math.max(0, ca - dt / 380);
      clusterAlpha.set(d, ca);
      if (ca < 0.02 || members.length === 0) continue;
      const tx = members.reduce((s, n) => s + (n.x ?? 0), 0) / members.length;
      const ty = members.reduce((s, n) => s + (n.y ?? 0), 0) / members.length;
      const tr =
        Math.max(...members.map((n) => Math.hypot((n.x ?? 0) - tx, (n.y ?? 0) - ty) + radiusOf(n))) +
        22;
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
      geo.r += (tr - geo.r) * k;
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
      const text = d.toUpperCase();
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

    // edges: dashed threads
    ctx.lineWidth = 1 / transform.k;
    ctx.setLineDash([2 / transform.k, 4 / transform.k]);
    for (const e of edges) {
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
