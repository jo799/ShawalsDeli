import { useState, useEffect } from 'react';
import { MEDIA_QUERIES, type BreakpointName } from '@/lib/breakpoints';

interface BreakpointState {
  breakpoint: BreakpointName;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  // true from "tablet" width and up — the common case of "do I have room
  // for a sidebar/multi-column layout" without caring about the mobile/
  // tablet distinction specifically.
  isTabletOrLarger: boolean;
}

function computeState(): BreakpointState {
  // matchMedia is unavailable during SSR, but this app is pure client-side
  // (no server rendering), so window always exists by the time this runs.
  const isTablet = window.matchMedia(MEDIA_QUERIES.tablet).matches;
  const isDesktop = window.matchMedia(MEDIA_QUERIES.desktop).matches;
  return {
    breakpoint: isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile',
    isMobile: !isTablet,
    isTablet: isTablet && !isDesktop,
    isDesktop,
    isTabletOrLarger: isTablet,
  };
}

// Central hook for any component that needs to make a JS-level decision
// based on screen size (e.g. "render a drawer instead of a permanent
// sidebar", "show 2 stat cards per row instead of 5"). Pure CSS responsive
// behavior (hiding/showing elements, reflowing a grid) should still just use
// Tailwind's sm:/md:/lg: classes directly — this hook is for the cases
// where the actual JSX structure needs to differ, not just its styling.
//
// Uses matchMedia listeners rather than a `resize` event + width polling,
// so it only re-renders on an actual breakpoint crossing, not on every
// pixel of a window drag.
export function useBreakpoint(): BreakpointState {
  const [state, setState] = useState<BreakpointState>(() => computeState());

  useEffect(() => {
    const tabletQuery = window.matchMedia(MEDIA_QUERIES.tablet);
    const desktopQuery = window.matchMedia(MEDIA_QUERIES.desktop);
    const update = () => setState(computeState());

    tabletQuery.addEventListener('change', update);
    desktopQuery.addEventListener('change', update);
    return () => {
      tabletQuery.removeEventListener('change', update);
      desktopQuery.removeEventListener('change', update);
    };
  }, []);

  return state;
}