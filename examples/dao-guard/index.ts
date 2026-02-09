/**
 * Example: DAO Execution Guard with PolicyKit
 *
 * Demonstrates how a DAO can use PolicyKit to enforce
 * constraints on proposal execution (e.g., spending limits,
 * allowed targets, blocked functions).
 */

import { PolicyBuilder, PolicySimulator } from "@policykit/sdk";
import { parseEther, type Address } from "viem";

// Example: DAO treasury and approved protocol addresses
const TREASURY = "0x0000000000000000000000000000000000000DA0" as Address;
const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481" as Address;
const AAVE_POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

async function main() {
  // DAO treasury execution policy
  const daoPolicy = new PolicyBuilder("dao-treasury-guard-v1")
    // Only allow interactions with approved DeFi protocols
    .allowTargets([UNISWAP_ROUTER, AAVE_POOL, USDC])
    // Max 10 ETH per proposal execution
    .maxValue(parseEther("10"))
    // Max 50,000 USDC per week from treasury
    .spendLimit(USDC, 50_000n * 10n ** 6n, 604800) // 7 days
    // 1 hour cooldown between proposal executions
    .cooldown(3600)
    // Custom rule: require governance approval (checked by Lit)
    .customRule(
      "governance-approval",
      "Verify that this execution was approved by on-chain governance vote"
    )
    // DAO should fail-open to avoid governance lockout
    .setFailMode("open")
    .build();

  console.log("DAO Treasury Guard Policy");
  console.log("=========================\n");
  console.log("Constraints on DAO proposal execution:");
  console.log("  - Only Uniswap, Aave, and USDC contract interactions");
  console.log("  - Max 10 ETH per execution");
  console.log("  - Max 50,000 USDC per week");
  console.log("  - 1 hour cooldown between executions");
  console.log("  - Governance approval verified by Lit Protocol");
  console.log("  - Fail-open (avoid locking DAO treasury)\n");

  const simulator = new PolicySimulator();

  // Simulate: DAO swaps 5 ETH on Uniswap
  console.log("--- Proposal: Swap 5 ETH on Uniswap ---");
  const swap = await simulator.evaluate({
    policy: daoPolicy,
    caller: TREASURY,
    target: UNISWAP_ROUTER,
    value: parseEther("5"),
    data: "0x5ae401dc0000000000000000000000000000000000000000000000000000000000000001",
  });
  console.log(simulator.formatReport(swap));

  // Simulate: DAO tries to send ETH to unauthorized address
  console.log("\n--- Proposal: Send ETH to unauthorized address (BLOCKED) ---");
  const unauthorized = await simulator.evaluate({
    policy: daoPolicy,
    caller: TREASURY,
    target: "0x000000000000000000000000000000000000DEAD" as Address,
    value: parseEther("100"),
    data: "0x",
  });
  console.log(simulator.formatReport(unauthorized));
}

main().catch(console.error);
