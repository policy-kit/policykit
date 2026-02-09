import { describe, it, expect } from "vitest";
import { PolicyBuilder } from "../src/core/PolicyBuilder.js";
import { FailMode } from "../src/core/types.js";
import { parseEther } from "viem";

describe("PolicyBuilder", () => {
  it("builds a basic policy with Tier 1 rules", () => {
    const policy = new PolicyBuilder("test-policy")
      .allowTargets(["0x0000000000000000000000000000000000000001"])
      .maxValue(parseEther("1"))
      .build();

    expect(policy.id).toBe("test-policy");
    expect(policy.version).toBe("1.0.0");
    expect(policy.rules.onChain).toHaveLength(2);
    expect(policy.rules.offChain).toHaveLength(0);
    expect(policy.failMode).toBe(FailMode.CLOSED);
  });

  it("builds a policy with all rule types", () => {
    const policy = new PolicyBuilder("full-policy")
      .allowTargets(["0x0000000000000000000000000000000000000001"])
      .denyTargets(["0x0000000000000000000000000000000000000BAD"])
      .allowSelectors(["0xa9059cbb"])
      .denySelectors(["0x095ea7b3"])
      .maxValue(parseEther("0.5"))
      .spendLimit(
        "0x0000000000000000000000000000000000000002",
        5000n * 10n ** 6n,
        86400
      )
      .cooldown(300)
      .maxSlippageBps(50)
      .requireSimulation(true)
      .customRule("market-hours", "Only during market hours")
      .build();

    expect(policy.rules.onChain).toHaveLength(7);
    expect(policy.rules.offChain).toHaveLength(3);

    // Check specific rule types
    expect(policy.rules.onChain[0].type).toBe("ALLOW_TARGETS");
    expect(policy.rules.onChain[4].type).toBe("MAX_VALUE");
    expect(policy.rules.onChain[5].type).toBe("SPEND_LIMIT");
    expect(policy.rules.onChain[6].type).toBe("COOLDOWN");
    expect(policy.rules.offChain[0].type).toBe("MAX_SLIPPAGE_BPS");
    expect(policy.rules.offChain[1].type).toBe("REQUIRE_SIMULATION");
    expect(policy.rules.offChain[2].type).toBe("CUSTOM");
  });

  it("supports fail-open mode", () => {
    const policy = new PolicyBuilder("open-policy")
      .setFailMode("open")
      .build();

    expect(policy.failMode).toBe(FailMode.OPEN);
  });

  it("supports fail-closed mode (default)", () => {
    const policy = new PolicyBuilder("closed-policy").build();
    expect(policy.failMode).toBe(FailMode.CLOSED);
  });

  it("sets createdAt timestamp", () => {
    const before = new Date().toISOString();
    const policy = new PolicyBuilder("time-policy").build();
    const after = new Date().toISOString();

    expect(policy.createdAt >= before).toBe(true);
    expect(policy.createdAt <= after).toBe(true);
  });

  it("is immutable after build", () => {
    const builder = new PolicyBuilder("immutable-test")
      .allowTargets(["0x0000000000000000000000000000000000000001"]);

    const policy1 = builder.build();
    builder.maxValue(parseEther("1"));
    const policy2 = builder.build();

    expect(policy1.rules.onChain).toHaveLength(1);
    expect(policy2.rules.onChain).toHaveLength(2);
  });
});
