#!/usr/bin/env bash
# Installs the pre-commit secret scan. Run once after cloning: pnpm hooks:install
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .githooks
cat > .githooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
exec bash scripts/scan-secrets.sh
HOOK
chmod +x .githooks/pre-commit scripts/scan-secrets.sh
git config core.hooksPath .githooks
echo "pre-commit secret scan installed (core.hooksPath=.githooks)"
