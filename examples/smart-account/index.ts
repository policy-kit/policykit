/**
 * Example: ERC-7579 Smart Account with PolicyKit
 *
 * Demonstrates how to:
 * 1. Build a policy with on-chain + off-chain rules
 * 2. Deploy the policy (pin to IPFS + set on-chain)
 * 3. Simulate a transaction against the policy
 */

import { PolicyBuilder, PolicySimulator, policyToJSON, FailMode } from "@policykit/sdk";
import { parseEther, type Address } from "viem";

// Example addresses (replace with real ones)
const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481" as Address;
const AAVE_POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

async function main() {
  // 1. Build a comprehensive policy for an AI agent trading account
  const policy = new PolicyBuilder("smart-account-trading-v1")
    // Tier 1: Only allow interactions with Uniswap and Aave
    .allowTargets([UNISWAP_ROUTER, AAVE_POOL])
    // Tier 1: Block approve() calls (prevent unlimited approvals)
    .denySelectors(["0x095ea7b3"])
    // Tier 1: Max 0.5 ETH per transaction
    .maxValue(parseEther("0.5"))
    // Tier 2: Max 5000 USDC spent per 24 hours
    .spendLimit(USDC, 5000n * 10n ** 6n, 86400)
    // Tier 2: 5 minute cooldown between transactions
    .cooldown(300)
    // Tier 3: Max 50 bps slippage on swaps (evaluated by Lit Protocol)
    .maxSlippageBps(50)
    // Tier 3: Require transaction simulation to succeed
    .requireSimulation(true)
    // If Lit Protocol is unreachable, block execution (safer)
    .setFailMode("closed")
    .build();

  console.log("Policy built successfully!");
  console.log(`  ID: ${policy.id}`);
  console.log(`  On-chain rules: ${policy.rules.onChain.length}`);
  console.log(`  Off-chain rules: ${policy.rules.offChain.length}`);
  console.log(`  Fail mode: ${policy.failMode === FailMode.CLOSED ? "CLOSED" : "OPEN"}`);

  // 2. Serialize for IPFS storage
  const json = policyToJSON(policy);
  console.log("\nPolicy JSON:");
  console.log(JSON.stringify(json, null, 2));

  // 3. Simulate transactions
  const simulator = new PolicySimulator();

  console.log("\n--- Simulation 1: Swap on Uniswap (should PASS) ---");
  const swapReport = await simulator.evaluate({
    policy,
    caller: "0x0000000000000000000000000000000000000099" as Address,
    target: UNISWAP_ROUTER,
    value: parseEther("0.1"),
    data: "0x5ae401dc", // multicall selector
  });
  console.log(simulator.formatReport(swapReport));

  console.log("\n--- Simulation 2: Send to unknown address (should FAIL) ---");
  const unknownReport = await simulator.evaluate({
    policy,
    caller: "0x0000000000000000000000000000000000000099" as Address,
    target: "0x0000000000000000000000000000000000000BAD" as Address,
    value: 0n,
    data: "0x",
  });
  console.log(simulator.formatReport(unknownReport));

  console.log("\n--- Simulation 3: Large ETH transfer (should FAIL) ---");
  const largeReport = await simulator.evaluate({
    policy,
    caller: "0x0000000000000000000000000000000000000099" as Address,
    target: UNISWAP_ROUTER,
    value: parseEther("10"),
    data: "0x5ae401dc",
  });
  console.log(simulator.formatReport(largeReport));
}

main().catch(console.error);
