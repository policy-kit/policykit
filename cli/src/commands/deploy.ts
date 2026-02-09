import { Command } from "commander";
import { readFileSync } from "node:fs";
import {
  validatePolicy,
  policyFromJSON,
  encodeOnChainRules,
} from "@policykit/sdk";
import { cidToBytes32 } from "@policykit/sdk";
import type { Address } from "viem";

export const deployCommand = new Command("deploy")
  .description("Deploy a policy: pin to IPFS and set on-chain")
  .requiredOption("--policy <path>", "Path to policy JSON file")
  .requiredOption("--account <address>", "Smart account address")
  .option("--chain <chain>", "Target chain", "base")
  .option("--rpc <url>", "RPC URL")
  .option("--pkp <address>", "Lit PKP address for attestations")
  .option("--dry-run", "Print encoded data without submitting", false)
  .action(async (options) => {
    try {
      // Load and validate policy
      const policyJSON = JSON.parse(readFileSync(options.policy, "utf-8"));
      const validated = validatePolicy(policyJSON);
      const policy = policyFromJSON(validated);

      // Encode on-chain rules
      const onChainRules = encodeOnChainRules(policy);
      const hasOffChainRules = policy.rules.offChain.length > 0;

      console.log("\nPolicyKit Deploy");
      console.log("================\n");
      console.log(`Policy ID: ${policy.id}`);
      console.log(`Chain: ${options.chain}`);
      console.log(`Account: ${options.account}`);
      console.log(`On-chain rules: ${onChainRules.length}`);
      console.log(`Off-chain rules: ${policy.rules.offChain.length}`);
      console.log(`Requires attestation: ${hasOffChainRules}`);
      console.log(`Fail mode: ${policy.failMode === 0 ? "CLOSED" : "OPEN"}`);

      if (options.dryRun) {
        console.log("\n[DRY RUN] Encoded rules:");
        for (const rule of onChainRules) {
          console.log(`  Rule type ${rule.ruleType}: ${rule.params.slice(0, 42)}...`);
        }
        console.log("\nTo deploy for real, remove the --dry-run flag.");
        return;
      }

      console.log(
        "\nTo deploy, configure your RPC and private key as environment variables:"
      );
      console.log("  POLICYKIT_RPC_URL=<rpc-url>");
      console.log("  POLICYKIT_PRIVATE_KEY=<private-key>");
      console.log(
        "\nThen use the SDK programmatically for full deployment flow."
      );
    } catch (error) {
      console.error("Deploy failed:", error);
      process.exit(1);
    }
  });
