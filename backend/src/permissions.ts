// Re-exports from the synced local copy at ./_shared/permissions.ts rather
// than the canonical ../../shared/permissions.ts directly — tsc's rootDir
// requires every file it compiles to live inside backend/src, and the real
// file lives one level above that. scripts/copy-shared-permissions.js keeps
// ./_shared/permissions.ts in sync with the real source on every build and
// dev run, so this file (and everything that imports from it) always sees
// the current canonical definitions without ever compiling a file from
// outside backend/src.
export * from './_shared/permissions';