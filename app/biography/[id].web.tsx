import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { getHeroByComicvineId } from '../../src/lib/db/heroes';
import { useHeroRow } from '../../src/lib/query/heroQueries';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { heroImageSource } from '../../src/constants/heroImages';
import { HeroImage } from '../../src/components/HeroImage';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';

const HTML_STYLES = `
  body {
    font-family: FlameSans-Regular, 'Helvetica Neue', sans-serif;
    font-size: 15px;
    color: ${COLORS.navy};
    line-height: 1.85;
    margin: 0;
    word-break: break-word;
  }
  h2 {
    font-family: Flame-Regular, serif;
    font-size: 22px;
    color: ${COLORS.navy};
    margin: 40px 0 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid rgba(231,115,51,0.3);
    scroll-margin-top: 32px;
    font-weight: normal;
  }
  h2:first-child { margin-top: 0; }
  h3 {
    font-family: Flame-Regular, serif;
    font-size: 16px;
    color: ${COLORS.navy};
    margin: 24px 0 6px;
    padding-left: 10px;
    border-left: 3px solid rgba(231,115,51,0.45);
    font-weight: normal;
  }
  h4 {
    font-family: FlameSans-Regular, sans-serif;
    font-size: 11px;
    color: ${COLORS.navy};
    margin: 16px 0 4px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    opacity: 0.5;
  }
  p { margin: 0 0 14px; }
  /* Slightly larger opening paragraph */
  p:first-of-type { font-size: 16px; line-height: 1.9; }
  /* Drop cap on the opening word */
  p:first-of-type::first-letter {
    font-family: Flame-Regular, serif;
    font-size: 3.8em;
    line-height: 0.82;
    float: left;
    margin: 3px 9px -2px 0;
    color: ${COLORS.orange};
  }
  strong, b { font-weight: 600; }
  /* Wiki-style links: persistent subtle underline, full colour on hover */
  a { color: ${COLORS.orange}; text-decoration: none; border-bottom: 1px solid rgba(231,115,51,0.35); }
  a:hover { border-bottom-color: ${COLORS.orange}; }
  ul, ol { padding-left: 22px; margin: 0 0 14px; }
  li { margin-bottom: 5px; }
  blockquote {
    border-left: 3px solid ${COLORS.orange};
    margin: 18px 0;
    padding: 10px 16px;
    background: rgba(231,115,51,0.06);
    border-radius: 0 6px 6px 0;
    font-style: italic;
  }
  blockquote p { margin: 0; }
  hr {
    border: none;
    border-top: 1px solid rgba(41,60,67,0.12);
    margin: 28px 0;
  }
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 3px 12px rgba(41,60,67,0.14);
    margin: 16px 0;
    display: block;
  }
  figure { max-width: 100%; margin: 0; }
  figcaption {
    font-size: 11px;
    color: ${COLORS.navy};
    opacity: 0.5;
    text-align: center;
    margin-top: 5px;
    font-style: italic;
    line-height: 1.4;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
  }
  th {
    background: rgba(41,60,67,0.06);
    padding: 8px 12px;
    text-align: left;
    font-family: FlameSans-Regular, sans-serif;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: ${COLORS.navy};
  }
  td {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(41,60,67,0.08);
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }

  /* ── ComicVine image embeds — editorial float layout ── */

  /* Right-aligned: float into text column */
  [data-embed-type="image"][data-align="right"] {
    float: right !important;
    width: 42% !important;
    min-width: 140px !important;
    margin: 2px 0 16px 22px !important;
  }
  /* Left-aligned: float left */
  [data-embed-type="image"][data-align="left"] {
    float: left !important;
    width: 42% !important;
    min-width: 140px !important;
    margin: 2px 22px 16px 0 !important;
  }
  /* Center or unset: full-width block */
  [data-embed-type="image"][data-align="center"],
  [data-embed-type="image"]:not([data-align="right"]):not([data-align="left"]) {
    float: none !important;
    width: 100% !important;
    margin: 20px 0 !important;
  }
  /* Headings clear floats so they never sit beside an image */
  h2, h3 { clear: both; }

  /* Collapse the fluid-height anchor */
  a.fluid-height {
    display: block !important;
    height: auto !important;
    padding-bottom: 0 !important;
    position: static !important;
  }
  /* Image fills the figure box */
  a.fluid-height img {
    position: static !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    display: block !important;
    margin: 0 !important;
    border-radius: 8px;
    box-shadow: 0 3px 12px rgba(41,60,67,0.14);
  }

  /* Mobile: collapse all floats to full-width */
  @media (max-width: 600px) {
    [data-embed-type="image"][data-align="right"],
    [data-embed-type="image"][data-align="left"] {
      float: none !important;
      width: 100% !important;
      margin: 16px 0 !important;
    }
  }
`;

