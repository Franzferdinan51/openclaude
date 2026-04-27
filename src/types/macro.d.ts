/**
 * MACRO — Global injected at build time via Bun.define() in build.ts.
 * Declared here so TypeScript sees it as a global in all source files.
 *
 * Properties mirror what build.ts injects so typecheck passes.
 */

declare const MACRO: {
  VERSION: string
  DISPLAY_VERSION: string
  ISSUES_EXPLAINER: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL: string | undefined
}
