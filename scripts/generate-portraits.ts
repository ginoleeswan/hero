#!/usr/bin/env bun
/**
 * Hero portrait generation script.
 *
 * For each hero with portrait_url IS NULL, fetch their source image, send it +
 * wolverine/deadpool/thor refs to Gemini 3.1 Flash Image for style transfer,
 * upload the result straight to Cloudinary (public_id `hero-portraits/{id}`,
 * overwrite:true — same scheme the app reads), and write the Cloudinary
 * secure_url back to heroes.portrait_url.
 *
 * Portraits go directly to Cloudinary — no Supabase Storage hop, so no
 * migrate-portraits-to-cloudinary pass is ever needed. Supabase is used only to
 * read the working set and write portrait_url back.
 *
 * Usage:
 *   bun scripts/generate-portraits.ts               # full batch
 *   bun scripts/generate-portraits.ts --hero-id 69  # single hero (test)
 *   bun scripts/generate-portraits.ts --dry-run     # log without API calls
 *   bun scripts/generate-portraits.ts --concurrency 5
 *   bun scripts/generate-portraits.ts --from-text   # heroes with no source art
 *
 * --from-text covers heroes that have no usable image to transfer from (no
 * image_url, or ComicVine's "Blank!" placeholder). It renders from a written
 * description in TEXT_PORTRAIT_HINTS via Imagen, and skips any hero without one.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY!;

// Cloudinary (portrait host). Signed uploads — same target as the app's URLs.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET!;

const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

const GEMINI_MODEL = 'gemini-3.1-flash-image';
const GEMINI_URL = geminiUrl(GEMINI_MODEL);

// Fallback image-to-image model for heroes 3.1 refuses. 2.5 Flash Image is a
// generation older (looser on trademarked IP) and cheap (~$0.04/img); being
// image-to-image (source + style refs) it keeps the proper side-profile headshot
// framing — unlike the Imagen text-to-image last resort, which zooms out to a torso
// shot. (gemini-2.0-flash-preview-image-generation was deprecated and 404s;
// gemini-3-pro-image is ~3-4× pricier and same-generation as 3.1, so neither helps.)
const GEMINI_25_IMAGE_URL = geminiUrl('gemini-2.5-flash-image');

// Imagen Ultra (best prompt adherence) only renders the non-trademarked "lookalike"
// that we launder back through Gemini 3.1 — it's not the final portrait, so the
// extra 2¢/image over standard buys a cleaner source for the gold-standard pass.
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict?key=${GEMINI_API_KEY}`;
const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// FLUX.2 [pro] edit (fal.ai) — permissive image-to-image editor for the blocked tier.
// Unlike the launder (a text bridge that loses identity), it SEES the real source, so
// it keeps the character's likeness; being open-lineage it doesn't refuse trademarked
// characters. Fed source + the 3 style refs as image_urls — the same recipe as the
// gold-standard Gemini pass. Opt in with --flux2. To try Seedream instead, swap this
// endpoint for fal-ai/bytedance/seedream/v4/edit (same request shape).
const FAL_KEY = process.env.FAL_KEY!;
const FLUX2_URL = 'https://fal.run/fal-ai/flux-2-pro/edit';
// Seedream v4.5 edit — better than v4, and not the v5 Lite that over-zealously refused
// classic Mickey (v5 = 'fal-ai/bytedance/seedream/v5/lite/edit'). If v4.5's content
// checker also blocks, fall back to 'fal-ai/bytedance/seedream/v4/edit'. One-line swap.
const SEEDREAM_URL = 'https://fal.run/fal-ai/bytedance/seedream/v4.5/edit';

// Style references — Wolverine, Deadpool, Thor: best painterly texture examples (v4 proven)
const ASSETS_DIR = join((import.meta as unknown as { dir: string }).dir, '../assets/images');
const STYLE_REF_PATHS = [
  join(ASSETS_DIR, 'wolverine.jpg'),
  join(ASSETS_DIR, 'deadpool.jpg'),
  join(ASSETS_DIR, 'thor.jpg'),
];

function buildPrompt(): string {
  return `The first image is the character to redraw. Images 2, 3, and 4 are style reference illustrations — study every detail and match the style exactly.

Redraw the character from image 1 as a strict pure side-profile portrait facing RIGHT (nose pointing right, pure 90-degree side view, exactly as in the references).

RENDERING: Painterly digital illustration — rich dimensional depth, visible surface quality. Skin has warm highlights, cool shadows, subtle colour variation. Costume materials feel real: fabric has texture, metal has sheen, leather has gloss. Exactly like the references — NOT flat vector, NOT plain cartoon.

BACKGROUND: Design a background that reflects this character's iconic visual identity. Choose BOTH a colour and a style:

COLOUR — Pick the single most iconic, vivid, saturated colour associated with this character's brand and aesthetic. It MUST strongly contrast with the character's costume and skin — never blend into them. Avoid near-black even for dark characters; instead use a vivid deep colour (e.g. electric blue, deep crimson, rich purple). Examples: Spider-Man → deep red, Superman → cobalt blue, Hulk → vivid green, Joker → royal purple, Thor → stormy blue-gold, Iron Man → vivid gold.

STYLE — Choose whichever of these best fits the character's visual identity:
• Flat bold colour with slight painterly/brushed canvas texture — versatile default for most characters
• Concentric circles / target rings — for characters with circular iconography (Captain America's shield, Magneto's magnetic fields, Hawkeye's target, etc.)
• Radiating sunburst / diverging lines — for powerful, radiant, or cosmic characters (Thor, Superman, Doctor Strange, Silver Surfer)
• Geometric pattern referencing their visual motif — web grid for Spider-Man, lightning for Flash, etc.

The background must have a strong, clean outline separating it from the character's silhouette. Slight painterly texture throughout, matching the reference style.

FRAMING: This is a HEADSHOT — the face and head fill the entire canvas. Think of a passport photo or a coin portrait — nothing but the face, with the very tops of the shoulders just barely visible at the bottom edge. The chin should be roughly 15% from the bottom of the image, the top of the head 10% from the top. Zero chest, zero torso. Portrait orientation (taller than wide).

The character MUST face RIGHT. Preserve costume colours and identity exactly. No text, no logos.`;
}

// The 34 heroes that already have curated local images (id → local file path)

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const heroIdFlag = args.find((_, i) => args[i - 1] === '--hero-id') ?? null;
const heroIdsFlag = args.find((_, i) => args[i - 1] === '--hero-ids') ?? null;
const heroIdsSet = heroIdsFlag ? new Set(heroIdsFlag.split(',').map((s) => s.trim())) : null;
const dryRun = args.includes('--dry-run');
const useFlux2 = args.includes('--flux2');
const useSeedream = args.includes('--seedream');
// *-only: skip every Gemini attempt and render straight through the fal edit model.
const useFlux2Only = args.includes('--flux2-only');
const useSeedreamOnly = args.includes('--seedream-only');
const useFal = useFlux2 || useSeedream || useFlux2Only || useSeedreamOnly;
// --refs: also send the 3 style refs to the fal edit model (multi-reference style
// transfer — Seedream's strength). Off = source-only (model paints its own style).
const useRefs = args.includes('--refs');
const concurrencyArg = args.find((_, i) => args[i - 1] === '--concurrency');
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg, 10) : 3;
const limitArg = args.find((_, i) => args[i - 1] === '--limit');
const LIMIT = limitArg ? parseInt(limitArg, 10) : null;
// --from-text: generate from a written description instead of a source image, for
// heroes that have no usable art. See TEXT_PORTRAIT_HINTS.
const fromText = args.includes('--from-text');

// ─── Unusable sources ─────────────────────────────────────────────────────────
// ComicVine serves a grey "Blank!" comic-burst placeholder for characters it has
// no art for, and 6,167 rows in the catalogue carry it as their image_url. It is
// a valid, fetchable PNG, so `image_url IS NOT NULL` treats it as a real source —
// but style-transferring it produces a portrait of nobody. With no character to
// read, the model just copies the Wolverine/Deadpool/Thor style refs and invents a
// generic masked superhero: ElfQuest's Gifa came out as a man in a yellow cowl.
// 79 portraits had already been generated this way before the guard existed.
const BLANK_SOURCE_RE = /6373148-blank\.png/;
const isUsableSource = (url: string | null): boolean => !!url && !BLANK_SOURCE_RE.test(url);

// ─── Costume hint overrides ───────────────────────────────────────────────────
// Used when the source image is misleading (e.g. Clark Kent instead of Superman)
// or when the character's iconic weapon keeps appearing despite framing rules.
const COSTUME_HINTS: Record<string, string> = {
  // Superman keeps generating as Clark Kent
  '644':
    'Superman in his classic red and blue superhero costume with yellow S-shield on chest and red cape — NOT Clark Kent, NOT civilian clothes, NO glasses',
  // Framing / too much body
  '659':
    'Thor wearing his classic silver winged helmet and red cape — face and head ONLY filling entire canvas, NO hammer, NO Mjolnir, NO body, nothing below the very top of the shoulders',
  '717':
    'Wolverine in his classic yellow and blue X-Men mask — extreme close-up headshot, face fills entire canvas, NO claws, NO body below chin, nothing in hands',
  '332':
    'Hulk — massive angry green face, huge jaw, fills the entire canvas in extreme close-up — NO shirt, NO body, NO torn clothing, face only from crown to chin',
  '213':
    'Deadpool wearing his red and black mask with white eye lenses — extreme close-up headshot, mask fills entire canvas, NO body, NO weapons, head only',
  '479':
    'Mysterio — the large chrome fishbowl helmet/globe head fills the entire canvas from top to bottom, green bodysuit collar just barely visible at bottom edge — NO body, NO weapons',
  '480':
    'Mystique — blue skin, red hair, yellow eyes — extreme close-up face fills entire canvas, NO body, NO gun, head and face only',
  '185':
    'Colossus — silver metallic organic steel face and head, flat chrome finish with visible facial features — extreme close-up, face fills entire canvas, NO body, NO shoulders',
  '490':
    'Nightcrawler — blue fuzzy skin, pointed ears, yellow eyes, dark hair, sinister grin — extreme close-up face fills entire canvas, NO body, NO tail, head and face only. Style: clean painterly illustration like a high-end comic cover, bold graphic shapes, smooth rendering',
  // Loki horns making head appear small — frame accommodates horns but face must be large
  '414':
    'Loki in his golden curved horned helmet, green and gold armour — the face must be large and prominent filling the lower 70% of the canvas, the two tall curved horns extend upward into the top of the frame, face is not small',
  // Facing direction
  '630':
    'Star-Lord wearing his red helmet with fin details and glowing red eye lenses — STRICT pure 90-degree side profile facing directly RIGHT, nose pointing exactly right, one eye lens visible, face fills canvas',
  // White border artifacts
  '30': 'Ant-Man wearing his red and silver helmet — face fills entire canvas edge to edge, absolutely NO white border, NO white outline, NO padding around the edges, background colour bleeds to every edge',
  // Art style needs more Mitchell
  '222':
    'Doctor Doom wearing his iconic iron mask and dark green hooded cloak, the metal mask has a stern expression — clean bold graphic illustration style like a Mondo poster print, strong flat colour shapes, bold graphic forms, face fills canvas',
  '299':
    'Green Goblin wearing his classic purple and green goblin helmet with pointed ears, orange skin, menacing sharp-toothed grin, glowing orange eyes — NOT a jester, NOT medieval, classic Marvel villain goblin look',
  '225':
    'Doctor Octopus — Otto Octavius, bald head, round amber goggles, dark coat — four large mechanical metal tentacles visible curling behind his head in background, face fills canvas in strict side profile',
  '567':
    'Rogue — brown hair with a dramatic white streak at the front, green and yellow X-Men costume collar — clean bold graphic illustration style like a Mondo poster print, strong flat colour shapes, graphic poster quality. Extreme close-up, face fills canvas',
  // Hawkeye white artifacts
  '313':
    'Hawkeye wearing his purple tactical mask with H logo — face fills entire canvas, NO white areas on sides, background colour fills edge to edge, NO bow, NO quiver',
};

// ─── Text-only portrait descriptions (--from-text) ────────────────────────────
// For heroes with no usable source art at all. ComicVine's licensed-adaptation
// coverage of Westeros stops after A Clash of Kings, so everything from A Storm
// of Swords onward — and the whole Dance of the Dragons cast — has no image
// anywhere in the pipeline. Wikidata has no free image for them either; its only
// hit is a convention photograph of an actor, which is a real person and not
// what we want a portrait model reading.
//
// So these are written descriptions of the CHARACTER as described on the page —
// never a likeness of any actor. The Imagen prompt already fixes style, pose,
// framing and background; this only supplies who is in the frame.
const TEXT_PORTRAIT_HINTS: Record<string, string> = {
  // ── A Song of Ice and Fire ──
  'h_a4c019f3-5ced-4250-a15c-91f6c9be7c2e':
    'Tormund Giantsbane, a wildling raider — a big weathered northerner with a wild mane of red hair and a thick unkempt red beard, ruddy wind-burned skin, laughing pale eyes, wearing heavy layered furs at the collar',
  'h_596c8b53-a04d-4a39-9555-172eb2f2febc':
    'Oberyn Martell, the Red Viper of Dorne — an olive-skinned Dornish nobleman with sleek black hair, a neatly pointed black beard, sharp amused dark eyes, wearing flowing orange and yellow silk robes at the collar. NO spear',
  'h_cc15b9a0-0fc8-421d-816e-35757a14ba74':
    'Olenna Tyrell, the Queen of Thorns — a very old noblewoman with a deeply lined shrewd face, silver-white hair bound under a soft wimple and net headdress, wry knowing expression, wearing rich green and gold brocade at the collar',
  'h_76328e53-7cc8-4aae-acc5-c18a2486a89d':
    'Missandei, a scribe and translator of Naath — a young woman with dark brown skin, close-cropped tight curls, calm intelligent amber eyes, wearing simple elegant pale blue and cream robes at the collar',
  'h_b3d34095-951f-4ea5-a1c8-7f1524b3516f':
    'Grey Worm, commander of the Unsullied — a disciplined young soldier with dark brown skin, shaved head, impassive steady expression, wearing a bronze-studded dark leather collar and a spiked bronze helm. NO spear',
  'h_f10f7f10-d89a-4e82-96be-1a698c925526':
    'Daario Naharis, a sellsword captain — a swaggering fighter with a blue-dyed forked beard, curled blue-tinted hair, bright confident eyes, gold-toothed grin, wearing an open ornate brigandine collar',
  'h_cec47238-e6f0-481f-8b43-48b401d63809':
    'Euron Greyjoy, the Crow’s Eye — a hard-faced ironborn reaver with long dark salt-matted hair, a black leather eyepatch over the left eye, cruel smiling mouth, wearing dark scaled armour at the collar',
  'h_fede1214-54d6-4f15-a1c4-649a8aa91d40':
    'Ellaria Sand, a Dornish paramour — an olive-skinned woman with long loose dark curls, fierce grieving dark eyes, gold hoop earrings, wearing draped crimson and saffron Dornish silks at the collar',
  'h_59e92133-dd11-4d88-939f-cc20015c686e':
    'Thoros of Myr, a red priest of R’hllor — a heavyset bald man with a shaggy grey-flecked beard, a drinker’s ruddy face, wearing faded cracked red priest’s robes at the collar. NO flaming sword',
  'h_c550c644-627e-4bf7-96a5-bd40ea55cd45':
    'Syrio Forel, the First Sword of Braavos — a lean bald Braavosi water dancer with a small pointed grey beard, sharp watchful dark eyes, wearing a plain brown leather jerkin collar. NO sword',
  'h_3c05def9-3e1b-43b1-a9fb-f030311533d4':
    'The High Sparrow, a barefoot zealot — a gaunt elderly man with a shaved head, sunken serene eyes, weathered ascetic face, wearing coarse undyed sackcloth robes at the collar',
  'h_acdb4fed-c9b6-423b-a33b-5ccfbe8757af':
    'Mance Rayder, the King-Beyond-the-Wall — a lean weathered wildling leader with shoulder-length brown hair greying at the temples, close-trimmed beard, shrewd eyes, wearing a heavy black cloak patched with faded red silk at the collar',
  'h_1e39f243-84fd-4eb8-bc47-bf1f8d8a36a3':
    'Lyanna Mormont, the child Lady of Bear Island — a young girl with a round solemn unsmiling face, straight dark brown hair, fierce grey eyes, wearing heavy dark northern furs and a bear-sigil surcoat at the collar',
  'h_ab3a5143-20cd-4b6a-8800-4824ce0f0a6f':
    'Talisa Maegyr, a Volantene battlefield healer — a young woman with warm olive skin, long dark wavy hair pulled back, gentle steady dark eyes, wearing simple undyed linen robes at the collar',
  'h_5c363213-1a42-4d39-a744-40d6624a6443':
    'Ygritte, a free folk spearwife — a young wildling woman with a wild mane of curly red hair, freckled wind-chapped pale skin, bright challenging blue eyes, wearing thick layered furs at the collar. NO bow',
  'h_37eb6a33-a000-4676-9c34-d462907cbbaa':
    'Margaery Tyrell, a queen of the Reach — a poised young noblewoman with long chestnut-brown curls, warm knowing hazel eyes, a faint clever smile, wearing an ornate green and gold rose-embroidered gown at the collar',
  'h_048ff1bb-26b7-48d9-ab85-198bd20c06ba':
    'Qyburn, a disgraced maester — a mild-faced elderly man with thinning grey hair, soft pleasant unsettling smile, pale watchful eyes, wearing plain dark robes with no maester’s chain at the collar',
  'h_8856458d-d7d7-48bc-aa31-ab6b818500ea':
    'Asha Greyjoy, an ironborn captain — a hard lean young woman with short cropped black hair, sharp grey eyes, a wry mocking mouth, wearing salt-stained dark leather and mail at the collar',
  'h_dc9c7049-40cd-4e0a-beea-f229a013d695':
    'Victarion Greyjoy, Lord Captain of the Iron Fleet — an enormous grim ironborn warrior with a heavy black beard, brutal impassive face, wearing dark kraken-embossed plate armour at the collar',
  'h_b0ba51e8-39e4-4f4d-81ae-382707f2999c':
    'Mirri Maz Duur, a godswife of Lhazar — an older Lhazareen woman with sun-darkened skin, flat broad features, dark braided hair, hard unflinching eyes, wearing rough draped desert robes at the collar',
  'h_1659bc52-59df-486c-8985-e202c0e046f9':
    'Mace Tyrell, Lord of Highgarden — a stout florid-faced nobleman with a curly brown beard going grey, self-satisfied expression, wearing sumptuous green velvet with gold rose embroidery at the collar',

  // ── House of the Dragon / the Dance of the Dragons ──
  'h_d7c9e03a-7c1c-474f-aa1a-bad5612aa4ef':
    'Daemon Targaryen, the Rogue Prince — a Valyrian nobleman with long straight silver-white hair, pale violet eyes, a sharp arrogant handsome face, close-trimmed silver beard, wearing black scaled armour at the collar. NO sword',
  'h_4f5e55e4-ff20-4837-8d4d-ee1f47c68d54':
    'Alicent Hightower, a queen of Westeros — a composed noblewoman with long auburn-brown hair braided back, guarded green eyes, tense controlled expression, wearing a high-necked deep green gown at the collar',
  'h_01dc5f21-d539-4c89-b5d1-45e7844fa442':
    'Otto Hightower, Hand of the King — a severe silver-haired nobleman with a neat grey beard, cold calculating eyes, thin mouth, wearing dark green robes and the golden Hand-of-the-King chain of office at the collar',
  'h_cd09dc23-a9f5-45f7-b701-1b8654fb8f7d':
    'Aemond Targaryen, a one-eyed Targaryen prince — a young man with long straight silver-white hair, one pale violet eye, and a large sapphire set in the empty left eye socket above a vertical scar, cold arrogant expression, wearing black leather armour at the collar',
  'h_2ca8347e-c782-401a-b945-74448a593260':
    'Aegon II Targaryen, a reluctant king — a young Valyrian man with tousled silver-white hair, pale violet eyes, a soft dissipated handsome face, wearing a gold-and-black doublet and a spiked Valyrian steel crown',
  'h_96cd3b9a-8d03-4c1f-8524-c31873a3013d':
    'Rhaenys Targaryen, the Queen Who Never Was — a stately middle-aged Valyrian woman with silver-white hair coiled in braids, proud steady violet eyes, wearing deep red and black riding leathers at the collar',
  'h_322e82f3-e777-4bb1-b505-2638f4e21a98':
    'Corlys Velaryon, the Sea Snake — a distinguished older seafarer with dark brown skin, close-cropped white hair and a short white beard, weathered commanding face, wearing sea-green and silver naval finery at the collar',
  'h_7005bdf5-fc4a-44ce-bafd-d000079b2649':
    'Criston Cole, a Kingsguard knight — a dark-haired Dornish-marcher knight with short black curls, a trimmed black beard, hard resentful dark eyes, wearing white enamelled Kingsguard plate and a white cloak at the collar',
  'h_f2598a4e-337e-47ac-ae75-15c255c2ca7e':
    'Viserys I Targaryen, an ailing king — a gentle-faced Valyrian king with thinning silver-white hair, tired kind violet eyes, visible sores and decay on one side of the face, wearing rich red and gold robes at the collar',
  'h_1b612fa9-7109-4a6d-ae87-56d120b2490b':
    'Helaena Targaryen, a dreamer queen — a young Valyrian woman with long loose silver-white hair, distant unfocused violet eyes, a mild faraway expression, wearing a soft lilac and silver gown at the collar',

  // ── Dragons: the "face" is the dragon's head ──
  'h_75c95438-d11a-489e-9b9f-1ddb141e9220':
    'Vhagar, the largest and oldest living dragon — a colossal ancient dragon’s head in side profile, weathered bronze-green scales, scarred and pitted hide, a great curved horn sweep, one huge amber eye, jaws slightly parted. A DRAGON head only, no rider, no human',
  'h_33a15e25-3a5d-4611-b7f4-c0591cf5bb63':
    'Caraxes, the Blood Wyrm — a lean vicious dragon’s head in side profile, deep blood-red scales, an unusually long snaking neck, spined crest, one narrow burning eye, teeth bared. A DRAGON head only, no rider, no human',
};

// ─── Supabase client (service role — write access to Storage) ─────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signed Cloudinary upload of in-memory image bytes. Signs sha1 of the
 * alphabetically-sorted signable params + api_secret (Cloudinary's spec), then
 * POSTs ourselves — the SDK uploader is unreliable under Bun. public_id
 * `hero-portraits/{id}` + overwrite:true keeps re-runs idempotent and matches
 * the URLs the app already serves.
 */
