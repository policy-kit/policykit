/**
 * Simulate Transaction Rule - runs an eth_call to simulate
 * the transaction and checks if it would succeed.
 */

interface SimulationParams {
  mustSucceed: boolean;
}

interface EvalContext {
  caller: string;
  target: string;
  calldata: string;
  value: string;
  chainId: string;
}

// RPC endpoints for simulation
const RPC_ENDPOINTS: Record<string, string> = {
  "8453": "https://mainnet.base.org",
  "84532": "https://sepolia.base.org",
};

export async function evaluateSimulation(
  params: SimulationParams,
  ctx: EvalContext
): Promise<{ passed: boolean; reason?: string }> {
  const rpcUrl = RPC_ENDPOINTS[ctx.chainId];
  if (!rpcUrl) {
    return {
      passed: !params.mustSucceed,
      reason: `No RPC endpoint for chain ${ctx.chainId}`,
    };
  }

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            from: ctx.caller,
            to: ctx.target,
            data: ctx.calldata,
            value: ctx.value === "0" ? "0x0" : `0x${BigInt(ctx.value).toString(16)}`,
          },
          "latest",
        ],
      }),
    });

    const result = (await response.json()) as {
      result?: string;
      error?: { message: string };
    };

    if (result.error) {
      return {
        passed: !params.mustSucceed,
        reason: `Simulation reverted: ${result.error.message}`,
      };
    }

    return { passed: true, reason: "Simulation succeeded" };
  } catch (error) {
    return {
      passed: !params.mustSucceed,
      reason: `Simulation failed: ${error}`,
    };
  }
}
