// Single source of truth for what "mobile", "tablet", and "desktop" mean
// across the whole app. Matches Tailwind's own default breakpoints
// (sm/md/lg) deliberately — if this file and tailwind.config.js ever
// disagreed about where a breakpoint sits, a component using the
// useBreakpoint hook for a JS decision (e.g. "render a drawer instead of a
// sidebar") could show a different layout than a component using a
// `md:flex` class for the same decision. Change the numbers here if the
// product needs different breakpoints, and both systems move together.
export const BREAKPOINTS = {
  mobile: 0,     // 0–767: phones
  tablet: 768,   // 768–1023: tablets, small laptops
  desktop: 1024, // 1024+: laptops and up
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

export const MEDIA_QUERIES = {
  tablet: `(min-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
} as const;