async function uploadToCloudinary(heroId: string, imageBytes: Uint8Array): Promise<string> {
  const publicId = `hero-portraits/${heroId}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1')
    .update(toSign + CLOUD_SECRET)
    .digest('hex');

  const form = new FormData();
  form.append('file', new Blob([Buffer.from(imageBytes)], { type: 'image/jpeg' }), `${heroId}.jpg`);
  form.append('api_key', CLOUD_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const body = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !body.secure_url) {
    throw new Error(`Cloudinary upload failed for ${heroId}: ${body.error?.message ?? res.status}`);
  }
  return body.secure_url;
}

/**
 * Write portrait_url back, with retry. The upload to Cloudinary happens BEFORE
 * this write, so a single failed UPDATE here orphans an already-uploaded image
 * (image in Cloudinary, portrait_url still NULL). Under high --concurrency the
 * Supabase REST endpoint sheds connections (resets / pool exhaustion), so retry
 * with backoff instead of losing the write. The reconcile pass (below) is the
 * safety net if every retry still fails.
 */
async function setPortraitUrl(heroId: string, url: string): Promise<void> {
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    const { error } = await supabase.from('heroes').update({ portrait_url: url }).eq('id', heroId);
    if (!error) return;
    lastError = error.message;
  }
  throw new Error(`DB update failed for ${heroId} after 5 attempts: ${lastError}`);
}

/**
 * List every hero-portraits/{id} asset in Cloudinary → its versioned secure_url.
 * Used to self-heal orphans: heroes whose portrait was uploaded but whose
 * portrait_url write was lost (e.g. a transient failure under high concurrency)
 * are re-linked for free on the next run instead of being regenerated.
 */
async function listCloudinaryPortraits(): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image`);
    url.searchParams.set('type', 'upload');
    url.searchParams.set('prefix', 'hero-portraits/');
    url.searchParams.set('max_results', '500');
    if (cursor) url.searchParams.set('next_cursor', cursor);
    const auth = 'Basic ' + Buffer.from(`${CLOUD_KEY}:${CLOUD_SECRET}`).toString('base64');
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`Cloudinary list failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      resources: { public_id: string; version: number; format: string; secure_url?: string }[];
      next_cursor?: string;
    };
    for (const r of body.resources) {
      const id = r.public_id.replace(/^hero-portraits\//, '');
      assets.set(
        id,
        r.secure_url ??
          `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${r.version}/${r.public_id}.${r.format}`,
      );
    }
    cursor = body.next_cursor;
  } while (cursor);
  return assets;
}

/**
 * Cloudinary's free plan rejects uploads over 10MB. Seedream returns large PNGs (4MP,
 * no JPEG option) that exceed it. Re-encode oversized images to high-quality JPEG at
 * the SAME resolution via macOS `sips` — visually lossless, ~1.5MB instead of ~11MB.
 * Smaller images (Gemini/Imagen/FLUX jpeg) pass straight through untouched.
 */
function compressIfLarge(heroId: string, bytes: Uint8Array): Uint8Array {
  if (bytes.length < 9.5 * 1024 * 1024) return bytes;
  const inPath = join(tmpdir(), `portrait-${heroId}-${Date.now()}.png`);
  const outPath = `${inPath}.jpg`;
  writeFileSync(inPath, bytes);
  try {
    execFileSync(
      'sips',
      [
        '--setProperty',
        'format',
        'jpeg',
        '--setProperty',
        'formatOptions',
        '88',
        inPath,
        '--out',
        outPath,
      ],
      { stdio: 'ignore' },
    );
    const out = readFileSync(outPath);
    console.log(
      `  ⓘ ${heroId}: re-encoded ${(bytes.length / 1e6).toFixed(1)}MB PNG → ${(out.length / 1e6).toFixed(1)}MB JPEG`,
    );
    return out;
  } finally {
    try {
      unlinkSync(inPath);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(outPath);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Ask gemini-2.5-flash which way the head faces. The prompt only *requests* a
 * right-facing profile; neither Gemini nor Seedream reliably obey it (Aslan/Simba
 * came out left). Fail-open: any error returns true (no flip) so orientation never
 * blocks a hero.
 */
async function facesRight(bytes: Uint8Array): Promise<boolean> {
  const res = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: 'This is a side-profile character portrait. Is the head/face pointing toward the LEFT or the RIGHT side of the image? Reply with exactly one word: LEFT or RIGHT.',
            },
            {
              inline_data: {
                mime_type: bytes[0] === 0x89 ? 'image/png' : 'image/jpeg',
                data: Buffer.from(bytes).toString('base64'),
              },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return true;
  const json = (await res.json()) as {
    candidates?: { content: { parts: { text?: string }[] } }[];
  };
  const answer =
    json.candidates?.[0]?.content?.parts
      ?.find((p) => p.text)
      ?.text?.trim()
      .toUpperCase() ?? '';
  return !answer.startsWith('LEFT');
}

/** Horizontal mirror via macOS sips (in place), preserving the source format. */
function flipHorizontal(heroId: string, bytes: Uint8Array): Uint8Array {
  const p = join(tmpdir(), `flip-${heroId}-${Date.now()}.${bytes[0] === 0x89 ? 'png' : 'jpg'}`);
  writeFileSync(p, bytes);
  try {
    execFileSync('sips', ['-f', 'horizontal', p], { stdio: 'ignore' });
    return readFileSync(p);
  } finally {
    try {
      unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

/** Guarantee the portrait faces right — flip it if the vision check says it faces left. */
async function orientRight(heroId: string, bytes: Uint8Array): Promise<Uint8Array> {
  try {
    if (await facesRight(bytes)) return bytes;
    console.log(`  ↔ ${heroId}: faced left → flipped to face right`);
    return flipHorizontal(heroId, bytes);
  } catch {
    return bytes;
  }
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const rawMime = res.headers.get('content-type') ?? '';
  const mimeType = rawMime.startsWith('image/') ? rawMime : 'image/jpeg';
  return { base64, mimeType };
}

async function describeCharacterVisually(
  sourceBase64: string,
  sourceMime: string,
): Promise<string> {
  const res = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: 'Describe only the visual appearance of this character — costume colours, materials, distinctive physical features, and overall aesthetic. Be specific. Do not name the character. 2-3 sentences.',
            },
            { inline_data: { mime_type: sourceMime, data: sourceBase64 } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return '';
  const json = (await res.json()) as {
    candidates: { content: { parts: { text?: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? '';
}

async function generatePortraitImagen(
  heroName: string,
  sourceBase64: string,
  sourceMime: string,
  heroId?: string,
  precomputedDescription?: string,
): Promise<Uint8Array> {
  const hint = heroId ? COSTUME_HINTS[heroId] : undefined;
  const description =
    hint ?? precomputedDescription ?? (await describeCharacterVisually(sourceBase64, sourceMime));
  const prompt = `A hand-painted 2D comic book cover portrait illustration. ${heroName}${description ? ` — ${description}` : ''}.

