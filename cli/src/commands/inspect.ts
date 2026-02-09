import { Command } from "commander";
import {
  PolicyEngineClient,
  getChainConfig,
  POLICY_ENGINE_ABI,
} from "@policykit/sdk";
import { createPublicClient, http, type Address } from "viem";

export const inspectCommand = new Command("inspect")
  .description("Inspect an on-chain policy for an account")
  .requiredOption("--account <address>", "Account address to inspect")
  .option("--chain <chain>", "Chain name", "base")
  .option("--rpc <url>", "RPC URL")
  .option(
    "--engine <address>",
    "PolicyEngine contract address"
  )
  .action(async (options) => {
    try {
      const chain = getChainConfig(options.chain as "base" | "base-sepolia");
      const rpcUrl = options.rpc || chain.rpcUrls.default.http[0];

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      if (!options.engine) {
        console.error("Error: --engine address is required");
        process.exit(1);
      }

      const engineClient = new PolicyEngineClient({
        publicClient,
        engineAddress: options.engine as Address,
      });

      console.log("\nPolicyKit Inspector");
      console.log("===================\n");
      console.log(`Account: ${options.account}`);
      console.log(`Chain: ${options.chain}`);
      console.log(`Engine: ${options.engine}\n`);

      const hasPolicy = await engineClient.hasPolicy(
        options.account as Address
      );

      if (!hasPolicy) {
        console.log("No policy set for this account.");
        return;
      }

      const policy = await engineClient.getPolicy(
        options.account as Address
      );

      console.log(`Policy CID: ${policy.policyCID}`);
      console.log(`PKP Address: ${policy.pkpAddress}`);
      console.log(`Requires Attestation: ${policy.requireAttestation}`);
      console.log(
        `Fail Mode: ${Number(policy.failMode) === 0 ? "CLOSED" : "OPEN"}`
      );
      console.log(`Rule Count: ${policy.ruleCount}`);
    } catch (error) {
      console.error("Inspect failed:", error);
      process.exit(1);
    }
  });
