import { describe, it, expect } from "vitest";
import { PolicySimulator } from "../src/simulation/PolicySimulator.js";
import { PolicyBuilder } from "../src/core/PolicyBuilder.js";
import { parseEther } from "viem";

describe("PolicySimulator", () => {
  const simulator = new PolicySimulator();

  it("passes when all rules are satisfied", async () => {
    const policy = new PolicyBuilder("test")
      .allowTargets(["0x0000000000000000000000000000000000000001"])
      .maxValue(parseEther("1"))
      .build();

    const report = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000001",
      value: parseEther("0.5"),
      data: "0x",
    });

    expect(report.passed).toBe(true);
    expect(report.results).toHaveLength(2);
    expect(report.results[0].passed).toBe(true);
    expect(report.results[1].passed).toBe(true);
  });

  it("fails when target is not allowed", async () => {
    const policy = new PolicyBuilder("test")
      .allowTargets(["0x0000000000000000000000000000000000000001"])
      .build();

    const report = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000BAD",
      value: 0n,
      data: "0x",
    });

    expect(report.passed).toBe(false);
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].reason).toContain("not in allowlist");
  });

  it("fails when value exceeds max", async () => {
    const policy = new PolicyBuilder("test")
      .maxValue(parseEther("1"))
      .build();

    const report = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000001",
      value: parseEther("2"),
      data: "0x",
    });

    expect(report.passed).toBe(false);
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].reason).toContain("exceeds max");
  });

  it("handles deny targets correctly", async () => {
    const policy = new PolicyBuilder("test")
      .denyTargets(["0x0000000000000000000000000000000000000BAD"])
      .build();

    // Allowed target
    const allowed = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000001",
      value: 0n,
      data: "0x",
    });
    expect(allowed.passed).toBe(true);

    // Denied target
    const denied = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000BAD",
      value: 0n,
      data: "0x",
    });
    expect(denied.passed).toBe(false);
  });

  it("handles selector rules", async () => {
    const policy = new PolicyBuilder("test")
      .denySelectors(["0x095ea7b3"]) // deny approve()
      .build();

    // Allowed selector (transfer)
    const allowed = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000001",
      value: 0n,
      data: "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001",
    });
    expect(allowed.passed).toBe(true);

    // Denied selector (approve)
    const denied = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000001",
      value: 0n,
      data: "0x095ea7b30000000000000000000000000000000000000000000000000000000000000001",
    });
    expect(denied.passed).toBe(false);
  });

  it("formats report correctly", async () => {
    const policy = new PolicyBuilder("test")
      .allowTargets(["0x0000000000000000000000000000000000000001"])
      .maxValue(parseEther("1"))
      .build();

    const report = await simulator.evaluate({
      policy,
      caller: "0x0000000000000000000000000000000000000099",
      target: "0x0000000000000000000000000000000000000001",
      value: parseEther("2"),
      data: "0x",
    });

    const formatted = simulator.formatReport(report);
    expect(formatted).toContain("DENIED");
    expect(formatted).toContain("PASS");
    expect(formatted).toContain("FAIL");
  });
});
