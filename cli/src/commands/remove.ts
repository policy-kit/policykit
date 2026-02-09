import { Command } from "commander";

export const removeCommand = new Command("remove")
  .description("Remove a policy from an account")
  .requiredOption("--account <address>", "Account address")
  .option("--chain <chain>", "Chain name", "base")
  .option("--rpc <url>", "RPC URL")
  .option("--engine <address>", "PolicyEngine contract address")
  .action(async (options) => {
    console.log("\nPolicyKit Remove");
    console.log("================\n");
    console.log(`Account: ${options.account}`);
    console.log(`Chain: ${options.chain}`);
    console.log(
      "\nTo remove a policy, use the SDK programmatically:"
    );
    console.log("  const pk = new PolicyKit({ ... });");
    console.log("  await pk.removePolicy();");
    console.log(
      "\nOr call PolicyEngine.removePolicySet() directly via cast:"
    );
    console.log(
      `  cast send ${options.engine || "<ENGINE_ADDRESS>"} "removePolicySet()" --private-key $PRIVATE_KEY --rpc-url $RPC_URL`
    );
  });