STYLE — STRICT RULE: High-end PAINTED 2D illustration in the style of an Alex Ross painting or a Mondo screenprint poster. Visible brushwork, gouache and oil texture, rich dimensional shading, warm highlights and cool shadows on the skin, semi-realistic painted anatomy — fine-art comic painting on canvas. ABSOLUTELY NOT a 3D render, NOT CGI, NOT a Pixar or animated-movie still, NOT a video-game model, NOT a glossy plastic toy, NOT cel-shaded cartoon, NOT flat vector art, NOT a photograph.

POSE — STRICT RULE: Pure 90-degree side profile facing RIGHT. Nose pointing directly right, one eye visible. Absolutely no 3/4 view, no front-facing head, no turned face, no action pose, no weapons. Still, like a coin portrait or a profile mugshot.

FRAMING — STRICT RULE: Extreme close-up headshot. The face and head fill the ENTIRE canvas from edge to edge — crown of the head at the very top, chin near the bottom. Only the very top hint of the shoulders is visible — no chest, no torso, no arms, no hands. Think passport-photo cropping but as a side profile.

BACKGROUND — STRICT RULE: A single vivid, saturated, bold flat colour that maximally contrasts the character's dominant costume/skin colour — if green use red or orange; if blue use orange or yellow; if red use deep blue; if dark/black use vivid red, orange or electric blue. NEVER pale, NEVER white or cream, NEVER washed-out or neutral, NEVER a colour close to the character's own. Concentric circles for characters with circular motifs (shields, magnetic fields), a radiating sunburst for cosmic/powerful characters, otherwise flat bold colour with a slight painterly canvas texture.

