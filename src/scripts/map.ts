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

  const edges: GraphEdge[] = data.edges.map((e) => ({ ...e }));
  const sim = forceSimulation(data.nodes)
    .force('link', forceLink<GraphNode, GraphEdge>(edges).id((n) => n.id).distance(80).strength(0.4))
    .force('charge', forceManyBody().strength(-170))
    .force('collide', forceCollide<GraphNode>((n) => radiusOf(n) + 17))
    .force('x', forceX<GraphNode>((n) => centroid.get(n.domain)?.x ?? 0).strength(0.16))
    .force('y', forceY<GraphNode>((n) => centroid.get(n.domain)?.y ?? 0).strength(0.16));

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
  const DEFAULT_BEHIND = 7 * YEAR;
  const DEFAULT_AHEAD = 1 * YEAR;
  const FADE_YEARS = 6; // relevance decays to zero this many years past the window
  let focus = NOW;
  let behind = DEFAULT_BEHIND;
  let ahead = DEFAULT_AHEAD;

  const spanOf = (n: GraphNode): [number, number] => {
    if (!n.started) return [T0, NOW]; // teasers: timeless presence
    const start = Date.parse(n.started);
    const end = n.ended
      ? Date.parse(n.ended)
      : n.status === 'retired'
        ? Math.min(start + 2 * YEAR, NOW)
        : NOW;
    return [start, end];
  };
  const relevance = (n: GraphNode): number => {
    const [start, end] = spanOf(n);
    const wStart = focus - behind;
    const wEnd = focus + ahead;
    if (start <= wEnd && end >= wStart) return 1;
    const distMs = start > wEnd ? start - wEnd : wStart - end;
    return Math.max(0, 1 - distMs / YEAR / FADE_YEARS);
  };
  const HIDE_BELOW = 0.12;

  // Timeline DOM
  const tl = {
    track: document.getElementById('tl-track') as HTMLElement,
    ticks: document.getElementById('tl-ticks') as HTMLElement,
    region: document.getElementById('tl-region') as HTMLElement,
    edgeL: document.getElementById('tl-edge-l') as HTMLElement,
    edgeR: document.getElementById('tl-edge-r') as HTMLElement,
    handle: document.getElementById('tl-handle') as HTMLElement,
    readout: document.getElementById('tl-readout') as HTMLElement,
    reset: document.getElementById('tl-reset') as HTMLElement,
  };
  const pct = (t: number) => ((t - T0) / (NOW - T0)) * 100;
  const fromPct = (p: number) => T0 + (Math.min(1, Math.max(0, p)) * (NOW - T0));
  const renderTimeline = () => {
    tl.handle.style.left = `${pct(focus)}%`;
    const l = Math.max(0, pct(focus - behind));
    const r = Math.min(100, pct(focus + ahead));
    tl.region.style.left = `${l}%`;
    tl.region.style.width = `${Math.max(0, r - l)}%`;
    const y = new Date(focus).getUTCFullYear();
    tl.readout.textContent = focus > NOW - 30 * 86400000 ? 'now' : String(y);
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
    label.textContent = String(y);
    tl.ticks.appendChild(label);
  }
  const trackX = (ev: PointerEvent) => {
    const r = tl.track.getBoundingClientRect();
    return (ev.clientX - r.left) / r.width;
  };
  const dragTarget = { current: null as null | 'handle' | 'edgeL' | 'edgeR' };
  const startDrag = (which: typeof dragTarget.current) => (ev: PointerEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    // keep receiving moves even when the finger wanders off the element
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    dragTarget.current = which;
  };
  tl.handle.addEventListener('pointerdown', startDrag('handle'));
  tl.edgeL.addEventListener('pointerdown', startDrag('edgeL'));
  tl.edgeR.addEventListener('pointerdown', startDrag('edgeR'));
  addEventListener('pointermove', (ev) => {
    if (!dragTarget.current) return;
    const t = fromPct(trackX(ev));
    if (dragTarget.current === 'handle') focus = Math.min(NOW, t);
    else if (dragTarget.current === 'edgeL') behind = Math.max(0.5 * YEAR, focus - t);
    else ahead = Math.max(0.25 * YEAR, t - focus);
    renderTimeline();
  });
  addEventListener('pointerup', () => (dragTarget.current = null));
  tl.track.addEventListener('pointerdown', (ev) => {
    if (ev.target !== tl.track && ev.target !== tl.ticks) return;
    focus = Math.min(NOW, fromPct(trackX(ev)));
    dragTarget.current = 'handle';
    renderTimeline();
  });
  tl.reset.addEventListener('click', () => {
    focus = NOW;
    behind = DEFAULT_BEHIND;
    ahead = DEFAULT_AHEAD;
    renderTimeline();
  });

  // Smooth travel used by boundary-node clicks and the intro sweep.
  let travelRaf = 0;
  const travelTo = (target: number, ms = 700) => {
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

  // Intro: sweep from the beginning of the record to today.
  if (!reducedMotion && !location.hash) {
    focus = T0;
    renderTimeline();
    setTimeout(() => travelTo(NOW, 4500), 900);
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
  const openNode = (id: string, push: boolean) => {
    frame.src = `/idea/${id}?embed=1`;
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

  let raf = 0;
  const draw = (t: number) => {
    raf = requestAnimationFrame(draw);
    if (document.hidden) return;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // cluster labels: live centroid of each domain's nodes, painted behind
    ctx.textAlign = 'center';
    for (const d of domains) {
      const members = data.nodes.filter((n) => n.domain === d);
      if (members.length === 0) continue;
      const cx = members.reduce((s, n) => s + (n.x ?? 0), 0) / members.length;
      const cy = members.reduce((s, n) => s + (n.y ?? 0), 0) / members.length;
      ctx.font = `600 ${13 / transform.k}px ${FONT_DATA}`;
      ctx.fillStyle = lamp(d);
      ctx.globalAlpha = 0.28;
      ctx.fillText(d.toUpperCase(), cx, cy - 34 / transform.k);
    }
    ctx.globalAlpha = 1;

    // edges: dashed threads
    ctx.lineWidth = 1 / transform.k;
    ctx.setLineDash([2 / transform.k, 4 / transform.k]);
    for (const e of edges) {
      const s = e.source as GraphNode;
      const g = e.target as GraphNode;
      const relEdge = Math.min(relevance(s), relevance(g));
      if (relEdge < HIDE_BELOW) continue;
      const active = hovered === s || hovered === g;
      const filtered = !matchesFilter(s) || !matchesFilter(g);
      ctx.strokeStyle = active ? INK_DIM : INK_FAINT;
      ctx.globalAlpha = (filtered ? 0.06 : active ? 0.9 : 0.45) * relEdge;
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(g.x ?? 0, g.y ?? 0);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const n of data.nodes) {
      const rel = relevance(n);
      if (rel < HIDE_BELOW) continue; // fully out of this era
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      // out-of-era nodes shrink toward the boundary before disappearing
      const r = radiusOf(n) * (0.55 + 0.45 * rel);
      const color = n.visibility === 'teaser' ? INK_FAINT : lamp(n.domain);
      const isActive = hovered === n;

      const visible = matchesFilter(n);
      let alpha = 1;
      if (n.status === 'retired') alpha = RETIRED_DIM;
      if (n.status === 'building' && !reducedMotion) {
        alpha = 0.62 + 0.38 * Math.sin(t / 700 + (n.index ?? 0));
      }
      alpha *= 0.25 + 0.75 * rel;
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

      // labels: always present (identity never color-alone), fading at far zoom
      const labelAlpha = Math.max(0, Math.min(1, (transform.k - 0.45) / 0.35));
      if (labelAlpha > 0.02 && visible) {
        ctx.globalAlpha = alpha * labelAlpha;
        ctx.font = `${11 / transform.k}px ${FONT_DATA}`;
        ctx.fillStyle = isActive ? INK : INK_DIM;
        ctx.textAlign = 'center';
        ctx.fillText(n.title, x, y + r + 14 / transform.k);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
  raf = requestAnimationFrame(draw);

  addEventListener('pagehide', () => cancelAnimationFrame(raf));
}
