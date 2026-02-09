import { encodeAbiParameters, parseAbiParameters, toHex, type Hex, type Address } from "viem";
import type {
  OnChainRuleParams,
  OnChainRule,
  Policy,
  FailMode,
} from "./types.js";
import { RuleType } from "./types.js";
import type { PolicyJSON } from "./PolicySchema.js";

// ──────────────────── ABI Parameter Types ────────────────────

const targetListAbi = parseAbiParameters("(address[] targets)");
const selectorListAbi = parseAbiParameters("(bytes4[] selectors)");
const maxValueAbi = parseAbiParameters("(uint256 maxValue)");
const spendLimitAbi = parseAbiParameters(
  "(address token, uint256 maxAmount, uint256 windowSeconds)"
);
const cooldownAbi = parseAbiParameters("(uint256 cooldownSeconds)");

// ──────────────────── Encoding Functions ────────────────────

function encodeRuleParams(rule: OnChainRuleParams): Hex {
  switch (rule.type) {
    case "ALLOW_TARGETS":
    case "DENY_TARGETS":
      return encodeAbiParameters(targetListAbi, [
        { targets: rule.targets as Address[] },
      ]);

    case "ALLOW_SELECTORS":
    case "DENY_SELECTORS":
      return encodeAbiParameters(selectorListAbi, [
        { selectors: rule.selectors as Hex[] },
      ]);

    case "MAX_VALUE":
      return encodeAbiParameters(maxValueAbi, [
        { maxValue: rule.maxValue },
      ]);

    case "SPEND_LIMIT":
      return encodeAbiParameters(spendLimitAbi, [
        {
          token: rule.token,
          maxAmount: rule.maxAmount,
          windowSeconds: BigInt(rule.windowSeconds),
        },
      ]);

    case "COOLDOWN":
      return encodeAbiParameters(cooldownAbi, [
        { cooldownSeconds: BigInt(rule.cooldownSeconds) },
      ]);
  }
}

function ruleTypeToEnum(type: OnChainRuleParams["type"]): RuleType {
  const map: Record<OnChainRuleParams["type"], RuleType> = {
    ALLOW_TARGETS: RuleType.ALLOW_TARGETS,
    DENY_TARGETS: RuleType.DENY_TARGETS,
    ALLOW_SELECTORS: RuleType.ALLOW_SELECTORS,
    DENY_SELECTORS: RuleType.DENY_SELECTORS,
    MAX_VALUE: RuleType.MAX_VALUE,
    SPEND_LIMIT: RuleType.SPEND_LIMIT,
    COOLDOWN: RuleType.COOLDOWN,
  };
  return map[type];
}

// ──────────────────── Public API ────────────────────

/**
 * Encode a single on-chain rule into the format expected by PolicyEngine.sol
 */
export function encodeOnChainRule(rule: OnChainRuleParams): OnChainRule {
  return {
    ruleType: ruleTypeToEnum(rule.type),
    params: encodeRuleParams(rule),
    enabled: true,
  };
}

/**
 * Encode all on-chain rules from a Policy
 */
export function encodeOnChainRules(policy: Policy): OnChainRule[] {
  return policy.rules.onChain.map(encodeOnChainRule);
}

/**
 * Convert a PolicyJSON (from schema) to a Policy (with BigInt values)
 */
export function policyFromJSON(json: PolicyJSON): Policy {
  return {
    version: json.version,
    id: json.id,
    createdAt: json.createdAt,
    failMode: json.failMode === "CLOSED" ? 0 : 1,
    rules: {
      onChain: json.rules.onChain.map((rule): OnChainRuleParams => {
        if (rule.type === "MAX_VALUE") {
          return { ...rule, maxValue: BigInt(rule.maxValue) };
        }
        if (rule.type === "SPEND_LIMIT") {
          return {
            type: rule.type,
            token: rule.token as Address,
            maxAmount: BigInt(rule.maxAmount),
            windowSeconds: rule.windowSeconds,
          };
        }
        return rule as OnChainRuleParams;
      }),
      offChain: json.rules.offChain,
    },
  };
}

/**
 * Convert a Policy to PolicyJSON (for serialization)
 */
export function policyToJSON(policy: Policy): PolicyJSON {
  return {
    version: policy.version,
    id: policy.id,
    createdAt: policy.createdAt,
    failMode: policy.failMode === 0 ? "CLOSED" : "OPEN",
    rules: {
      onChain: policy.rules.onChain.map((rule) => {
        if (rule.type === "MAX_VALUE") {
          return { ...rule, maxValue: rule.maxValue.toString() };
        }
        if (rule.type === "SPEND_LIMIT") {
          return { ...rule, maxAmount: rule.maxAmount.toString() };
        }
        return rule;
      }) as PolicyJSON["rules"]["onChain"],
      offChain: policy.rules.offChain,
    },
  };
}

/**
 * Convert a CID string to a bytes32 hex value for on-chain storage.
 * Uses keccak256 hash of the CID string as bytes.
 */
export function cidToBytes32(cid: string): Hex {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(cid);
  // Pad or truncate to 32 bytes for consistent on-chain storage
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return toHex(padded);
}