const SHIMMER_CSS = `
  @keyframes bio-shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }
  .bio-sk {
    background: linear-gradient(
      90deg,
      #e4dbd0 0%,
      #d6cdc2 40%,
      #ccc3b8 50%,
      #d6cdc2 60%,
      #e4dbd0 100%
    );
    background-size: 600px 100%;
    animation: bio-shimmer 1.4s ease-in-out infinite;
    border-radius: 6px;
    flex-shrink: 0;
  }
`;

function Sk({
  w = '100%',
  h,
  r = 6,
  mb = 0,
}: {
  w?: string | number;
  h: number;
  r?: number;
  mb?: number;
}) {
  return (
    <div className="bio-sk" style={{ width: w, height: h, borderRadius: r, marginBottom: mb }} />
  );
}

function BiographySkeleton() {
  return (
    <>
      <style>{SHIMMER_CSS}</style>

      {/* Paragraph 1 */}
      <Sk h={13} mb={10} />
      <Sk w="97%" h={13} mb={10} />
      <Sk w="91%" h={13} mb={10} />
      <Sk w="95%" h={13} mb={10} />
      <Sk w="68%" h={13} mb={32} />

      {/* Section heading */}
      <Sk w="35%" h={20} r={5} mb={16} />

      {/* Paragraph 2 */}
      <Sk h={13} mb={10} />
      <Sk w="98%" h={13} mb={10} />
      <Sk w="85%" h={13} mb={10} />
      <Sk w="92%" h={13} mb={10} />
      <Sk w="74%" h={13} mb={10} />
      <Sk w="55%" h={13} mb={32} />

      {/* Inline image placeholder */}
      <Sk h={220} r={10} mb={32} />

      {/* Section heading */}
      <Sk w="28%" h={20} r={5} mb={16} />

      {/* Paragraph 3 */}
      <Sk h={13} mb={10} />
      <Sk w="96%" h={13} mb={10} />
      <Sk w="89%" h={13} mb={10} />
      <Sk w="62%" h={13} mb={32} />

      {/* Section heading */}
      <Sk w="42%" h={20} r={5} mb={16} />

      {/* Paragraph 4 */}
      <Sk h={13} mb={10} />
      <Sk w="93%" h={13} mb={10} />
      <Sk w="87%" h={13} mb={10} />
      <Sk w="95%" h={13} mb={10} />
      <Sk w="70%" h={13} mb={10} />
      <Sk w="50%" h={13} mb={0} />
    </>
  );
}

function SidebarSkeleton() {
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <Sk h={267} r={10} mb={20} />
      <Sk w="50%" h={9} r={4} mb={14} />
      <Sk w="80%" h={12} r={4} mb={10} />
      <Sk w="65%" h={12} r={4} mb={10} />
      <Sk w="75%" h={12} r={4} mb={10} />
      <Sk w="55%" h={12} r={4} mb={0} />
    </>
  );
}

