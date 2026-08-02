/**
 * The map: d3-force simulation + hand-rolled canvas renderer.
 *
 * Encoding contract (DESIGN.md + dataviz pass):
 *   hue = domain lamp (validated palette), treatment = status
 *   idea = hollow ring, building = breathing, shipped = solid + glow,
 *   retired = dimmed, teaser = dashed gray ring (locked).
 * Titles are always drawn: identity is never color-alone.
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
  visibility: 'public' | 'teaser';
  started?: string;
  repo?: string | null;
  tech?: string[];
  /** 0..1 repo activity, filled by build-time enrichment when present */
  freshness?: number;
}
type GraphEdge = SimulationLinkDatum<GraphNode>;

const root = document.getElementById('map-root');
if (root) init(root).catch((err) => {
  root.textContent = 'The map failed to load. The log lists everything: /';
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
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');

  const card = document.getElementById('map-card') as HTMLElement;

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

  // Domain clusters: centroids on an ellipse around the origin, assigned in
  // the palette's fixed domain order so cluster positions are stable.
  const domains = [...new Set(data.nodes.map((n) => n.domain))];
  const centroid = new Map<string, { x: number; y: number }>();
  domains.forEach((d, i) => {
    const angle = (i / domains.length) * Math.PI * 2 - Math.PI / 2;
    centroid.set(d, { x: Math.cos(angle) * 190, y: Math.sin(angle) * 120 });
  });

  const radiusOf = (n: GraphNode) =>
    n.visibility === 'teaser' ? 5 : n.status === 'shipped' ? 8 : 6.5;

  const edges: GraphEdge[] = data.edges.map((e) => ({ ...e }));
  const sim = forceSimulation(data.nodes)
    .force('link', forceLink<GraphNode, GraphEdge>(edges).id((n) => n.id).distance(70).strength(0.5))
    .force('charge', forceManyBody().strength(-160))
    .force('collide', forceCollide<GraphNode>((n) => radiusOf(n) + 16))
    .force('x', forceX<GraphNode>((n) => centroid.get(n.domain)?.x ?? 0).strength(0.08))
    .force('y', forceY<GraphNode>((n) => centroid.get(n.domain)?.y ?? 0).strength(0.08));

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
  let selected: GraphNode | null = null;

  // Domain filtering: a node matches its primary domain and every tag.
  const activeDomains = new Set<string>();
  const matchesFilter = (n: GraphNode) =>
    activeDomains.size === 0 ||
    activeDomains.has(n.domain) ||
    (n.tags ?? []).some((t) => activeDomains.has(t));
  const panel = document.getElementById('domain-panel');
  panel?.querySelectorAll<HTMLButtonElement>('[data-domain-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.domainFilter!;
      const on = !activeDomains.has(d);
      if (on) activeDomains.add(d);
      else activeDomains.delete(d);
      btn.setAttribute('aria-pressed', String(on));
    });
  });
  const toggle = document.getElementById('panel-toggle');
  toggle?.addEventListener('click', () => {
    const open = panel!.toggleAttribute('data-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  const pick = (px: number, py: number): GraphNode | null => {
    const [x, y] = transform.invert([px, py]);
    let best: GraphNode | null = null;
    let bestD = Infinity;
    for (const n of data.nodes) {
      if (!matchesFilter(n)) continue; // filtered-out nodes aren't clickable
      const dx = (n.x ?? 0) - x;
      const dy = (n.y ?? 0) - y;
      const d = Math.hypot(dx, dy);
      // generous hit target: mark radius + 10 world units
      if (d < radiusOf(n) + 10 && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  canvas.addEventListener('pointermove', (ev) => {
    const r = canvas.getBoundingClientRect();
    hovered = pick(ev.clientX - r.left, ev.clientY - r.top);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  });
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const n = pick(ev.clientX - r.left, ev.clientY - r.top);
    setSelected(n);
  });

  function setSelected(n: GraphNode | null) {
    selected = n;
    if (!n) {
      card.hidden = true;
      history.replaceState(null, '', location.pathname);
      return;
    }
    (card.querySelector('.card-title') as HTMLElement).textContent = n.title;
    (card.querySelector('.card-tagline') as HTMLElement).textContent = n.tagline;
    const meta = card.querySelector('.card-meta') as HTMLElement;
    meta.textContent =
      n.visibility === 'teaser'
        ? 'in stealth'
        : [n.status, n.domain, n.started, ...(n.repo ? [n.repo] : [])].join(' · ');
    (meta as HTMLElement).style.color = '';
    const link = card.querySelector('.card-link') as HTMLAnchorElement;
    if (n.visibility === 'teaser') {
      link.hidden = true;
    } else {
      link.hidden = false;
      link.href = `/idea/${n.id}`;
    }
    card.style.setProperty('--lamp', lamp(n.domain));
    card.hidden = false;
    history.replaceState(null, '', `#${n.id}`);
  }

  // Deep link: /map#slug selects and centers that node once positions settle.
  const wanted = location.hash.slice(1);
  if (wanted) {
    sim.on('end.deeplink', () => {
      const n = data.nodes.find((x) => x.id === wanted);
      if (n) {
        setSelected(n);
        sel.transition?.();
        sel.call(
          zoomer.transform,
          zoomIdentity.translate(width / 2, height / 2).scale(1.4).translate(-(n.x ?? 0), -(n.y ?? 0)),
        );
      }
    });
  }

  const label = (n: GraphNode) => (n.visibility === 'teaser' ? n.title : n.title);

  let raf = 0;
  const draw = (t: number) => {
    raf = requestAnimationFrame(draw);
    if (document.hidden) return;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // edges: dashed threads, brighter when touching hover/selection
    ctx.lineWidth = 1 / transform.k;
    ctx.setLineDash([2 / transform.k, 4 / transform.k]);
    for (const e of edges) {
      const s = e.source as GraphNode;
      const g = e.target as GraphNode;
      const active = hovered === s || hovered === g || selected === s || selected === g;
      const filtered = !matchesFilter(s) || !matchesFilter(g);
      ctx.strokeStyle = active ? INK_DIM : INK_FAINT;
      ctx.globalAlpha = filtered ? 0.06 : active ? 0.9 : 0.45;
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(g.x ?? 0, g.y ?? 0);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const n of data.nodes) {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const r = radiusOf(n);
      const color = n.visibility === 'teaser' ? INK_FAINT : lamp(n.domain);
      const isActive = hovered === n || selected === n;

      const visible = matchesFilter(n);
      let alpha = 1;
      if (n.status === 'retired') alpha = RETIRED_DIM;
      if (n.status === 'building' && !reducedMotion) {
        alpha = 0.62 + 0.38 * Math.sin(t / 700 + (n.index ?? 0));
      }
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
        ctx.fillText(label(n), x, y + r + 14 / transform.k);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
  raf = requestAnimationFrame(draw);

  // Keep the page light when navigating away in a persisted bfcache world.
  addEventListener('pagehide', () => cancelAnimationFrame(raf));

  const closeBtn = card.querySelector('.card-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => setSelected(null));
  addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') setSelected(null);
  });
}
