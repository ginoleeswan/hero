// Per-route SEO/social head for web routes, built on expo-router/head. Renders
// a unique <title>, meta description, canonical URL, and Open Graph + Twitter
// tags so each page is indexed and shares richly (the global defaults in
// +html.tsx are the fallback). Used from the *.web.tsx route files.
import Head from 'expo-router/head';

const SITE = 'https://mythique.app';

export function SeoHead({
  title,
  description,
  path,
  image,
  noindex = false,
}: {
  title: string;
  description: string;
  /** Absolute path for the canonical URL, e.g. "/character/superman". */
  path: string;
  /** Absolute image URL for OG/Twitter; defaults to the site card. */
  image?: string;
  noindex?: boolean;
}) {
  const url = `${SITE}${path}`;
  const img = image || `${SITE}/og.png`;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex ? <meta name="robots" content="noindex,follow" /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Mythique" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
    </Head>
  );
}