function preprocessHtml(html: string): string {
  return (
    html
      // Remove noscript blocks — they contain a duplicate real <img> that renders via innerHTML
      .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
      // Swap lazy-load placeholder src with the real data-src
      .replace(/\ssrc="data:image\/gif;base64,[^"]*"/gi, '')
      .replace(/\sdata-src="/gi, ' src="')
      .replace(/\sdata-srcset="/gi, ' srcset="')
      // Strip hard-coded sizes — let browser pick the right srcset variant by display size
      .replace(/\ssizes="[^"]*"/gi, '')
  );
}

function extractHeadings(html: string): { processedHtml: string; toc: string[] } {
  const toc: string[] = [];
  let i = 0;
  const processedHtml = html.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
    (_match, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (text) toc.push(text);
      return `<h2${attrs} id="bio-s${i++}">${inner}</h2>`;
    },
  );
  return { processedHtml, toc };
}

export default function WebBiographyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Document scroll so the page bleeds edge-to-edge under the iOS Safari toolbar.
  // Mobile canvas: ink — the iOS status-bar strip samples the BODY bg, so a dark
  // body makes that strip fuse with the dark hero header (no beige band); the
  // content owns its own full-length beige (mobileBody). Desktop has no system
  // status bar, so it keeps a beige body (full-bleed, no navy gutters).
  useScreenChrome({ top: SURFACE.ink, canvas: isDesktop ? SURFACE.paper : SURFACE.ink });

  // Shares the hero-row cache with the character screen (useHeroRow), so opening
  // a hero's full biography after viewing the character is instant.
  const hero = useHeroRow(id).data ?? null;
  // Derive the rendered HTML + table of contents from the description (no effect).
  // The React Compiler memoises this derivation automatically.
  const { processedHtml, toc } = ((): { processedHtml: string; toc: string[] } => {
    if (!hero?.description) return { processedHtml: '', toc: [] as string[] };
    const { processedHtml: html, toc: headings } = extractHeadings(
      preprocessHtml(hero.description),
    );
    return { processedHtml: html, toc: headings };
  })();

  const heroImage = id ? heroImageSource(String(id), hero?.image_url, hero?.portrait_url) : null;

  const scrollToSection = (index: number) => {
    document
      .getElementById(`bio-s${index}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Delegated click handler for biography links
  const bioContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const handleClick = async (e: MouseEvent) => {
        const anchor = (e.target as Element).closest('a');
        if (!anchor) return;
        const href = anchor.getAttribute('href') ?? '';

        // Character link: /slug/4005-{cvId}/
        const charMatch = href.match(/\/slug\/4005-(\d+)\//);
        if (charMatch) {
          e.preventDefault();
          const found = await getHeroByComicvineId(charMatch[1]);
          if (found) {
            router.push(`/character/${found.id}` as never);
          } else {
            window.open(`https://comicvine.gamespot.com${href}`, '_blank', 'noopener');
          }
          return;
        }

        // Any other relative /slug/ link — open externally
        if (href.startsWith('/slug/')) {
          e.preventDefault();
          window.open(`https://comicvine.gamespot.com${href}`, '_blank', 'noopener');
        }
      };

      node.addEventListener('click', handleClick as unknown as EventListener);
      return () => node.removeEventListener('click', handleClick as unknown as EventListener);
    },
    [router],
  );

  return (
    <View style={[styles.scroll, !isDesktop && (styles.scrollDarkMobile as object)] as object}>
      {/* Cinematic identity header — echoes the character page stage */}
      <View style={styles.identityHeader}>
        {/* Ambient blurred portrait backdrop for depth */}
        {heroImage ? (
          <Image
            source={heroImage}
            contentFit="cover"
            contentPosition="top"
            style={[StyleSheet.absoluteFill, styles.headerBackdrop] as object}
            cachePolicy="memory-disk"
            recyclingKey={id}
          />
        ) : null}
        {/* Gradient scrim keeps the title legible over the backdrop */}
        <View style={[styles.headerScrim, { pointerEvents: 'none' }] as object} />
        {/* Mobile: deep-navy → transparent cap over the top so the header fuses with
            the dark status strip and the portrait/atmosphere fades in below it. */}
        {!isDesktop && (
          <View style={[styles.mHeaderTopScrim, { pointerEvents: 'none' }] as object} />
        )}
        {/* Atmospheric orange orb — desktop only; on mobile its top gets clipped by
            the header's overflow:hidden, leaving a hard line under the status bar. */}
        {isDesktop && <View style={[styles.headerOrb, { pointerEvents: 'none' }] as object} />}

        <View style={styles.headerInner}>
          {hero ? (
            <View style={styles.heroTitleBlock}>
              <Text style={styles.eyebrow}>Biography</Text>
              <Text
                style={[
                  styles.heroName,
                  { fontSize: isDesktop ? 46 : 32, lineHeight: isDesktop ? 50 : 36 },
                ]}
              >
                {hero.name}
              </Text>
              {hero.summary ? (
                <Text style={styles.heroDeck} numberOfLines={2}>
                  {hero.summary}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Soft orange glow at the bottom edge */}
        <View style={[styles.headerAccent, { pointerEvents: 'none' }] as object} />
      </View>

      {/* Body */}
      {isDesktop ? (
        <View style={styles.desktopBody}>
          {/* Sticky sidebar */}
          <View
            style={[styles.sidebar, { position: 'sticky' as 'relative', top: TOPBAR_HEIGHT + 16 }]}
          >
            {hero ? (
              <View style={styles.sidebarPortrait}>
                <HeroImage
                  id={String(id ?? '')}
                  name={hero.name}
                  imageUrl={hero.image_url}
                  portraitUrl={hero.portrait_url}
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 10 } as object}
                  recyclingKey={id}
                />
              </View>
            ) : (
              <SidebarSkeleton />
            )}
            {toc.length > 0 ? (
              <View style={styles.tocContainer}>
                <Text style={styles.tocTitle}>Contents</Text>
                {toc.map((heading, i) => (
                  <Pressable
                    key={i}
                    onPress={() => scrollToSection(i)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [styles.tocItem, hovered && (styles.tocItemHovered as object)] as object
                    }
                  >
                    <View style={styles.tocRow}>
                      <Text style={styles.tocNum}>{i + 1}</Text>
                      <Text style={styles.tocText} numberOfLines={2}>
                        {heading}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Main content */}
          <View style={styles.desktopContent}>
            {hero ? (
              hero.description ? (
                <>
                  <style>{HTML_STYLES}</style>
                  <div ref={bioContentRef} dangerouslySetInnerHTML={{ __html: processedHtml }} />
                </>
              ) : (
                <Text style={styles.empty}>No biography available.</Text>
              )
            ) : (
              <BiographySkeleton />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.mobileBody}>
          {hero ? (
            hero.description ? (
              <>
                <style>{HTML_STYLES}</style>
                <div ref={bioContentRef} dangerouslySetInnerHTML={{ __html: processedHtml }} />
              </>
            ) : (
              <Text style={styles.empty}>No biography available.</Text>
            )
          ) : (
            <BiographySkeleton />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  // Mobile: the scroll surface goes dark so the header fuses uninterrupted into the
  // dark status strip (no beige peeking between). The beige comes from mobileBody.
  scrollDarkMobile: { backgroundColor: COLORS.deepNavy } as object,

  // Cinematic identity header — mirrors the character page stage
  identityHeader: {
    backgroundColor: COLORS.deepNavy,
    paddingTop: TOPBAR_HEIGHT,
    paddingBottom: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  // Mobile: deep-navy cap that fuses the header's top into the dark status strip,
  // easing to transparent so the portrait/atmosphere blooms in below the chrome.
  mHeaderTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 'calc(env(safe-area-inset-top) + 180px)' as unknown as number,
    // Fade the portrait into EXACTLY the status-bar colour (COLORS.deepNavy is the
    // declared chrome `top`, so this is the same pixel value iOS paints the status
    // bar) — solid through the status/nav zone, then easing to reveal the portrait.
    backgroundImage: `linear-gradient(to bottom, ${COLORS.deepNavy} 0%, ${COLORS.deepNavy} 48%, rgba(11,24,32,0.72) 66%, transparent 100%)`,
  } as object,
  // Blurred portrait fills the header for atmosphere; scaled up to hide blur edges.
  headerBackdrop: {
    filter: 'blur(55px)',
    transform: [{ scale: 1.3 }],
    opacity: 0.38,
    // Fade the portrait to transparent at the top so its warm tint never reaches
    // the cool deep-navy strip — the top stays pure navy and the image blooms in
    // lower, blending seamlessly into the status bar.
    maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 30%, #000 68%)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 30%, #000 68%)',
  } as object,
  headerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(180deg, rgba(11,24,32,0.55) 0%, rgba(11,24,32,0.32) 40%, rgba(11,24,32,0.85) 100%)',
  } as object,
  headerOrb: {
    position: 'absolute',
    width: 320,
    height: 320,
    top: -70,
    right: '8%',
    borderRadius: 160,
    backgroundImage: 'radial-gradient(circle, rgba(231,115,51,0.16), transparent 70%)',
    pointerEvents: 'none',
  } as object,
  headerInner: {
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center' as const,
    paddingHorizontal: 24,
    position: 'relative',
    zIndex: 2,
  } as object,
  headerAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.orange,
    boxShadow: `0 0 18px ${COLORS.orange}`,
    zIndex: 3,
  } as object,
  // Glass back control — echoes the floating nav and character stage.
  heroTitleBlock: { gap: 6 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase' as const,
    letterSpacing: 2.5,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    color: COLORS.beige,
    textShadow: '0 2px 20px rgba(0,0,0,0.45)',
  } as object,
  heroDeck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.62)',
    lineHeight: 21,
    marginTop: 6,
    maxWidth: 620,
  },

  // Desktop two-column layout
  desktopBody: {
    flexDirection: 'row',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center' as const,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 0,
    gap: 40,
    alignItems: 'flex-start',
  },
  sidebar: {
    width: 200,
    alignSelf: 'flex-start' as const,
  },
  sidebarPortrait: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 10,
    marginBottom: 20,
  },
  tocContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(41,60,67,0.12)',
    paddingTop: 16,
  },
  tocTitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.4,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  tocItem: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  tocItemHovered: {
    backgroundColor: 'rgba(41,60,67,0.06)',
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  tocNum: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.orange,
    lineHeight: 18,
    width: 16,
  },
  tocText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 18,
    flex: 1,
  },
  desktopContent: {
    flex: 1,
    paddingBottom: 32,
    minWidth: 0,
  },

  // Mobile layout. Owns the beige so the content surface runs the FULL page length
  // (the body is now dark for the status-bar strip, so the beige can't come from
  // the body — it has to be painted by the content itself, edge-to-edge).
  mobileBody: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center' as const,
    backgroundColor: COLORS.beige,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 0,
  },

  empty: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.navy, opacity: 0.4 },
});
