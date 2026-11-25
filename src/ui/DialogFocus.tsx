import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Put inside a modal dialog, next to its heading. While the dialog is open: focus moves to the heading, Tab stays
 * inside the dialog, and the game behind it is inert (not clickable, not reachable by Tab or a screen reader). When it
 * closes, focus goes back to where it was.
 */
export function DialogFocus({ labelledBy }: { labelledBy: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const dialog = marker.current?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const before = document.activeElement as HTMLElement | null;
    const heading = document.getElementById(labelledBy);
    const target = heading ?? dialog;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });

    // Everything beside the dialog goes inert while it is open.
    const made: HTMLElement[] = [];
    for (const el of Array.from(dialog.parentElement?.children ?? [])) {
      if (el === dialog || !(el instanceof HTMLElement) || el.inert || el.getAttribute('role') === 'dialog') continue;
      el.inert = true;
      made.push(el);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === target)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', onKey);
    return () => {
      dialog.removeEventListener('keydown', onKey);
      for (const el of made) el.inert = false;
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [labelledBy]);
  return <span ref={marker} hidden />;
}
