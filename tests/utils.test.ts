import { describe, expect, it } from "vitest";
import { cn, formatMoney } from "@/lib/utils";

describe("cn", () => {
  it("joins class names and drops falsy values", () => {
    expect(cn("a", "b", false, undefined, "c")).toBe("a b c");
    expect(cn("")).toBe("");
  });
});

describe("formatMoney", () => {
  it("formats amounts in NGN without decimals", () => {
    expect(formatMoney(30000, "NGN")).toContain("30,000");
  });
  it("handles zero", () => {
    expect(formatMoney(0, "NGN")).toContain("0");
  });
});