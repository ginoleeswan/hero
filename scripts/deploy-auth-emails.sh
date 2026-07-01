#!/usr/bin/env bash
#
# Deploy Mythique's Supabase auth email templates to the linked project.
#
# Uses the Management API to PATCH *only* the mailer template + subject fields
# (surgical / non-destructive) — it does NOT touch OAuth, SMTP, redirect URLs,
# or any other auth setting. This is deliberately NOT `supabase config push`,
# which would reset unlisted dashboard settings to CLI defaults.
#
# Deploys 5 of 6 templates. `password-changed.html` is intentionally excluded:
# Supabase/GoTrue has no native "password changed" email — it must be sent by a
# custom DB trigger + Brevo, separately.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=<personal-access-token> bash scripts/deploy-auth-emails.sh
#   # optional dry run (prints sizes, sends nothing):
#   SUPABASE_ACCESS_TOKEN=<token> bash scripts/deploy-auth-emails.sh --dry-run
#
# Get a token at: https://supabase.com/dashboard/account/tokens

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES_DIR="$DIR/supabase/email-templates"
REF="$(cat "$DIR/supabase/.temp/project-ref" 2>/dev/null || echo "")"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ "$DRY_RUN" != "1" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN is not set."
  echo "   Generate one at https://supabase.com/dashboard/account/tokens then re-run:"
  echo "   SUPABASE_ACCESS_TOKEN=<token> bash scripts/deploy-auth-emails.sh"
  exit 1
fi
if [ -z "$REF" ]; then
  echo "❌ Could not read project ref from supabase/.temp/project-ref."
  echo "   Run \`supabase link\` first, or set REF manually in this script."
  exit 1
fi

echo "Project: $REF"
echo "Templates: $TEMPLATES_DIR"
[ "$DRY_RUN" = "1" ] && echo "(dry run — nothing will be sent)"
echo

DRY_RUN="$DRY_RUN" REF="$REF" TEMPLATES_DIR="$TEMPLATES_DIR" python3 <<'PY'
import json, os, sys, urllib.request, urllib.error

ref = os.environ["REF"]
tdir = os.environ["TEMPLATES_DIR"]
token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
dry = os.environ["DRY_RUN"] == "1"

# Supabase auth template key -> (source file, inbox subject)
TEMPLATES = {
    "confirmation": ("confirm-signup.html", "Confirm your email — Mythique"),
    "magic_link":   ("magic-link.html",     "Your sign-in link — Mythique"),
    "recovery":     ("reset-password.html", "Reset your password — Mythique"),
    "invite":       ("invite.html",         "You're invited to Mythique"),
    "email_change": ("change-email.html",   "Confirm your new email — Mythique"),
}

body = {}
for key, (fname, subject) in TEMPLATES.items():
    with open(os.path.join(tdir, fname), encoding="utf-8") as f:
        html = f.read()
    body[f"mailer_subjects_{key}"] = subject
    body[f"mailer_templates_{key}_content"] = html
    print(f"  {key:13s} <- {fname:22s} ({len(html):>6,} bytes)  subject: {subject!r}")

if dry:
    print("\nDry run complete — no request sent.")
    sys.exit(0)

url = f"https://api.supabase.com/v1/projects/{ref}/config/auth"
data = json.dumps(body).encode("utf-8")
req = urllib.request.Request(url, data=data, method="PATCH", headers={
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
})
try:
    with urllib.request.urlopen(req) as resp:
        print(f"\n✅ PATCH {resp.status} — 5 templates deployed to live auth.")
except urllib.error.HTTPError as e:
    print(f"\n❌ PATCH failed: {e.code} {e.reason}")
    print(e.read().decode("utf-8", "replace")[:500])
    sys.exit(1)
PY

echo
echo "Done. password-changed.html was NOT deployed (no native Supabase email — needs a custom Brevo send)."