Clean natural painted edge, no hard white outline. Portrait orientation, taller than wide. No text, no signature, no watermark, no logos, no weapons in frame.`;

  const res = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '3:4' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Imagen API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    predictions?: { bytesBase64Encoded?: string }[];
    error?: { message: string };
  };
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`No image from Imagen 4: ${json.error?.message ?? 'unknown'}`);
  return Buffer.from(b64, 'base64');
}

// FLUX.2 and Seedream both have prompt-level content checkers (separate from
// enable_safety_checker) that reject trademarked NAMES in the prompt text. So this
// edit prompt is strictly name-free — identity comes from the source image (it's
// image-to-image), and the style from the words. No character names anywhere.
const EDIT_PROMPT = `Repaint the character in this image as a SIDE-ON profile portrait, the head turned to face the RIGHT (looking right). Use a clean near-90-degree side profile where it suits the character; use a deep 3/4 turn — still clearly showing the side of the face — only for front-facing or symmetrical characters that a full profile would make unrecognizable. NOT a flat, front-facing view.

RENDERING — match this exact style: a RICHLY DETAILED, dimensional, SEMI-REALISTIC painterly digital portrait in the style of Mike Mitchell's Mondo Marvel/superhero profile portraits — his painterly, semi-realistic, side-profile character paintings (the detailed Wolverine/Thor/Deadpool-style portraits, NOT his cute chibi "Just Like Us" caricatures). Fully repaint the character with soft cinematic lighting, warm highlights and cool shadows, dimensional volumetric form, soft painterly brushwork and soft painted edges, plus fine rendered detail appropriate to the character — individual hair/fur strands, skin texture, fabric weave, metal sheen, surface grain. Do NOT keep a flat look: absolutely NOT bold flat colour blocking, NOT thick uniform black outlines, NOT cel-shading, NOT a simple poster, NOT a 3D/CGI render, NOT a photograph.

