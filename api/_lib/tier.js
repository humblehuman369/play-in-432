/**
 * Metadata-authoritative tier resolution for sessions we create.
 *
 * No amount-total sniffing — coupons/proration must never downgrade a tier.
 * Defaults to "pro" with a warn if metadata is somehow absent (should not
 * happen for our own sessions).
 *
 * Note: api/restore-pro.js intentionally keeps its own tierFromSession that
 * returns null to filter non-purchases; do not replace it with this one.
 */
export function tierFromSession(session) {
  const meta = session.metadata || {};
  if (meta.tier === "lite" || meta.product === "truehz_lite") return "lite";
  if (meta.tier === "pro" || meta.product === "truehz_pro") return "pro";
  console.warn(
    "tierFromSession: no tier/product metadata on session",
    session.id,
  );
  return "pro";
}
