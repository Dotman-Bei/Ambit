#!/usr/bin/env bash
# §0.5 Secret scan. Refuses a commit that carries key material.
#
# Runs against STAGED content rather than the working tree: a secret removed from the file after
# `git add` is still in the commit, and scanning the working tree would miss it.
#
# The value pattern deliberately requires the first character after `=` to be a literal — not `$`,
# not a quote followed by `$`. That distinguishes
#
#     DYNAMIC_API_KEY=dyn_live_abc123                       <- a real secret, refused
#     CREDENTIAL_ENCRYPTION_KEY="${CREDENTIAL_ENCRYPTION_KEY:-$(openssl rand -base64 32)}"
#                                                           <- a runtime expansion, allowed
#
# Narrowing it this way rather than adding path exceptions keeps the check meaningful: a real
# secret in start.sh would still be caught. A hook that gets routinely skipped is a hook that is
# not running.
set -euo pipefail

NAMES='DYNAMIC_API_KEY|DYNAMIC_WEBHOOK_SECRET|CREDENTIAL_ENCRYPTION_KEY|DELEGATION_PRIVATE_KEY|PRIVATE_KEY'
# A literal value: optional quote, then a character that is not $, quote, whitespace or a brace.
LITERAL_ASSIGN="(${NAMES})[[:space:]]*=[[:space:]]*[\"']?[^\$\"'[:space:]{]"
KEY_MATERIAL='-----BEGIN [A-Z ]*PRIVATE KEY-----'
KEYSHARE='keyShare["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9+/=]{16,}'

PATTERNS="${LITERAL_ASSIGN}|${KEY_MATERIAL}|${KEYSHARE}"

staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
[ -z "$staged" ] && exit 0

found=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  # .env.example carries empty placeholders by design; a filled-in one is what this stops.
  [ "$file" = ".env.example" ] && continue
  # The scanner necessarily contains the patterns it looks for.
  [ "$file" = "scripts/scan-secrets.sh" ] && continue

  if git show ":$file" 2>/dev/null | grep -nEq "$PATTERNS"; then
    echo "SECRET SCAN: $file matches a secret pattern." >&2
    git show ":$file" | grep -nE "$PATTERNS" | head -3 | sed 's/^/    /' >&2
    found=1
  fi
done <<< "$staged"

if [ "$found" -eq 1 ]; then
  cat >&2 <<'MSG'

Commit refused (§0.5: never commit secrets).

If this is a real secret: remove it, rotate it, and put a placeholder in .env.example instead.
If this is a false positive: narrow the pattern in scripts/scan-secrets.sh rather than bypassing
the hook — a hook that gets routinely skipped is a hook that is not running.
MSG
  exit 1
fi
