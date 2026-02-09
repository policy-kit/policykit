import { describe, it, expect } from "vitest";
import { encodeOnChainRule, encodeOnChainRules } from "../src/core/PolicyEncoder.js";
import { PolicyBuilder } from "../src/core/PolicyBuilder.js";
import { RuleType } from "../src/core/types.js";
import { parseEther } from "viem";

describe("PolicyEncoder", () => {
  it("encodes ALLOW_TARGETS rule", () => {
    const encoded = encodeOnChainRule({
      type: "ALLOW_TARGETS",
      targets: ["0x0000000000000000000000000000000000000001"],
    });

    expect(encoded.ruleType).toBe(RuleType.ALLOW_TARGETS);
    expect(encoded.enabled).toBe(true);
    expect(encoded.params).toMatch(/^0x/);
    expect(encoded.params.length).toBeGreaterThan(2);
  });

  it("encodes MAX_VALUE rule", () => {
    const encoded = encodeOnChainRule({
      type: "MAX_VALUE",
      maxValue: parseEther("1"),
    });

    expect(encoded.ruleType).toBe(RuleType.MAX_VALUE);
    expect(encoded.params).toMatch(/^0x/);
  });

  it("encodes SPEND_LIMIT rule", () => {
    const encoded = encodeOnChainRule({
      type: "SPEND_LIMIT",
      token: "0x0000000000000000000000000000000000000002",
      maxAmount: 5000n * 10n ** 6n,
      windowSeconds: 86400,
    });

    expect(encoded.ruleType).toBe(RuleType.SPEND_LIMIT);
    expect(encoded.params).toMatch(/^0x/);
  });

  it("encodes COOLDOWN rule", () => {
    const encoded = encodeOnChainRule({
      type: "COOLDOWN",
      cooldownSeconds: 300,
    });

    expect(encoded.ruleType).toBe(RuleType.COOLDOWN);
    expect(encoded.params).toMatch(/^0x/);
  });

  it("encodes all on-chain rules from a policy", () => {
    const policy = new PolicyBuilder("test")
      .allowTargets(["0x0000000000000000000000000000000000000001"])
      .maxValue(parseEther("1"))
      .cooldown(300)
      .build();

    const encoded = encodeOnChainRules(policy);

    expect(encoded).toHaveLength(3);
    expect(encoded[0].ruleType).toBe(RuleType.ALLOW_TARGETS);
    expect(encoded[1].ruleType).toBe(RuleType.MAX_VALUE);
    expect(encoded[2].ruleType).toBe(RuleType.COOLDOWN);
  });
});
