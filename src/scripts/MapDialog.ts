/**
 * Modal behaviour shared by the map's two overlays: the whoami intro and the
 * expanded node.
 *
 * They are absolutely-positioned divs inside <main> rather than <dialog>
 * elements, because <dialog>.showModal() promotes the element to the top layer
 * and its ::backdrop covers the whole viewport including the header. These two
 * are meant to sit over the map area only. That styling choice is what makes
 * the rest of this file necessary: a top-layer dialog gets focus containment,
 * inertness and Escape from the browser, and a plain div gets none of it.
 *
 * What this provides: focus moved in on open and returned to whatever opened
 * the dialog on close (WCAG 2.4.3), everything outside the dialog made inert
 * so neither Tab nor a screen reader's virtual cursor can reach it (WCAG 2.4.3
 * and 1.3.2), Tab wrapped at both ends of the dialog, and Escape closing it
 * (WCAG 2.1.2, no keyboard trap).
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Rendered and focusable, in document order. */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * Make everything outside `root` inert, walking up to <body> so siblings at
 * every level are covered, not just the dialog's immediate neighbours.
 *
 * An element that is already inert is left alone and not recorded, so an inner
 * dialog opening over an outer one cannot un-inert the page when it closes.
 */
function inertOutside(root: HTMLElement): HTMLElement[] {
  const touched: HTMLElement[] = [];
  let node: HTMLElement | null = root;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const child of Array.from(parent.children)) {
      if (child === node) continue;
      const el = child as HTMLElement;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.inert) continue;
      el.inert = true;
      touched.push(el);
    }
    node = parent;
  }
  return touched;
}

export interface MapDialog {
  /** Call after the dialog has been made visible. */
  activate(): void;
  /** Call before or after hiding it; focus goes back to whatever opened it. */
  deactivate(): void;
  readonly active: boolean;
}

export function createDialog(
  root: HTMLElement,
  opts: {
    /** What should hold focus when the dialog opens. */
    initialFocus: () => HTMLElement | null;
    /** Escape, a click on the backdrop, or the close control. */
    onClose: () => void;
  },
): MapDialog {
  let active = false;
  let returnTo: HTMLElement | null = null;
  let inerted: HTMLElement[] = [];

  const onKeydown = (ev: KeyboardEvent) => {
    if (!active) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      opts.onClose();
      return;
    }
    if (ev.key !== 'Tab') return;
    const items = focusables(root);
    if (items.length === 0) {
      ev.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const here = document.activeElement as HTMLElement | null;
    if (ev.shiftKey && (here === first || !root.contains(here))) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && here === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  // Backstop for focus that arrives from somewhere this file cannot see a key
  // event for: an iframe inside the dialog is its own focus scope, so tabbing
  // out of its last control is handled by the browser, not by onKeydown.
  const onFocusIn = (ev: FocusEvent) => {
    if (!active) return;
    const target = ev.target as Node | null;
    if (target && root.contains(target)) return;
    const items = focusables(root);
    (items[0] ?? root).focus();
  };

  return {
    get active() {
      return active;
    },
    activate() {
      if (active) return;
      active = true;
      const here = document.activeElement;
      returnTo = here instanceof HTMLElement && here !== document.body ? here : null;
      inerted = inertOutside(root);
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('focusin', onFocusIn, true);
      (opts.initialFocus() ?? focusables(root)[0] ?? root).focus();
    },
    deactivate() {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      for (const el of inerted) el.inert = false;
      inerted = [];
      // isConnected, because the trigger may have been a link in a list the
      // script re-rendered while the dialog was open.
      if (returnTo?.isConnected) returnTo.focus();
      returnTo = null;
    },
  };
}
