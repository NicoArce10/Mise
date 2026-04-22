import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal client-side routing using the History API directly — no router
 * dependency. Keeps the back/forward buttons of the browser in sync with
 * the in-app view state so a judge clicking the native back arrow stays
 * inside the demo instead of being bounced to the previous tab URL.
 *
 * The rules:
 *   - `push(view)` advances history (new entry) and updates the URL path.
 *   - `replace(view)` swaps the current entry (e.g. when processing
 *     finishes and we redirect forward programmatically).
 *   - `popstate` events from the browser back/forward buttons drive the
 *     internal state back into the app — no manual navigation code needed.
 *
 * The URL shape is intentionally simple — a leading slash + slug. No query
 * strings, no dynamic params. The product is a single experience; the slug
 * only exists so the judge's back button does the obvious thing.
 */
export function useBrowserNav<View extends string>(initial: View) {
  // Keep the initial view stable across renders without triggering the deps
  // array of the initial-read effect.
  const initialRef = useRef(initial);

  const readFromUrl = useCallback((): View => {
    const slug = window.location.pathname.replace(/^\//, '') as View;
    return slug || initialRef.current;
  }, []);

  const [view, setViewState] = useState<View>(() => readFromUrl());

  // Ensure the initial URL actually matches the view we render so the first
  // back click has somewhere to go to. Using `replace` so we don't pollute
  // history with two entries at boot.
  useEffect(() => {
    const currentSlug = window.location.pathname.replace(/^\//, '');
    if (!currentSlug) {
      window.history.replaceState({ view }, '', `/${view}`);
    } else if (currentSlug !== view) {
      // The user hard-reloaded on /catalog → trust the URL, keep state in sync.
      setViewState(currentSlug as View);
    }
  }, [view]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const next =
        (event.state && typeof event.state.view === 'string'
          ? (event.state.view as View)
          : null) ?? readFromUrl();
      setViewState(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [readFromUrl]);

  const push = useCallback((next: View) => {
    setViewState(prev => {
      if (prev === next) return prev;
      window.history.pushState({ view: next }, '', `/${next}`);
      return next;
    });
  }, []);

  const replace = useCallback((next: View) => {
    setViewState(next);
    window.history.replaceState({ view: next }, '', `/${next}`);
  }, []);

  return { view, push, replace } as const;
}
