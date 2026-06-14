// generate-hero-portrait: AI portrait for ONE hero, on demand from the command
// center's Portraits runner. Mirrors scripts/generate-portraits.ts:
//   source image (image_url) + 3 style refs -> Gemini 3.1 Flash Image style
//   transfer (Imagen 4 fallback if the content filter blocks it) -> upload to
//   Cloudinary (hero-portraits/{id}, signed) -> write portrait_url.
// Idempotent: a hero that already has a portrait is skipped. Costs Gemini money,
// so the client gates this behind the monthly budget before ever calling it.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '';
const CLOUD_KEY = Deno.env.get('CLOUDINARY_API_KEY') ?? '';
const CLOUD_SECRET = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';

const GEMINI = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
const IMAGEN_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;

// Heroes whose curated Cloudinary portraits serve as the style references
// (Wolverine, Deadpool, Thor — the proven painterly side-profile look).
const STYLE_REF_IDS = ['717', '213', '659'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

function buildPrompt(heroName: string): string {
  return `Character name: ${heroName}. The first image is the character to redraw. Images 2, 3, and 4 are style reference illustrations — study every detail and match the style exactly.

Redraw the character from image 1 as a strict pure side-profile portrait facing RIGHT (nose pointing right, pure 90-degree side view, exactly as in the references).

RENDERING: Painterly digital illustration — rich dimensional depth, visible surface quality. Skin has warm highlights, cool shadows, subtle colour variation. Costume materials feel real: fabric has texture, metal has sheen, leather has gloss. Exactly like the references — NOT flat vector, NOT plain cartoon.

BACKGROUND: Pick the single most iconic, vivid, saturated colour associated with this character and a style that fits them (flat bold colour, concentric rings for circular motifs, radiating sunburst for cosmic characters, or a geometric pattern referencing their motif). It MUST strongly contrast with the character's costume and skin. Strong clean outline separating background from silhouette, slight painterly texture.

FRAMING: HEADSHOT — the face and head fill the entire canvas, like a coin portrait. Chin ~15% from the bottom, top of head ~10% from the top. Zero chest, zero torso. Portrait orientation (taller than wide).

The character MUST face RIGHT. Preserve costume colours and identity exactly. No text, no logos.`;
}

async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const mime = res.headers.get('content-type') ?? '';
  return { base64: btoa(binary), mimeType: mime.startsWith('image/') ? mime : 'image/jpeg' };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Signed Cloudinary upload of in-memory bytes → secure_url (same scheme the app
// serves and the generate-portraits script writes: hero-portraits/{id}).
async function uploadToCloudinary(heroId: string, bytes: Uint8Array): Promise<string> {
  const publicId = `hero-portraits/${heroId}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha1Hex(`overwrite=true&public_id=${publicId}&timestamp=${timestamp}${CLOUD_SECRET}`);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), `${heroId}.jpg`);
  form.append('api_key', CLOUD_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('overwrite', 'true');
  form.append('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
  const body = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !body.secure_url) throw new Error(`cloudinary ${res.status}: ${body.error?.message ?? 'no secure_url'}`);
  return body.secure_url;
}

type ImgPart = { inline_data: { mime_type: string; data: string } };

// Gemini 3.1 Flash Image style transfer. Returns bytes, or 'PROHIBITED' if the
// content filter blocks the character (villains often trip it → Imagen fallback).
async function geminiStyleTransfer(parts: (ImgPart | { text: string })[]): Promise<Uint8Array | 'PROHIBITED'> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    const res = await fetch(GEMINI('gemini-3.1-flash-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }),
    });
    if (res.status === 429) { lastErr = new Error('rate limited'); continue; }
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ inlineData?: { data: string }; inline_data?: { data: string } }> } }>;
    };
    if (j.candidates?.[0]?.finishReason === 'PROHIBITED_CONTENT') return 'PROHIBITED';
    const p = j.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data ?? x.inline_data?.data);
    const data = p?.inlineData?.data ?? p?.inline_data?.data;
    if (!data) throw new Error('no image in gemini response');
    return b64ToBytes(data);
  }
  throw lastErr ?? new Error('gemini failed after retries');
}

async function describeCharacter(base64: string, mime: string): Promise<string> {
  const res = await fetch(GEMINI('gemini-2.5-flash'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: 'Describe only the visual appearance of this character — costume colours, materials, distinctive physical features. Do not name the character. 2-3 sentences.' },
        { inline_data: { mime_type: mime, data: base64 } },
      ] }],
    }),
  });
  if (!res.ok) return '';
  const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return j.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? '';
}

// Fallback when Gemini refuses: Imagen 4 from a text description (no source image).
async function imagenFromDescription(heroName: string, base64: string, mime: string): Promise<Uint8Array> {
  const description = await describeCharacter(base64, mime);
  const prompt = `Limited edition Mondo poster art. ${heroName}${description ? ` — ${description}` : ''}. Pure 90-degree side profile facing RIGHT, one eye visible, still like a coin portrait. Extreme close-up headshot: the face and head fill the ENTIRE canvas, only the very top of the shoulders visible. Clean painterly digital illustration, graphic poster quality. Background: a single vivid bold colour that maximally contrasts the character's costume/skin. No hard white outline, portrait orientation, no text, no logos, no weapons.`;
  const res = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '3:4' } }),
  });
  if (!res.ok) throw new Error(`imagen ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { predictions?: Array<{ bytesBase64Encoded?: string }>; error?: { message: string } };
  const b64 = j.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`no image from imagen: ${j.error?.message ?? 'unknown'}`);
  return b64ToBytes(b64);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not set' }, 500);
  if (!CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) return json({ error: 'Cloudinary secrets not set' }, 500);

  try {
    const { heroId } = (await req.json()) as { heroId: string };
    if (!heroId) return json({ error: 'heroId required' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Admin gate: verify_jwt only proves the caller is signed in. This spends
    // Gemini money, so require an actual admin (not just any registered user).
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await sb.auth.getUser(jwt);
    const uid = auth?.user?.id;
    if (!uid) return json({ error: 'unauthorized' }, 401);
    const { data: prof } = await sb.from('user_profiles').select('is_admin').eq('id', uid).maybeSingle();
    if (!(prof as { is_admin?: boolean } | null)?.is_admin) return json({ error: 'forbidden' }, 403);

    const { data: hero, error } = await sb
      .from('heroes')
      .select('id, name, image_url, portrait_url')
      .eq('id', heroId)
      .maybeSingle();
    if (error || !hero) return json({ error: 'hero not found' }, 404);
    if (hero.portrait_url) return json({ skipped: true, message: 'already has a portrait' });
    if (!hero.image_url) return json({ skipped: true, message: 'no source image' });

    const source = await fetchAsBase64(hero.image_url as string);

    // Style refs (curated Cloudinary portraits). Fetched fresh each call.
    const { data: refRows } = await sb.from('heroes').select('id, portrait_url').in('id', STYLE_REF_IDS);
    const refUrls = (refRows ?? [])
      .map((r) => (r as { portrait_url: string | null }).portrait_url)
      .filter((u): u is string => !!u);
    const styleRefs: ImgPart[] = [];
    for (const u of refUrls) {
      const r = await fetchAsBase64(u);
      styleRefs.push({ inline_data: { mime_type: r.mimeType, data: r.base64 } });
    }

    let bytes = await geminiStyleTransfer([
      { text: buildPrompt(hero.name as string) },
      { inline_data: { mime_type: source.mimeType, data: source.base64 } },
      ...styleRefs,
    ]);
    if (bytes === 'PROHIBITED') {
      bytes = await imagenFromDescription(hero.name as string, source.base64, source.mimeType);
    }

    const url = await uploadToCloudinary(heroId, bytes);
    const { error: upErr } = await sb.from('heroes').update({ portrait_url: url }).eq('id', heroId);
    if (upErr) throw new Error(`db: ${upErr.message}`);

    return json({ url });
  } catch (err) {
    console.error('[generate-hero-portrait]', err);
    return json({ error: String(err) }, 500);
  }
});
