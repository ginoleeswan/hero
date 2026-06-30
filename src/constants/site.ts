// Canonical production origin — the single source of truth for SEO canonical /
// Open Graph URLs (SeoHead, app/+html.tsx). When the custom domain
// (mythique.app) is attached in Vercel, flip this one line.
//
// The sitemap generator (scripts/generate-sitemap.mjs) is a standalone build
// script that can't import this TS module; it mirrors the same default and can
// be overridden at build time with the SITEMAP_BASE_URL env var. Keep the two in
// sync.
export const SITE_URL = 'https://mythique-wiki.vercel.app';
