// app/franchise/[slug].web.tsx — web franchise browse page. Re-exports the
// source-aware web category screen (Metro resolves '../category/[slug]' to its
// .web variant), so /franchise, /universe, and /category share one design.
export { default } from '../category/[slug]';
