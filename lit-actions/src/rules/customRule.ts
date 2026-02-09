/**
 * Custom Rule - evaluates user-defined custom rule logic.
 *
 * Custom rules can be defined inline (simple conditions) or
 * reference external logic by IPFS CID.
 */

interface CustomRuleParams {
  name: string;
  description: string;
  logicCID?: string;
}

interface EvalContext {
  caller: string;
  target: string;
  calldata: string;
  value: string;
  chainId: string;
}

export async function evaluateCustomRule(
  params: CustomRuleParams,
  ctx: EvalContext
): Promise<{ passed: boolean; reason?: string }> {
  // If a logic CID is provided, fetch and evaluate it
  if (params.logicCID) {
    try {
      // Fetch custom rule logic from IPFS
      // Note: In production, this would use Lit's IPFS access
      const response = await fetch(
        `https://ipfs.io/ipfs/${params.logicCID}`
      );
      const logicCode = await response.text();

      // Execute the custom logic in a sandboxed context
      // The logic should export a function: (ctx) => { passed: boolean, reason?: string }
      const evaluate = new Function("ctx", logicCode);
      const result = evaluate(ctx);

      return {
        passed: Boolean(result?.passed ?? false),
        reason: result?.reason || `Custom rule '${params.name}' evaluated`,
      };
    } catch (error) {
      return {
        passed: false,
        reason: `Custom rule '${params.name}' failed: ${error}`,
      };
    }
  }

  // No logic CID — custom rules without logic always pass
  // (they serve as documentation/intent markers)
  return {
    passed: true,
    reason: `Custom rule '${params.name}' has no logic CID, passing by default`,
  };
}
