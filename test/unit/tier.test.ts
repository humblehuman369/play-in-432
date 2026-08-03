import { describe, it, expect, vi } from "vitest";
import { tierFromSession } from "../../api/_lib/tier.js";

/**
 * CODE-5 invariant: tier is authoritative from metadata only. Amount totals
 * must NEVER influence the result (coupons/proration can push a Pro purchase
 * below any threshold).
 */
describe("tierFromSession", () => {
  it("reads lite from metadata.tier", () => {
    expect(tierFromSession({ id: "cs_1", metadata: { tier: "lite" } })).toBe(
      "lite",
    );
  });

  it("reads lite from metadata.product", () => {
    expect(
      tierFromSession({ id: "cs_2", metadata: { product: "truehz_lite" } }),
    ).toBe("lite");
  });

  it("reads pro from metadata.tier", () => {
    expect(tierFromSession({ id: "cs_3", metadata: { tier: "pro" } })).toBe(
      "pro",
    );
  });

  it("reads pro from metadata.product", () => {
    expect(
      tierFromSession({ id: "cs_4", metadata: { product: "truehz_pro" } }),
    ).toBe("pro");
  });

  it("ignores amount_total entirely — a discounted Pro stays Pro", () => {
    // 30%-off Pro ($13.30) would fall below a naive $15 lite threshold.
    expect(
      tierFromSession({
        id: "cs_5",
        amount_total: 1330,
        metadata: { tier: "pro" },
      }),
    ).toBe("pro");
  });

  it("ignores amount_total entirely — a high-amount Lite stays Lite", () => {
    expect(
      tierFromSession({
        id: "cs_6",
        amount_total: 5000,
        metadata: { tier: "lite" },
      }),
    ).toBe("lite");
  });

  it("defaults to pro (with a warn) when metadata is absent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(tierFromSession({ id: "cs_7", amount_total: 999 })).toBe("pro");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
