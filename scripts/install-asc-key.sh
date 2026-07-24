#!/usr/bin/env bash
# Install a newly downloaded App Store Connect API key (.p8) on this Mac.
# Usage:
#   ./scripts/install-asc-key.sh                  # picks newest AuthKey_*.p8 in ~/Downloads
#   ./scripts/install-asc-key.sh /path/to/AuthKey_XXXX.p8
#   ./scripts/install-asc-key.sh ~/Downloads/AuthKey_XXXX.p8 YOUR_ISSUER_ID
set -euo pipefail

DEST_DIR="${HOME}/.appstoreconnect/private_keys"
SECRETS_DIR="$(cd "$(dirname "$0")/.." && pwd)/.secrets"
ENV_FILE="${SECRETS_DIR}/asc.env"

mkdir -p "${DEST_DIR}"
chmod 700 "${HOME}/.appstoreconnect" "${DEST_DIR}" 2>/dev/null || true
mkdir -p "${SECRETS_DIR}"
chmod 700 "${SECRETS_DIR}"

P8="${1:-}"
ISSUER="${2:-}"

if [[ -z "${P8}" ]]; then
  P8="$(ls -t "${HOME}/Downloads"/AuthKey_*.p8 2>/dev/null | head -1 || true)"
fi

if [[ -z "${P8}" || ! -f "${P8}" ]]; then
  echo "No AuthKey_*.p8 found."
  echo "1) Create a key in App Store Connect (Integrations → App Store Connect API)"
  echo "2) Download the .p8 (only offered once)"
  echo "3) Re-run: $0 ~/Downloads/AuthKey_XXXXXXXXXX.p8 <ISSUER_ID>"
  exit 1
fi

BASE="$(basename "${P8}")"
if [[ ! "${BASE}" =~ ^AuthKey_([A-Z0-9]+)\.p8$ ]]; then
  echo "Expected filename AuthKey_<KEY_ID>.p8, got: ${BASE}"
  exit 1
fi
KEY_ID="${BASH_REMATCH[1]}"

install -m 600 "${P8}" "${DEST_DIR}/${BASE}"
echo "Installed: ${DEST_DIR}/${BASE}"

# Keep Issuer ID if already known and not passed
if [[ -z "${ISSUER}" && -f "${ENV_FILE}" ]]; then
  ISSUER="$(grep -E '^ASC_ISSUER_ID=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '\"' || true)"
fi

if [[ -z "${ISSUER}" ]]; then
  echo ""
  echo "Key ID: ${KEY_ID}"
  echo "Issuer ID still needed. Find it at:"
  echo "  https://appstoreconnect.apple.com/access/integrations/api"
  echo "  (top of page: Issuer ID)"
  echo "Re-run with: $0 ${DEST_DIR}/${BASE} <ISSUER_ID>"
  # Still write partial env
  cat > "${ENV_FILE}" <<EOF
# App Store Connect API (local only — do not commit)
ASC_KEY_ID=${KEY_ID}
ASC_ISSUER_ID=
ASC_KEY_PATH=${DEST_DIR}/${BASE}
EOF
  chmod 600 "${ENV_FILE}"
  exit 2
fi

cat > "${ENV_FILE}" <<EOF
# App Store Connect API (local only — do not commit)
ASC_KEY_ID=${KEY_ID}
ASC_ISSUER_ID=${ISSUER}
ASC_KEY_PATH=${DEST_DIR}/${BASE}
EOF
chmod 600 "${ENV_FILE}"

# Convenience symlink in project .secrets (optional)
ln -sfn "${DEST_DIR}/${BASE}" "${SECRETS_DIR}/${BASE}"

echo "Updated: ${ENV_FILE}"
echo "  ASC_KEY_ID=${KEY_ID}"
echo "  ASC_ISSUER_ID=${ISSUER}"
echo "  ASC_KEY_PATH=${DEST_DIR}/${BASE}"
echo ""
echo "Done. Tell the agent: key file is in place"
