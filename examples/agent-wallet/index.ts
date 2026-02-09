/**
 * Example: AI Agent Wallet with PolicyKit Guardrails
 *
 * Demonstrates how to constrain an AI agent's wallet access
 * with composable, enforceable policies.
 */

import { PolicyBuilder, PolicySimulator } from "@policykit/sdk";
import { parseEther, type Address } from "viem";

// DeFi protocol addresses on Base
const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

async function main() {
  // Define strict guardrails for an autonomous AI agent
  const agentPolicy = new PolicyBuilder("agent-guardrails-v1")
    // The agent can ONLY interact with Uniswap
    .allowTargets([UNISWAP_ROUTER])
    // Block these dangerous function selectors
    .denySelectors([
      "0x095ea7b3", // approve(address,uint256) - prevent unlimited approvals
      "0xa22cb465", // setApprovalForAll(address,bool) - prevent NFT approvals
    ])
    // Max 0.1 ETH per transaction (limit blast radius)
    .maxValue(parseEther("0.1"))
    // Max 1000 USDC per day
    .spendLimit(USDC, 1000n * 10n ** 6n, 86400)
    // 1 minute cooldown between transactions (prevent rapid-fire)
    .cooldown(60)
    // Require simulated success before real execution
    .requireSimulation(true)
    // If Lit is down, block everything (safety first for agents)
    .setFailMode("closed")
    .build();

  console.log("Agent Wallet Policy");
  console.log("===================\n");
  console.log("This policy constrains an AI agent to:");
  console.log("  - Only interact with Uniswap Router");
  console.log("  - Cannot call approve() or setApprovalForAll()");
  console.log("  - Max 0.1 ETH per transaction");
  console.log("  - Max 1000 USDC per day");
  console.log("  - 1 minute cooldown between calls");
  console.log("  - Must simulate before executing\n");

  // Simulate agent actions
  const simulator = new PolicySimulator();
  const agent = "0x00000000000000000000000000000000000A6E17" as Address;

  // Agent tries to swap
  console.log("--- Agent Action: Swap 0.05 ETH on Uniswap ---");
  const swap = await simulator.evaluate({
    policy: agentPolicy,
    caller: agent,
    target: UNISWAP_ROUTER,
    value: parseEther("0.05"),
    data: "0x5ae401dc0000000000000000000000000000000000000000000000000000000000000001",
  });
  console.log(simulator.formatReport(swap));

  // Agent tries to approve (should be blocked)
  console.log("\n--- Agent Action: Approve USDC (BLOCKED) ---");
  const approve = await simulator.evaluate({
    policy: agentPolicy,
    caller: agent,
    target: UNISWAP_ROUTER,
    value: 0n,
    data: "0x095ea7b3000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000ffffffff",
  });
  console.log(simulator.formatReport(approve));

  // Agent tries to send ETH to random address (should be blocked)
  console.log("\n--- Agent Action: Send ETH to random address (BLOCKED) ---");
  const send = await simulator.evaluate({
    policy: agentPolicy,
    caller: agent,
    target: "0x000000000000000000000000000000000000DEAD" as Address,
    value: parseEther("0.01"),
    data: "0x",
  });
  console.log(simulator.formatReport(send));
}

main().catch(console.error);
