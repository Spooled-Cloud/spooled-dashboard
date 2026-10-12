/**
 * Test stand-in for the `astro:middleware` virtual module, which only exists inside an Astro
 * build. Aliased in vitest.config.ts so `src/middleware.ts` can be imported by unit tests.
 */
export const defineMiddleware = <T>(handler: T): T => handler;
