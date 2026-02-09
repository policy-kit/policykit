import type { Address, Hex } from "viem";

// ──────────────────── Rule Types ────────────────────

export enum RuleType {
  ALLOW_TARGETS = 0,
  DENY_TARGETS = 1,
  ALLOW_SELECTORS = 2,
  DENY_SELECTORS = 3,
  MAX_VALUE = 4,
  SPEND_LIMIT = 5,
  COOLDOWN = 6,
}

export enum FailMode {
  CLOSED = 0,
  OPEN = 1,
}

export enum RuleTier {
  TIER_1 = 1, // On-chain, stateless
  TIER_2 = 2, // On-chain, stateful
  TIER_3 = 3, // Off-chain, Lit Protocol
}

// ──────────────────── Rule Definitions ────────────────────

export interface AllowTargetsParams {
  type: "ALLOW_TARGETS";
  targets: Address[];
}

export interface DenyTargetsParams {
  type: "DENY_TARGETS";
  targets: Address[];
}

export interface AllowSelectorsParams {
  type: "ALLOW_SELECTORS";
  selectors: Hex[];
}

export interface DenySelectorsParams {
  type: "DENY_SELECTORS";
  selectors: Hex[];
}

export interface MaxValueParams {
  type: "MAX_VALUE";
  maxValue: bigint;
}

export interface SpendLimitParams {
  type: "SPEND_LIMIT";
  token: Address;
  maxAmount: bigint;
  windowSeconds: number;
}

export interface CooldownParams {
  type: "COOLDOWN";
  cooldownSeconds: number;
}

// Tier 3 (off-chain) rules
export interface MaxSlippageBpsParams {
  type: "MAX_SLIPPAGE_BPS";
  maxBps: number;
}

export interface RequireSimulationParams {
  type: "REQUIRE_SIMULATION";
  mustSucceed: boolean;
}

export interface CustomRuleParams {
  type: "CUSTOM";
  name: string;
  description: string;
  logicCID?: string;
}

// ──────────────────── Union Types ────────────────────

export type OnChainRuleParams =
  | AllowTargetsParams
  | DenyTargetsParams
  | AllowSelectorsParams
  | DenySelectorsParams
  | MaxValueParams
  | SpendLimitParams
  | CooldownParams;

export type OffChainRuleParams =
  | MaxSlippageBpsParams
  | RequireSimulationParams
  | CustomRuleParams;

export type AnyRuleParams = OnChainRuleParams | OffChainRuleParams;

// ──────────────────── Rule with Tier ────────────────────

export interface PolicyRule {
  tier: RuleTier;
  params: AnyRuleParams;
}

// ──────────────────── Policy ────────────────────

export interface Policy {
  version: string;
  id: string;
  createdAt: string;
  failMode: FailMode;
  rules: {
    onChain: OnChainRuleParams[];
    offChain: OffChainRuleParams[];
  };
}

// ──────────────────── On-chain Rule Struct ────────────────────

export interface OnChainRule {
  ruleType: RuleType;
  params: Hex;
  enabled: boolean;
}

// ──────────────────── Policy Set (on-chain) ────────────────────

export interface PolicySet {
  policyCID: Hex;
  pkpAddress: Address;
  requireAttestation: boolean;
  failMode: FailMode;
  ruleCount: bigint;
  exists: boolean;
}

// ──────────────────── Evaluation Result ────────────────────

export interface RuleResult {
  rule: string;
  tier: RuleTier;
  passed: boolean;
  reason: string;
}

export interface EvaluationReport {
  passed: boolean;
  results: RuleResult[];
}

// ──────────────────── Config ────────────────────

export interface PolicyKitConfig {
  chain: "base" | "base-sepolia";
  rpcUrl?: string;
  /** Lit network (v8 / Naga): naga (mainnet), naga-test (testnet), or naga-dev (dev) */
  litNetwork?: "naga" | "naga-test" | "naga-dev";
  ipfsGateway?: string;
}