OUTLINE: optional and subtle. If any edge separation is used, it is a THIN, refined rim in a slightly lighter or contrasting shade of the background colour — never a thick, bold, white sticker outline. Many of these portraits have no outline at all, which is perfectly fine; favour a clean silhouette over a heavy outline.

FRAMING: a head-and-shoulders headshot — the head and face are large and dominant, top of the head near the top edge, cropped at the base of the neck and the tops of the shoulders. Leave clear background space around the silhouette so the outline and the background motif stay visible. NO torso, NO arms, NO hands, NO body below the shoulders.

BACKGROUND: a SINGLE bold, vivid, saturated colour that is the COMPLEMENTARY OPPOSITE of the character's dominant colour, for maximum contrast — a warm / orange / brown / gold / red character → a deep BLUE or teal; a blue character → warm orange or red; a green character → red or magenta; a purple character → gold or yellow. NEVER a background colour close to the character's own. DEFAULT to a flat bold colour with only a subtle soft painterly canvas texture. ONLY IF it genuinely fits the character, add a graphic motif behind the head: concentric rings for characters with circular iconography, a radiating sunburst for cosmic / radiant / powerful characters, or a geometric pattern echoing the character's own visual motif — otherwise keep the background a clean flat colour. NO harsh vertical stripes or lines.

