import { describe, expect, it, beforeEach } from "vitest";
import { normalizeAccountLevel, getAccountLevelOptions } from "@/utils/account-level";
import { mediaUrl } from "@/lib/media-url";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("crypto_haven_token", "demo-token");
});

describe("account level helpers", () => {
  it("keeps valid levels and clamps invalid values", () => {
    expect(normalizeAccountLevel(0)).toBe(0);
    expect(normalizeAccountLevel(1)).toBe(1);
    expect(normalizeAccountLevel(3)).toBe(3);
    expect(normalizeAccountLevel(999)).toBe(6);
    expect(normalizeAccountLevel(-1)).toBe(0);
  });

  it("exposes configured tier labels", () => {
    const options = getAccountLevelOptions();
    expect(options[0]).toMatchObject({ level: 0, label: "Basic" });
    expect(options[1]).toMatchObject({ level: 1, label: "VIP 1" });
    expect(options.at(-1)).toMatchObject({ level: 6, label: "SVIP 6" });
  });

  it("rewrites legacy uploads paths through the protected media route", () => {
    const url = mediaUrl("/uploads/abc-front.png");
    expect(url).toContain("/api/media/abc-front.png");
    expect(url).toContain("token=demo-token");
  });
});
