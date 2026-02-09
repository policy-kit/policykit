import type { Address, Hex } from "viem";
import type {
  Policy,
  OnChainRuleParams,
  OffChainRuleParams,
  EvaluationReport,
  RuleResult,
} from "../core/types.js";
import { RuleTier } from "../core/types.js";

/**
 * Local policy simulator that evaluates all tiers without
 * Lit Protocol or on-chain calls. Used for testing and debugging.
 */
export class PolicySimulator {
  /**
   * Evaluate a policy against a transaction locally
   */
  async evaluate(params: {
    policy: Policy;
    caller: Address;
    target: Address;
    value: bigint;
    data: Hex;
  }): Promise<EvaluationReport> {
    const results: RuleResult[] = [];
    let allPassed = true;

    // Evaluate on-chain rules (Tier 1 + 2)
    for (const rule of params.policy.rules.onChain) {
      const result = this.evaluateOnChainRule(rule, params);
      results.push(result);
      if (!result.passed) allPassed = false;
    }

    // Evaluate off-chain rules (Tier 3) — local simulation
    for (const rule of params.policy.rules.offChain) {
      const result = await this.evaluateOffChainRule(rule, params);
      results.push(result);
      if (!result.passed) allPassed = false;
    }

    return { passed: allPassed, results };
  }

  /**
   * Format the evaluation report as a readable string
   */
  formatReport(report: EvaluationReport): string {
    const lines: string[] = [];
    const maxRuleLen = Math.max(
      ...report.results.map((r) => r.rule.length),
      4
    );

    lines.push(
      `${"Rule".padEnd(maxRuleLen)} | Tier | Result | Reason`
    );
    lines.push("-".repeat(maxRuleLen + 30));

    for (const result of report.results) {
      const status = result.passed ? "PASS" : "FAIL";
      lines.push(
        `${result.rule.padEnd(maxRuleLen)} | ${result.tier}    | ${status.padEnd(6)} | ${result.reason}`
      );
    }

    lines.push("-".repeat(maxRuleLen + 30));
    lines.push(`RESULT: ${report.passed ? "ALLOWED" : "DENIED"}`);

    return lines.join("\n");
  }

  private evaluateOnChainRule(
    rule: OnChainRuleParams,
    ctx: { caller: Address; target: Address; value: bigint; data: Hex }
  ): RuleResult {
    switch (rule.type) {
      case "ALLOW_TARGETS": {
        const passed = rule.targets.some(
          (t) => t.toLowerCase() === ctx.target.toLowerCase()
        );
        return {
          rule: "ALLOW_TARGETS",
          tier: RuleTier.TIER_1,
          passed,
          reason: passed
            ? "Target in allowlist"
            : "Target address not in allowlist",
        };
      }

      case "DENY_TARGETS": {
        const denied = rule.targets.some(
          (t) => t.toLowerCase() === ctx.target.toLowerCase()
        );
        return {
          rule: "DENY_TARGETS",
          tier: RuleTier.TIER_1,
          passed: !denied,
          reason: denied
            ? "Target address is in denylist"
            : "Target not in denylist",
        };
      }

      case "ALLOW_SELECTORS": {
        if (ctx.data.length < 10) {
          return {
            rule: "ALLOW_SELECTORS",
            tier: RuleTier.TIER_1,
            passed: true,
            reason: "No selector (plain ETH transfer)",
          };
        }
        const selector = ctx.data.slice(0, 10).toLowerCase();
        const passed = rule.selectors.some(
          (s) => s.toLowerCase() === selector
        );
        return {
          rule: "ALLOW_SELECTORS",
          tier: RuleTier.TIER_1,
          passed,
          reason: passed
            ? "Selector in allowlist"
            : `Selector ${selector} not in allowlist`,
        };
      }

      case "DENY_SELECTORS": {
        if (ctx.data.length < 10) {
          return {
            rule: "DENY_SELECTORS",
            tier: RuleTier.TIER_1,
            passed: true,
            reason: "No selector (plain ETH transfer)",
          };
        }
        const selector = ctx.data.slice(0, 10).toLowerCase();
        const denied = rule.selectors.some(
          (s) => s.toLowerCase() === selector
        );
        return {
          rule: "DENY_SELECTORS",
          tier: RuleTier.TIER_1,
          passed: !denied,
          reason: denied
            ? `Selector ${selector} is in denylist`
            : "Selector not in denylist",
        };
      }

      case "MAX_VALUE": {
        const passed = ctx.value <= rule.maxValue;
        return {
          rule: "MAX_VALUE",
          tier: RuleTier.TIER_1,
          passed,
          reason: passed
            ? `${ctx.value} <= ${rule.maxValue} wei`
            : `${ctx.value} > ${rule.maxValue} wei (exceeds max)`,
        };
      }

      case "SPEND_LIMIT": {
        // In simulation, we can't track state across calls
        // Report as passing with a note
        return {
          rule: "SPEND_LIMIT",
          tier: RuleTier.TIER_2,
          passed: true,
          reason: `Spend limit: ${rule.maxAmount} per ${rule.windowSeconds}s (stateful — simulation assumes no prior spend)`,
        };
      }

      case "COOLDOWN": {
        return {
          rule: "COOLDOWN",
          tier: RuleTier.TIER_2,
          passed: true,
          reason: `Cooldown: ${rule.cooldownSeconds}s (stateful — simulation assumes no prior execution)`,
        };
      }
    }
  }

  private async evaluateOffChainRule(
    rule: OffChainRuleParams,
    ctx: { caller: Address; target: Address; value: bigint; data: Hex }
  ): Promise<RuleResult> {
    switch (rule.type) {
      case "MAX_SLIPPAGE_BPS":
        return {
          rule: "MAX_SLIPPAGE_BPS",
          tier: RuleTier.TIER_3,
          passed: true,
          reason: `Max slippage: ${rule.maxBps} bps (requires Lit for live check)`,
        };

      case "REQUIRE_SIMULATION":
        return {
          rule: "REQUIRE_SIMULATION",
          tier: RuleTier.TIER_3,
          passed: true,
          reason: `Simulation required: ${rule.mustSucceed} (requires Lit for live check)`,
        };

      case "CUSTOM":
        return {
          rule: `CUSTOM:${rule.name}`,
          tier: RuleTier.TIER_3,
          passed: true,
          reason: `Custom rule '${rule.name}' (requires Lit for live check)`,
        };
    }
  }
}
