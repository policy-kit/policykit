import type { Address } from "viem";
import type { PolicyJSON } from "../core/PolicySchema.js";
import { serializePolicy, deserializePolicy } from "../core/PolicySchema.js";

// ──────────────────── Constants ────────────────────

export const ENCRYPTED_ENVELOPE_VERSION = "policykit-enc-1";

// ──────────────────── Types ────────────────────

/**
 * A single EVM basic access control condition for Lit Protocol.
 */
export interface EvmBasicCondition {
  conditionType: "evmBasic";
  contractAddress: string;
  standardContractType: string;
  chain: string;
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: string;
    value: string;
  };
}

/**
 * Boolean operator used between access control conditions.
 */
export interface BooleanOperator {
  operator: "and" | "or";
}

/**
 * Lit Protocol access control condition — either a concrete condition or a boolean operator.
 */
export type AccessControlCondition = EvmBasicCondition | BooleanOperator;

/**
 * Encrypted policy envelope stored on IPFS.
 * The `v` field allows forward-compatible detection and parsing.
 */
export interface EncryptedPolicyEnvelope {
  /** Envelope format version */
  v: typeof ENCRYPTED_ENVELOPE_VERSION;
  /** Base64-encoded ciphertext from Lit encrypt */
  ciphertext: string;
  /** Hex hash of the plaintext, required by Lit decrypt */
  dataToEncryptHash: string;
  /** Access control conditions used for encryption */
  accessControlConditions: AccessControlCondition[];
}

/**
 * Options for encrypting a policy before pinning to IPFS.
 */
export interface EncryptionOptions {
  /** Address of the policy owner (EOA or smart account) */
  ownerAddress: Address;
  /** Address of the Lit PKP bound to the policy */
  pkpAddress: Address;
  /** EVM chain for the access control conditions (default: "ethereum") */
  chain?: string;
  /** Optional custom access control conditions (overrides default owner+PKP ACCs) */
  accessControlConditions?: AccessControlCondition[];
}

// ──────────────────── ACC Builder ────────────────────

/**
 * Build access control conditions that allow decryption by either
 * the policy owner or the bound PKP address.
 *
 * The resulting array uses Lit's boolean OR operator:
 * [ ownerCondition, { operator: "or" }, pkpCondition ]
 */
export function buildOwnerAndPkpACCs(
  ownerAddress: Address,
  pkpAddress: Address,
  chain = "ethereum"
): AccessControlCondition[] {
  const ownerCondition: EvmBasicCondition = {
    conditionType: "evmBasic",
    contractAddress: "",
    standardContractType: "",
    chain,
    method: "",
    parameters: [":userAddress"],
    returnValueTest: {
      comparator: "=",
      value: ownerAddress.toLowerCase(),
    },
  };

  const pkpCondition: EvmBasicCondition = {
    conditionType: "evmBasic",
    contractAddress: "",
    standardContractType: "",
    chain,
    method: "",
    parameters: [":userAddress"],
    returnValueTest: {
      comparator: "=",
      value: pkpAddress.toLowerCase(),
    },
  };

  return [ownerCondition, { operator: "or" }, pkpCondition];
}

// ──────────────────── Type Guard ────────────────────

/**
 * Type guard to check if raw IPFS data is an encrypted policy envelope.
 */
export function isEncryptedEnvelope(
  data: unknown
): data is EncryptedPolicyEnvelope {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.v === ENCRYPTED_ENVELOPE_VERSION &&
    typeof obj.ciphertext === "string" &&
    typeof obj.dataToEncryptHash === "string" &&
    Array.isArray(obj.accessControlConditions)
  );
}

// ──────────────────── Encrypt / Decrypt ────────────────────

/**
 * Encrypt a policy using the Lit Protocol and return an envelope
 * suitable for pinning to IPFS.
 *
 * @param litClient - Connected LitClient instance (must expose encrypt())
 * @param policy - Policy JSON to encrypt
 * @param options - Encryption options (owner, PKP, chain, optional custom ACCs)
 * @returns Encrypted envelope ready for IPFS storage
 */
export async function encryptPolicy(
  litClient: {
    encrypt: (params: {
      accessControlConditions: AccessControlCondition[];
      dataToEncrypt: string;
    }) => Promise<{ ciphertext: string; dataToEncryptHash: string }>;
  },
  policy: PolicyJSON,
  options: EncryptionOptions
): Promise<EncryptedPolicyEnvelope> {
  const accs =
    options.accessControlConditions ??
    buildOwnerAndPkpACCs(
      options.ownerAddress,
      options.pkpAddress,
      options.chain ?? "ethereum"
    );

  const plaintext = serializePolicy(policy);

  const { ciphertext, dataToEncryptHash } = await litClient.encrypt({
    accessControlConditions: accs,
    dataToEncrypt: plaintext,
  });

  return {
    v: ENCRYPTED_ENVELOPE_VERSION,
    ciphertext,
    dataToEncryptHash,
    accessControlConditions: accs,
  };
}

/**
 * Decrypt an encrypted policy envelope using the Lit Protocol.
 *
 * @param litClient - Connected LitClient instance (must expose decrypt())
 * @param envelope - Encrypted envelope fetched from IPFS
 * @param authContext - Lit auth context for decryption authorization
 * @returns Decrypted and validated PolicyJSON
 */
export async function decryptPolicy(
  litClient: {
    decrypt: (params: {
      accessControlConditions: AccessControlCondition[];
      ciphertext: string;
      dataToEncryptHash: string;
      authContext: unknown;
    }) => Promise<string>;
  },
  envelope: EncryptedPolicyEnvelope,
  authContext: unknown
): Promise<PolicyJSON> {
  const plaintext = await litClient.decrypt({
    accessControlConditions: envelope.accessControlConditions,
    ciphertext: envelope.ciphertext,
    dataToEncryptHash: envelope.dataToEncryptHash,
    authContext,
  });

  return deserializePolicy(plaintext);
}
