// Canonical production origin — the single source of truth for SEO canonical /
// Open Graph URLs (SeoHead, app/+html.tsx). Points at the custom domain
// (mythique.app); update this one line if the origin ever changes.
//
// The sitemap generator (scripts/generate-sitemap.mjs) is a standalone build
// script that can't import this TS module; it mirrors the same default and can
// be overridden at build time with the SITEMAP_BASE_URL env var. Keep the two in
// sync.
export const SITE_URL = 'https://mythique.app';
