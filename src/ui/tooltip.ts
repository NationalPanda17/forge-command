// Themed tooltips for every element with a `title`, in place of the browser's own yellow box.
//
// On mouse hover the title is moved aside (so the native tooltip does not also appear) and shown in a styled box
// after a short delay; it is put back when the pointer leaves. Keyboard focus and screen readers still get the plain
// title, because nothing changes unless a mouse is over the element. SVG titles on the map are left alone.

const DELAY_MS = 380;
const GAP = 8;

/** Starts themed tooltips for the whole page. Returns a function that stops them. */
export function installTooltips(doc: Document = document): () => void {
  let tip: HTMLDivElement | null = null;
  let owner: HTMLElement | null = null;
  let timer = 0;

  const hide = () => {
    window.clearTimeout(timer);
    tip?.remove();
    tip = null;
    if (owner) {
      const t = owner.getAttribute('data-fc-title');
      if (t !== null && !owner.hasAttribute('title')) owner.setAttribute('title', t);
      owner.removeAttribute('data-fc-title');
      owner = null;
    }
  };

  const place = (el: HTMLElement, box: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Below the element if it fits, otherwise above; kept inside the window.
    let top = r.bottom + GAP;
    if (top + h > vh - 4) top = Math.max(4, r.top - GAP - h);
    const left = Math.min(Math.max(4, r.left + r.width / 2 - w / 2), vw - w - 4);
    box.style.top = `${top}px`;
    box.style.left = `${left}px`;
  };

  const onOver = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target || !(target instanceof Element) || target.closest('svg')) return;
    const el = target.closest<HTMLElement>('[title], [data-fc-title]');
    if (el === owner) return;
    hide();
    if (!el) return;
    const text = el.getAttribute('title');
    if (!text) return;
    owner = el;
    el.setAttribute('data-fc-title', text);
    el.removeAttribute('title');
    timer = window.setTimeout(() => {
      if (owner !== el || !el.isConnected) return;
      tip = doc.createElement('div');
      tip.className = 'fc-tip';
      tip.setAttribute('aria-hidden', 'true');
      tip.textContent = text;
      doc.body.appendChild(tip);
      place(el, tip);
    }, DELAY_MS);
  };

  const onOut = (e: MouseEvent) => {
    if (!owner) return;
    const to = e.relatedTarget as Node | null;
    if (to && owner.contains(to)) return;
    hide();
  };

  doc.addEventListener('mouseover', onOver);
  doc.addEventListener('mouseout', onOut);
  doc.addEventListener('mousedown', hide, true);
  doc.addEventListener('keydown', hide, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
  return () => {
    hide();
    doc.removeEventListener('mouseover', onOver);
    doc.removeEventListener('mouseout', onOut);
    doc.removeEventListener('mousedown', hide, true);
    doc.removeEventListener('keydown', hide, true);
    window.removeEventListener('scroll', hide, true);
    window.removeEventListener('blur', hide);
  };
}