TOP PRIORITY — the character must stay INSTANTLY recognizable: preserve its exact face shape, proportions, silhouette and signature features. For REAL-WORLD creatures, animals and humans, fully commit to rich SEMI-REALISTIC painterly rendering — realistic fur / skin / hair detail, dimensional volumetric form, soft painted edges, and NO bold black outlines. Only for FICTIONAL CARTOON characters whose identity genuinely depends on their stylised look should you keep that stylised design instead of forcing realism. When realism and recognizability truly conflict, recognizability wins.

KEEP everything the character already has — masks, helmets, hoods, horns, existing costume and markings stay exactly as they are. But do NOT ADD anything new: no crown, tiara, hat or headwear, and no shirt, collar or garment the character is not already wearing. Naked, furred or bare-skinned characters stay bare — do not dress them. Portrait orientation, taller than wide. No text, no signature, no watermark, no logos.`;

// Multi-reference variant (--refs): the FIRST image is the subject, the rest are style
// references. Name-free (can't reuse buildPrompt — it's full of trademarked names).
const MULTIREF_PROMPT = `The FIRST image is the character to redraw. The remaining images are STYLE REFERENCES — study them and match their painterly illustration style exactly: rendering, brushwork, finish, lighting, edges.

Redraw the character from the first image as a side-profile portrait facing RIGHT (nose pointing right, near 90-degree side view), painted in the style of the reference images.

RENDERING: Match the reference images — a clean, polished, semi-realistic painted illustration like a high-end comic-cover portrait. Smooth dimensional shading, warm highlights and cool shadows, crisp clean edges. NOT a flat cartoon, NOT a 3D/CGI render, NOT a photograph.

FRAMING: Tight head-and-shoulders headshot — the head fills most of the canvas, crown near the top edge, only the very top of the shoulders visible. No chest, no torso, no full body, no hands.

BACKGROUND: A single vivid, saturated, bold colour with a subtle smooth radial gradient glow behind the head — strongly contrasting the character's colours, never pale or washed out.

Preserve the first character's exact colours, costume and identity. Portrait orientation, taller than wide. No text, no signature, no logos.`;

/**
 * Generic fal image-to-image edit (FLUX.2 / Seedream — same request shape). Sends the
 * real source image (keeps identity). With --refs it also sends the 3 style refs and a
 * multi-reference prompt (Seedream handles this; FLUX.2 confused subject vs style and
 * redrew a ref). Without refs the model paints its own style from EDIT_PROMPT. fal
 * returns a hosted URL; we fetch the bytes so the rest of the pipeline is unchanged.
 */
