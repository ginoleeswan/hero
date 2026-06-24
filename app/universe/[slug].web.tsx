// app/universe/[slug].web.tsx — web universe browse page. Re-exports the
// source-aware web category screen (Metro resolves '../category/[slug]' to its
// .web variant), so /universe and /category share one design.
export { default } from '../category/[slug]';
