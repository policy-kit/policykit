import type { Address, Hex } from "viem";
import {
  type Policy,
  type OnChainRuleParams,
  type OffChainRuleParams,
  FailMode,
} from "./types.js";

/**
 * Fluent builder for constructing PolicyKit policies.
 *
 * @example
 * ```ts
 * const policy = new PolicyBuilder("my-agent-policy")
 *   .allowTargets([UNISWAP_ROUTER, AAVE_POOL])
 *   .denySelectors(["0x095ea7b3"]) // deny approve()
 *   .maxValue(parseEther("0.5"))
 *   .spendLimit(USDC_ADDRESS, 5000n * 10n**6n, 86400) // 5000 USDC per day
 *   .cooldown(300) // 5 min between calls
 *   .maxSlippageBps(50)
 *   .requireSimulation(true)
 *   .setFailMode("open")
 *   .build();
 * ```
 */
export class PolicyBuilder {
  private readonly id: string;
  private readonly onChainRules: OnChainRuleParams[] = [];
  private readonly offChainRules: OffChainRuleParams[] = [];
  private failMode: FailMode = FailMode.CLOSED;

  constructor(id: string) {
    this.id = id;
  }

  // ──────────────────── Tier 1: Stateless On-chain ────────────────────

  /**
   * Only allow transactions to these target addresses
   */
  allowTargets(targets: Address[]): this {
    this.onChainRules.push({ type: "ALLOW_TARGETS", targets });
    return this;
  }

  /**
   * Deny transactions to these target addresses
   */
  denyTargets(targets: Address[]): this {
    this.onChainRules.push({ type: "DENY_TARGETS", targets });
    return this;
  }

  /**
   * Only allow calls with these function selectors
   */
  allowSelectors(selectors: Hex[]): this {
    this.onChainRules.push({ type: "ALLOW_SELECTORS", selectors });
    return this;
  }

  /**
   * Deny calls with these function selectors
   */
  denySelectors(selectors: Hex[]): this {
    this.onChainRules.push({ type: "DENY_SELECTORS", selectors });
    return this;
  }

  /**
   * Cap the ETH value per transaction
   */
  maxValue(maxValue: bigint): this {
    this.onChainRules.push({ type: "MAX_VALUE", maxValue });
    return this;
  }

  // ──────────────────── Tier 2: Stateful On-chain ────────────────────

  /**
   * Rate-limit token spending within a time window
   * @param token Token address (use address(0) for native ETH)
   * @param maxAmount Maximum amount within the window
   * @param windowSeconds Duration of the window in seconds
   */
  spendLimit(token: Address, maxAmount: bigint, windowSeconds: number): this {
    this.onChainRules.push({
      type: "SPEND_LIMIT",
      token,
      maxAmount,
      windowSeconds,
    });
    return this;
  }

  /**
   * Enforce a minimum time delay between executions
   * @param cooldownSeconds Minimum seconds between calls
   */
  cooldown(cooldownSeconds: number): this {
    this.onChainRules.push({ type: "COOLDOWN", cooldownSeconds });
    return this;
  }

  // ──────────────────── Tier 3: Off-chain (Lit Protocol) ────────────────────

  /**
   * Enforce maximum slippage in basis points
   */
  maxSlippageBps(maxBps: number): this {
    this.offChainRules.push({ type: "MAX_SLIPPAGE_BPS", maxBps });
    return this;
  }

  /**
   * Require transaction simulation to succeed before execution
   */
  requireSimulation(mustSucceed: boolean): this {
    this.offChainRules.push({ type: "REQUIRE_SIMULATION", mustSucceed });
    return this;
  }

  /**
   * Add a custom off-chain rule
   */
  customRule(name: string, description: string, logicCID?: string): this {
    this.offChainRules.push({ type: "CUSTOM", name, description, logicCID });
    return this;
  }

  // ──────────────────── Configuration ────────────────────

  /**
   * Set the fail mode when Lit Protocol is unreachable
   * - "closed": Block execution (safer but can lock out)
   * - "open": Allow with only on-chain rules (riskier but no lockout)
   */
  setFailMode(mode: "open" | "closed"): this {
    this.failMode = mode === "open" ? FailMode.OPEN : FailMode.CLOSED;
    return this;
  }

  // ──────────────────── Build ────────────────────

  /**
   * Build the final Policy object
   */
  build(): Policy {
    return {
      version: "1.0.0",
      id: this.id,
      createdAt: new Date().toISOString(),
      failMode: this.failMode,
      rules: {
        onChain: [...this.onChainRules],
        offChain: [...this.offChainRules],
      },
    };
  }
}