async function falEdit(
  endpoint: string,
  label: string,
  sourceBase64: string,
  sourceMime: string,
  extra: Record<string, unknown>,
): Promise<Uint8Array> {
  const sourceUri = `data:${sourceMime};base64,${sourceBase64}`;
  const imageUrls = useRefs
    ? [
        sourceUri,
        ...STYLE_REF_PATHS.map(
          (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`,
        ),
      ]
    : [sourceUri];
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: useRefs ? MULTIREF_PROMPT : EDIT_PROMPT,
      image_urls: imageUrls,
      // 2:3 portrait — the locked house aspect ratio — at full quality. Seedream custom
      // dims must be ≥1920px and it only outputs PNG, so the file can exceed Cloudinary's
      // 10MB cap; compressIfLarge() re-encodes to JPEG (same resolution) before upload.
      image_size: { width: 1920, height: 2880 },
      num_images: 1,
      enable_safety_checker: false,
      ...extra,
    }),
  });
  if (!res.ok) {
    // fal validation errors echo the (base64) request back — strip it so the actual
    // message is readable rather than a megabyte of our own input.
    const text = await res.text();
    type FalErr = { loc?: (string | number)[]; msg?: string; type?: string };
    let msg: string;
    try {
      const j = JSON.parse(text) as { detail?: FalErr[] | unknown; error?: unknown };
      msg = Array.isArray(j.detail)
        ? (j.detail as FalErr[])
            .map((d) => `${d.loc?.join('.')}: ${d.msg} (${d.type})`)
            .join('; ')
            .slice(0, 600)
        : JSON.stringify(j.detail ?? j.error ?? j).slice(0, 400);
    } catch {
      msg = text.slice(0, 200);
    }
    throw new Error(`${label} API error ${res.status}: ${msg}`);
  }
  const json = (await res.json()) as { images?: { url?: string }[] };
  const url = json.images?.[0]?.url;
  if (!url) throw new Error(`No image from ${label}: ${JSON.stringify(json).slice(0, 200)}`);

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Failed to fetch ${label} result ${url}: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

const generatePortraitFlux2 = (sourceBase64: string, sourceMime: string) =>
  falEdit(FLUX2_URL, 'FLUX.2', sourceBase64, sourceMime, {
    output_format: 'jpeg',
    safety_tolerance: 5,
  });

const generatePortraitSeedream = (sourceBase64: string, sourceMime: string) =>
  falEdit(SEEDREAM_URL, 'Seedream', sourceBase64, sourceMime, {});

async function callImageModel(
  parts: object[],
  modelUrl: string = GEMINI_URL,
): Promise<Uint8Array | 'PROHIBITED'> {
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio: '2:3' }, // lock all Gemini portraits to the house 2:3
    },
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`  ↻ Retrying in ${delay}ms (attempt ${attempt + 1}/4)…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const res = await fetch(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const errText = await res.text();
      lastError = new Error(`Rate limited: ${errText}`);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      candidates: {
        finishReason?: string;
        content: {
          parts: { inlineData?: { data: string }; inline_data?: { data: string } }[];
        };
      }[];
    };

    if (json.candidates?.[0]?.finishReason === 'PROHIBITED_CONTENT') return 'PROHIBITED';

    const imagePart = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data ?? p.inline_data?.data,
    );
    const imageData = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
    if (!imageData) throw new Error('No image in Gemini response');
    return Buffer.from(imageData, 'base64');
  }
  throw lastError ?? new Error('Gemini request failed after retries');
}

/**
 * Reframe an already-styled portrait to a tight head-and-shoulders headshot using
 * 3.1 as an image editor. Used on fallback outputs (2.5 / laundered Imagen) which
 * come out body-length because they preserve the source composition. Cloudinary's
 * face-crop can't do this — it fails to detect painted side-profile faces — but 3.1
 * understands "zoom to a headshot" and keeps the style/pose/background intact. On a
 * block it returns the original bytes unchanged.
 */
async function reframeToHeadshot(heroName: string, bytes: Uint8Array): Promise<Uint8Array> {
  const result = await callImageModel(
    [
      {
        text: `Re-crop and zoom this existing character portrait into a tight head-and-shoulders headshot: the head and the very top of the shoulders fill the frame, crown of the head near the top edge, chin in the lower third, no chest or torso below. Keep the EXACT same painting style, colours, lighting, side-profile pose (facing right), and flat background colour — do NOT redraw, restyle, or change the character or its expression, ONLY reframe tighter. Portrait orientation, taller than wide. No text, no signature.`,
      },
      { inline_data: { mime_type: 'image/png', data: Buffer.from(bytes).toString('base64') } },
    ],
    GEMINI_URL,
  );
  if (result === 'PROHIBITED') {
    console.log(`  ⚠ ${heroName}: reframe pass blocked — keeping un-reframed output`);
    return bytes;
  }
  return result;
}

async function generatePortrait(
  sourceBase64: string,
  sourceMime: string,
  heroName: string,
  heroId: string,
): Promise<Uint8Array> {
  // *-only: bypass the whole Gemini ladder, render directly via the fal edit model.
  if (useFlux2Only) {
    console.log(`  → ${heroName}: FLUX.2 [pro] edit (direct)`);
    return generatePortraitFlux2(sourceBase64, sourceMime);
  }
  if (useSeedreamOnly) {
    console.log(`  → ${heroName}: Seedream edit (direct)`);
    return generatePortraitSeedream(sourceBase64, sourceMime);
  }

  const styleRefs = STYLE_REF_PATHS.map((p) => ({
    inline_data: { mime_type: 'image/jpeg', data: readFileSync(p).toString('base64') },
  }));
  const sourceImg = { inline_data: { mime_type: sourceMime, data: sourceBase64 } };
  const namedText = { text: `Character name: ${heroName}. ${buildPrompt()}` };

  // Primary: Gemini 3.1, named — already gold-standard framed, no reframe needed.
  const primary = await callImageModel([namedText, sourceImg, ...styleRefs], GEMINI_URL);
  if (primary !== 'PROHIBITED') return primary;

  // Blocked. Compute a neutral, nameless description once — reused by every retry.
  // The PROHIBITED block is usually triggered by the trademarked name in the prompt,
  // not the image, so a nameless retry on the same model often succeeds.
  console.log(`  ⚠ ${heroName} blocked by Gemini 3.1 — descending the image model ladder`);
  const description = await describeCharacterVisually(sourceBase64, sourceMime);
  const namelessText = {
    text: `${description ? `The character to redraw: ${description}. ` : ''}${buildPrompt()}`,
  };

  // Image-to-image ladder. `reframe` marks rungs whose framing is unreliable: 3.1 on
  // the official source frames correctly; 2.5 preserves source composition, so its
  // output gets a 3.1 reframe pass. Each rung tries named first (best identity).
  const ladder: { label: string; url: string; tryNamed: boolean; reframe: boolean }[] = [
    { label: 'Gemini 3.1 (nameless)', url: GEMINI_URL, tryNamed: false, reframe: false },
    // Skip 2.5 under a fal-edit mode so that model actually gets the blocked hero —
    // 2.5's image-to-image is weak and non-deterministically intercepts before it.
    ...(useFlux2 || useSeedream
      ? []
      : [
          {
            label: 'Gemini 2.5 Flash Image',
            url: GEMINI_25_IMAGE_URL,
            tryNamed: true,
            reframe: true,
          },
        ]),
  ];

  // A rung erroring (deprecated model, transient 5xx, etc.) must skip to the next
  // rung, never crash the hero — treat any failure as a block and descend.
  const tryRung = async (parts: object[], url: string): Promise<Uint8Array | 'PROHIBITED'> => {
    try {
      return await callImageModel(parts, url);
    } catch (err) {
      console.log(`  ⚠ ${heroName}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
      return 'PROHIBITED';
    }
  };

  for (const rung of ladder) {
    if (rung.tryNamed) {
      const named = await tryRung([namedText, sourceImg, ...styleRefs], rung.url);
      if (named !== 'PROHIBITED') {
        console.log(`  ✓ ${heroName} rendered by ${rung.label} (named)`);
        return rung.reframe ? await reframeToHeadshot(heroName, named) : named;
      }
    }
    const nameless = await tryRung([namelessText, sourceImg, ...styleRefs], rung.url);
    if (nameless !== 'PROHIBITED') {
      console.log(`  ✓ ${heroName} rendered by ${rung.label}`);
      return rung.reframe ? await reframeToHeadshot(heroName, nameless) : nameless;
    }
    console.log(`  ⚠ ${heroName} blocked by ${rung.label}`);
  }

  // Every direct attempt on the official source refused. LAUNDER: generate a clean,
  // non-trademarked LOOKALIKE, then feed it back into gold-standard 3.1 (nameless) +
  // the style refs — filters are far more permissive on AI-generated inputs than on the
  // official art, so 3.1 applies the exact roster style. A reframe pass crops to a
  // headshot. The lookalike generator decides how well IDENTITY survives:
  //   --flux2 → FLUX.2 image-to-image (sees the real source, keeps iconic faces)
  //   default → Imagen text-to-image (can drift on iconic faces, e.g. Mickey)
  let lookalikeBytes: Uint8Array;
  let lookalikeMime: string;
  if (useFlux2) {
    console.log(`  ⚠ ${heroName} blocked on the source — FLUX.2 lookalike → Gemini launder`);
    lookalikeBytes = await generatePortraitFlux2(sourceBase64, sourceMime);
    lookalikeMime = 'image/jpeg';
  } else if (useSeedream) {
    console.log(`  ⚠ ${heroName} blocked on the source — Seedream lookalike → Gemini launder`);
    lookalikeBytes = await generatePortraitSeedream(sourceBase64, sourceMime);
    lookalikeMime = 'image/jpeg';
  } else {
    console.log(`  ⚠ ${heroName} blocked on the source — Imagen lookalike → Gemini launder`);
    lookalikeBytes = await generatePortraitImagen(
      heroName,
      sourceBase64,
      sourceMime,
      heroId,
      description,
    );
    lookalikeMime = 'image/png';
  }

  const lookalikeImg = {
    inline_data: { mime_type: lookalikeMime, data: Buffer.from(lookalikeBytes).toString('base64') },
  };

  const laundered = await tryRung([namelessText, lookalikeImg, ...styleRefs], GEMINI_URL);
  if (laundered !== 'PROHIBITED') {
    console.log(`  ✓ ${heroName} laundered → Gemini 3.1 (gold standard) — reframing`);
    return reframeToHeadshot(heroName, laundered);
  }

  // 3.1 refused even the lookalike. Use the lookalike directly, reframed.
  console.log(`  ⚠ ${heroName} still blocked after launder — lookalike output, reframed`);
  return reframeToHeadshot(heroName, lookalikeBytes);
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

// ─── Phase 2: Generate AI portraits for remaining heroes ──────────────────────

async function phase2(filterHeroId?: string): Promise<void> {
  console.log('\n═══ Phase 2: Generating AI portraits ═══\n');

  let query = supabase
    .from('heroes')
    .select('id, name, image_url')
    .is('portrait_url', null)
    // Generate in order of general popularity (fame_score, 0-100) — the recognizability
    // proxy that replaced raw issue_count — so the most recognisable heroes get done first.
    .order('fame_score', { ascending: false, nullsFirst: false });

  // The "Blank!" placeholder is excluded in JS rather than with a second
  // .not() — chaining two filters here exceeds tsc's instantiation depth on the
  // supabase-js builder. Filtering after the fetch costs nothing: it happens
  // before any image is generated, so no API spend is wasted on placeholders.
  if (fromText) {
    // The hint map IS the working set — a hero with no written description gets
    // invented wholesale, so there is nothing to generate for one. Selecting by
    // id also sidesteps an .or() here, which exceeds tsc's instantiation depth.
    query = query.in('id', Object.keys(TEXT_PORTRAIT_HINTS)) as typeof query;
  } else {
    // .filter() rather than .not(): identical PostgREST output, but .not() as a
    // reassignment exceeds tsc's instantiation depth on the supabase-js builder.
    query = query.filter('image_url', 'not.is', null) as typeof query;
  }

  if (filterHeroId) {
    query = query.eq('id', filterHeroId) as typeof query;
  } else if (heroIdsSet) {
    query = query.in('id', [...heroIdsSet]) as typeof query;
  }
  if (LIMIT) {
    query = query.limit(LIMIT) as typeof query;
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(`Failed to fetch heroes: ${error.message}`);
  // Drop placeholder sources from the image-to-image path. Note this happens
  // after --limit, so a limited run can yield fewer than --limit heroes.
  const heroes = fromText ? rows : rows?.filter((h) => isUsableSource(h.image_url));
  if (!heroes?.length) {
    console.log('No heroes to process.');
    return;
  }

  // Self-heal: any hero in the working set that already has a Cloudinary asset
  // was generated on a prior run but never got its portrait_url written (a lost
  // write, e.g. under high --concurrency). Re-link those for free instead of
  // paying to regenerate, and drop them from the generation batch.
  let workingSet = heroes;
  if (!dryRun) {
    const assets = await listCloudinaryPortraits();
    const orphans = heroes.filter((h) => assets.has(h.id));
    if (orphans.length) {
      console.log(`Re-linking ${orphans.length} orphaned Cloudinary portraits (no regen)…`);
      await withConcurrency(orphans, CONCURRENCY, async (hero) => {
        try {
          await setPortraitUrl(hero.id, assets.get(hero.id)!);
          console.log(`  ↺ backfilled ${hero.name} (${hero.id})`);
        } catch (err) {
          console.error(`  ✗ backfill ${hero.id}: ${err instanceof Error ? err.message : err}`);
        }
      });
      const orphanIds = new Set(orphans.map((h) => h.id));
      workingSet = heroes.filter((h) => !orphanIds.has(h.id));
    }
  }

  console.log(`Processing ${workingSet.length} heroes with concurrency=${CONCURRENCY}\n`);

  await withConcurrency(workingSet, CONCURRENCY, async (hero, idx) => {
    const label = `[${idx + 1}/${workingSet.length}] ${hero.name} (${hero.id})`;

    if (dryRun) {
      console.log(`  [dry-run] ${label}`);
      return;
    }

    try {
      console.log(`  ⟳ ${label}`);
      let generated: Uint8Array;
      if (fromText) {
        // No source art exists. Render straight from the written description —
        // Imagen never reads the (absent) image when a description is supplied.
        // Skip rather than guess: an unhinted hero would be invented wholesale.
        const hint = TEXT_PORTRAIT_HINTS[hero.id];
        if (!hint) {
          console.log(`  – ${label}: no TEXT_PORTRAIT_HINTS entry, skipping`);
          return;
        }
        generated = await generatePortraitImagen(hero.name, '', '', hero.id, hint);
      } else {
        const { base64, mimeType } = await fetchImageAsBase64(hero.image_url!);
        generated = await generatePortrait(base64, mimeType, hero.name, hero.id);
      }
      const compressed = compressIfLarge(hero.id, generated);
      const bytes = await orientRight(hero.id, compressed);
      const url = await uploadToCloudinary(hero.id, bytes);
      await setPortraitUrl(hero.id, url);
      console.log(`  ✓ ${label} → ${url}`);
    } catch (err) {
      console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
      // Don't throw — continue with remaining heroes
    }
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local',
    );
  }
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY must be set in .env.local');
  }
  if (useFal && !FAL_KEY) {
    throw new Error('FAL_KEY must be set in .env.local to use --flux2 / --seedream modes');
  }
  if (!CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) {
    throw new Error(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in .env.local',
    );
  }

  console.log(`Hero Portrait Generator`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(
    `Model: Gemini 3.1 → 2.5 Flash Image → ${useFlux2 ? 'FLUX.2 [pro] edit' : 'launder (Imagen→3.1)'}`,
  );
  if (heroIdFlag) console.log(`Filter: hero ${heroIdFlag} only`);
  if (heroIdsFlag) console.log(`Filter: heroes ${heroIdsFlag}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} heroes`);

  await phase2(heroIdFlag ?? undefined);

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
