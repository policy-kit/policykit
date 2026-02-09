import { Command } from "commander";
import { PolicyBuilder, type Policy } from "@policykit/sdk";
import { writeFileSync } from "node:fs";
import { policyToJSON } from "@policykit/sdk";
import { parseEther } from "viem";

export const initCommand = new Command("init")
  .description("Create a new policy definition file")
  .option("-o, --output <path>", "Output file path", "./policy.json")
  .option("--id <id>", "Policy ID", "my-policy")
  .option("--fail-mode <mode>", "Fail mode (open|closed)", "closed")
  .action(async (options) => {
    console.log("Creating a new PolicyKit policy...\n");

    // Create a sample policy with common defaults
    const builder = new PolicyBuilder(options.id);

    builder.setFailMode(options.failMode);

    // Add sensible defaults
    builder.maxValue(parseEther("1")); // Max 1 ETH per transaction

    const policy = builder.build();
    const json = policyToJSON(policy);

    writeFileSync(options.output, JSON.stringify(json, null, 2));
    console.log(`Policy created: ${options.output}`);
    console.log(`\nPolicy ID: ${json.id}`);
    console.log(`Fail mode: ${json.failMode}`);
    console.log(`On-chain rules: ${json.rules.onChain.length}`);
    console.log(`Off-chain rules: ${json.rules.offChain.length}`);
    console.log(
      `\nEdit ${options.output} to customize your policy, then deploy with:\n  policykit deploy --policy ${options.output}`
    );
  });
