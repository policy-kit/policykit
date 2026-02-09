import { Command } from "commander";
import { readFileSync } from "node:fs";
import {
  PolicySimulator,
  policyFromJSON,
  validatePolicy,
} from "@policykit/sdk";
import type { Address, Hex } from "viem";

export const simulateCommand = new Command("simulate")
  .description("Simulate a transaction against a policy")
  .requiredOption("--policy <path>", "Path to policy JSON file")
  .requiredOption("--target <address>", "Target contract address")
  .option("--value <value>", "ETH value in wei", "0")
  .option("--data <data>", "Transaction calldata", "0x")
  .option(
    "--caller <address>",
    "Caller address",
    "0x0000000000000000000000000000000000000001"
  )
  .action(async (options) => {
    try {
      // Load and validate policy
      const policyJSON = JSON.parse(readFileSync(options.policy, "utf-8"));
      const validated = validatePolicy(policyJSON);
      const policy = policyFromJSON(validated);

      // Run simulation
      const simulator = new PolicySimulator();
      const report = await simulator.evaluate({
        policy,
        caller: options.caller as Address,
        target: options.target as Address,
        value: BigInt(options.value),
        data: options.data as Hex,
      });

      // Display results
      console.log("\nPolicyKit Simulation Report");
      console.log("==========================\n");
      console.log(simulator.formatReport(report));
      console.log();

      process.exit(report.passed ? 0 : 1);
    } catch (error) {
      console.error("Simulation failed:", error);
      process.exit(2);
    }
  });
