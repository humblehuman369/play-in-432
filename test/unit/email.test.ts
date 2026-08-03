import { describe, it, expect } from "vitest";
import { esc } from "../../api/_lib/email.js";

/**
 * SEC-1 escaping: every interpolated value in gift/unlock emails must be
 * HTML-escaped so an attacker-controlled name/code can't inject markup.
 */
describe("esc", () => {
  it("escapes all five HTML-sensitive characters", () => {
    expect(esc(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("neutralises a script-injection attempt", () => {
    expect(esc(`<script>alert('x')</script>`)).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
  });

  it("escapes ampersands before entities (no double-encoding gaps)", () => {
    expect(esc("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("returns empty string for null/undefined", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("leaves a plain string unchanged", () => {
    expect(esc("Someone")).toBe("Someone");
  });
});
