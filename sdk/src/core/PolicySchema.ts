import { z } from "zod";

// ──────────────────── Rule Schemas ────────────────────

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");
const selectorSchema = z.string().regex(/^0x[a-fA-F0-9]{8}$/, "Invalid selector");

const allowTargetsSchema = z.object({
  type: z.literal("ALLOW_TARGETS"),
  targets: z.array(addressSchema).min(1),
});

const denyTargetsSchema = z.object({
  type: z.literal("DENY_TARGETS"),
  targets: z.array(addressSchema).min(1),
});

const allowSelectorsSchema = z.object({
  type: z.literal("ALLOW_SELECTORS"),
  selectors: z.array(selectorSchema).min(1),
});

const denySelectorsSchema = z.object({
  type: z.literal("DENY_SELECTORS"),
  selectors: z.array(selectorSchema).min(1),
});

const maxValueSchema = z.object({
  type: z.literal("MAX_VALUE"),
  maxValue: z.string(), // BigInt as string in JSON
});

const spendLimitSchema = z.object({
  type: z.literal("SPEND_LIMIT"),
  token: addressSchema,
  maxAmount: z.string(), // BigInt as string in JSON
  windowSeconds: z.number().positive(),
});

const cooldownSchema = z.object({
  type: z.literal("COOLDOWN"),
  cooldownSeconds: z.number().positive(),
});

// Tier 3 (off-chain) rule schemas
const maxSlippageBpsSchema = z.object({
  type: z.literal("MAX_SLIPPAGE_BPS"),
  maxBps: z.number().min(1).max(10000),
});

const requireSimulationSchema = z.object({
  type: z.literal("REQUIRE_SIMULATION"),
  mustSucceed: z.boolean(),
});

const customRuleSchema = z.object({
  type: z.literal("CUSTOM"),
  name: z.string().min(1),
  description: z.string(),
  logicCID: z.string().optional(),
});

// ──────────────────── Union Schemas ────────────────────

export const onChainRuleSchema = z.discriminatedUnion("type", [
  allowTargetsSchema,
  denyTargetsSchema,
  allowSelectorsSchema,
  denySelectorsSchema,
  maxValueSchema,
  spendLimitSchema,
  cooldownSchema,
]);

export const offChainRuleSchema = z.discriminatedUnion("type", [
  maxSlippageBpsSchema,
  requireSimulationSchema,
  customRuleSchema,
]);

// ──────────────────── Policy Schema ────────────────────

export const policySchema = z.object({
  version: z.string(),
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  failMode: z.enum(["CLOSED", "OPEN"]),
  rules: z.object({
    onChain: z.array(onChainRuleSchema),
    offChain: z.array(offChainRuleSchema),
  }),
});

export type PolicyJSON = z.infer<typeof policySchema>;

// ──────────────────── Serialization ────────────────────

/**
 * Serialize a policy to canonical JSON (deterministic for IPFS CID).
 * Keys are sorted and no whitespace is used.
 */
export function serializePolicy(policy: PolicyJSON): string {
  return JSON.stringify(policy, Object.keys(policy).sort());
}

/**
 * Deserialize and validate a policy from JSON string.
 */
export function deserializePolicy(json: string): PolicyJSON {
  const parsed = JSON.parse(json);
  return policySchema.parse(parsed);
}

/**
 * Validate a policy object against the schema.
 */
export function validatePolicy(policy: unknown): PolicyJSON {
  return policySchema.parse(policy);
}
