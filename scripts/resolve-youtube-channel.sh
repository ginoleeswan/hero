#!/usr/bin/env bash
#
# resolve-youtube-channel.sh — turn a YouTube @handle into a VERIFIED channel id
# for supabase/migrations/…_media_channels, which sync-channel-videos reads.
#
#   ./scripts/resolve-youtube-channel.sh A24 Pixar Crunchyroll
#
# Why this exists rather than "look up the id":
#
#   * Recalling ids does not work. Ten were written from memory while building
#     this pipeline and NINE were wrong — not wrong in a way that errors, wrong
#     in the way that silently returns somebody else's channel.
#   * Scraping the first `"channelId"` from the handle page does not work either.
#     That is frequently a FEATURED channel: @UniversalPictures gives Illumination,
#     @Ubisoft gives Rainbow 6, @Max gives a band called Party Pupils.
#
# So: read the canonical link, which is the page's own channel, and then FETCH
# THE FEED AND PRINT THE NAME BACK. The read-back is the actual check — it is
# what caught @DC resolving to a channel called "LOl Rekt". Never paste an id
# into a migration without reading the name this prints.
#
# A wrong id here is a channel that is simply never heard from — the same silent
# failure as a wrong enwiki_title in watched_events. No error, no empty result,
# just news that never arrives.

set -uo pipefail

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <handle> [handle...]   (handles without the @)" >&2
  exit 64
fi

status=0

for handle in "$@"; do
  html=$(curl -s --max-time 20 -A "$UA" -H 'Accept-Language: en-US,en;q=0.9' \
    "https://www.youtube.com/@${handle}")

  id=$(printf '%s' "$html" \
    | grep -o 'rel="canonical" href="https://www.youtube.com/channel/UC[A-Za-z0-9_-]\{22\}"' \
    | head -1 | grep -o 'UC[A-Za-z0-9_-]\{22\}')

  if [ -z "$id" ]; then
    printf 'UNRESOLVED  @%s — no canonical channel link (renamed, region-gated, or no such handle)\n' "$handle" >&2
    status=1
    continue
  fi

  feed=$(curl -s --max-time 20 "https://www.youtube.com/feeds/videos.xml?channel_id=${id}")
  entries=$(printf '%s' "$feed" | grep -c '<entry>')
  name=$(printf '%s' "$feed" | sed -n 's:.*<title>\([^<]*\)</title>.*:\1:p' | head -1)

  # Entry count, not just a name: a 404 page still has a <title>, so the name
  # alone will happily report "Error 404 (Not Found)!!1" as a success.
  if [ "${entries:-0}" -eq 0 ]; then
    printf 'UNVERIFIED  @%s → %s — feed returned no entries, do NOT use\n' "$handle" "$id" >&2
    status=1
    continue
  fi

  printf "('%s', '%s', '%s', true),   -- @%s, %s entries\n" \
    "$id" "${name//\'/\'\'}" "$handle" "$handle" "$entries"
done

exit "$status"
