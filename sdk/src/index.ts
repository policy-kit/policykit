// ──────────────────── Core ────────────────────
export { PolicyBuilder } from "./core/PolicyBuilder.js";
export {
  policySchema,
  onChainRuleSchema,
  offChainRuleSchema,
  serializePolicy,
  deserializePolicy,
  validatePolicy,
  type PolicyJSON,
} from "./core/PolicySchema.js";
export {
  encodeOnChainRule,
  encodeOnChainRules,
  policyFromJSON,
  policyToJSON,
  cidToBytes32,
} from "./core/PolicyEncoder.js";
export {
  RuleType,
  FailMode,
  RuleTier,
  type Policy,
  type OnChainRuleParams,
  type OffChainRuleParams,
  type AnyRuleParams,
  type OnChainRule,
  type PolicySet,
  type RuleResult,
  type EvaluationReport,
  type PolicyKitConfig,
  type AllowTargetsParams,
  type DenyTargetsParams,
  type AllowSelectorsParams,
  type DenySelectorsParams,
  type MaxValueParams,
  type SpendLimitParams,
  type CooldownParams,
  type MaxSlippageBpsParams,
  type RequireSimulationParams,
  type CustomRuleParams,
} from "./core/types.js";

// ──────────────────── IPFS ────────────────────
export {
  IPFSClient,
  type IPFSBackendConfig,
  type PinResult,
} from "./ipfs/IPFSClient.js";
export {
  cidToBytes32 as cidToBytes32Util,
  bytes32ToCid,
  isValidCID,
} from "./ipfs/CIDUtils.js";

// ──────────────────── Contracts ────────────────────
export {
  PolicyEngineClient,
  getChainConfig,
  type PolicyEngineClientConfig,
} from "./contracts/PolicyEngineClient.js";
export { POLICY_ENGINE_ABI } from "./contracts/abis/PolicyEngineABI.js";

// ──────────────────── Lit Protocol ────────────────────
export {
  LitClient,
  type LitClientConfig,
  type LitPolicyCheckParams,
  type LitPolicyResult,
} from "./lit/LitClient.js";
export {
  PKPManager,
  type PKPManagerConfig,
  type PKPInfo,
} from "./lit/PKPManager.js";
export {
  buildPolicyApproval,
  encodeAttestation,
  defaultExpiry,
  POLICY_KIT_DOMAIN,
  POLICY_APPROVAL_TYPES,
  type PolicyApprovalParams,
  type SignedPolicyApproval,
} from "./lit/AttestationBuilder.js";
export {
  encryptPolicy,
  decryptPolicy,
  isEncryptedEnvelope,
  buildOwnerAndPkpACCs,
  ENCRYPTED_ENVELOPE_VERSION,
  type EncryptedPolicyEnvelope,
  type EncryptionOptions,
  type AccessControlCondition,
  type EvmBasicCondition,
  type BooleanOperator,
} from "./lit/LitEncryption.js";

// ──────────────────── Simulation ────────────────────
export { PolicySimulator } from "./simulation/PolicySimulator.js";

// ──────────────────── High-level API ────────────────────

import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { PolicyBuilder } from "./core/PolicyBuilder.js";
import { encodeOnChainRules, policyToJSON } from "./core/PolicyEncoder.js";
import { IPFSClient, type IPFSBackendConfig } from "./ipfs/IPFSClient.js";
import { cidToBytes32 } from "./ipfs/CIDUtils.js";
import {
  PolicyEngineClient,
  type PolicyEngineClientConfig,
} from "./contracts/PolicyEngineClient.js";
import { LitClient, type LitClientConfig } from "./lit/LitClient.js";
import {
  encodeAttestation,
  type SignedPolicyApproval,
} from "./lit/AttestationBuilder.js";
import { PolicySimulator } from "./simulation/PolicySimulator.js";
import type { Policy, EvaluationReport, PolicyKitConfig } from "./core/types.js";
import {
  encryptPolicy as encryptPolicyFn,
  decryptPolicy as decryptPolicyFn,
  isEncryptedEnvelope,
  type EncryptionOptions,
} from "./lit/LitEncryption.js";
import { deserializePolicy, type PolicyJSON } from "./core/PolicySchema.js";

/**
 * High-level PolicyKit SDK entry point.
 *
 * @example
 * ```ts
 * import { PolicyKit, PolicyBuilder } from "@policykit/sdk";
 *
 * // Build a policy
 * const policy = new PolicyBuilder("my-agent-policy")
 *   .allowTargets([UNISWAP_ROUTER])
 *   .maxValue(parseEther("1"))
 *   .maxSlippageBps(50)
 *   .build();
 *
 * // Initialize the SDK
 * const pk = new PolicyKit({
 *   publicClient,
 *   walletClient,
 *   engineAddress: POLICY_ENGINE_ADDRESS,
 *   ipfsBackends: [{ type: "pinata", apiKey: "...", apiSecret: "..." }],
 *   litConfig: { network: "naga", litActionCID: "Qm..." },
 * });
 *
 * // Deploy the policy
 * await pk.deployPolicy(policy);
 *
 * // Simulate a transaction against the policy
 * const report = await pk.simulate(policy, {
 *   target: UNISWAP_ROUTER,
 *   value: 0n,
 *   data: swapCalldata,
 * });
 * ```
 */
export class PolicyKit {
  private readonly engineClient: PolicyEngineClient;
  private readonly ipfsClient: IPFSClient;
  private readonly litClient?: LitClient;
  private readonly simulator: PolicySimulator;
  private readonly walletClient?: WalletClient;

  constructor(config: {
    publicClient: PublicClient;
    walletClient?: WalletClient;
    engineAddress: Address;
    ipfsBackends?: IPFSBackendConfig[];
    ipfsGateway?: string;
    litConfig?: LitClientConfig;
  }) {
    this.engineClient = new PolicyEngineClient({
      publicClient: config.publicClient,
      walletClient: config.walletClient,
      engineAddress: config.engineAddress,
    });

    this.ipfsClient = new IPFSClient(
      config.ipfsBackends,
      config.ipfsGateway
    );

    if (config.litConfig) {
      this.litClient = new LitClient(config.litConfig);
    }

    this.simulator = new PolicySimulator();
    this.walletClient = config.walletClient;
  }

  /**
   * Create a new PolicyBuilder instance
   */
  static policy(id: string): PolicyBuilder {
    return new PolicyBuilder(id);
  }

  /**
   * Deploy a policy: pin to IPFS + set on-chain.
   *
   * When `options.encrypt` is true, the policy is encrypted using Lit Protocol
   * before pinning to IPFS. Only the policy owner and the bound PKP can decrypt it.
   * Requires a connected LitClient.
   */
  async deployPolicy(
    policy: Policy,
    pkpAddress: Address = "0x0000000000000000000000000000000000000000",
    options?: { encrypt?: boolean; encryptionChain?: string }
  ): Promise<{ txHash: Hex; cid: string; encrypted: boolean }> {
    const policyJSON = policyToJSON(policy);
    let pinResult;
    let encrypted = false;

    if (options?.encrypt) {
      // Encryption requires a connected LitClient and a wallet
      if (!this.litClient) {
        throw new Error(
          "LitClient required for encrypted policies. Provide litConfig in the constructor."
        );
      }
      if (!this.litClient.isConnected()) {
        throw new Error(
          "LitClient not connected. Call getClients().lit.connect() before deploying an encrypted policy."
        );
      }

      const ownerAddress = this.walletClient?.account?.address;
      if (!ownerAddress) {
        throw new Error(
          "WalletClient with account required for encrypted policy deployment."
        );
      }

      const encryptionOptions: EncryptionOptions = {
        ownerAddress,
        pkpAddress,
        chain: options.encryptionChain ?? "ethereum",
      };

      // Encrypt the policy via Lit Protocol
      const envelope = await encryptPolicyFn(
        this.litClient,
        policyJSON,
        encryptionOptions
      );

      // Pin the encrypted envelope (as raw JSON string)
      pinResult = await this.ipfsClient.pinRaw(JSON.stringify(envelope));
      encrypted = true;
    } else {
      // Pin plain policy JSON as before
      pinResult = await this.ipfsClient.pin(policyJSON);
    }

    // Encode on-chain rules
    const onChainRules = encodeOnChainRules(policy);

    // Deploy on-chain
    const hasOffChainRules = policy.rules.offChain.length > 0;
    const txHash = await this.engineClient.deployPolicy({
      policyCID: cidToBytes32(pinResult.cid),
      pkpAddress,
      requireAttestation: hasOffChainRules,
      failMode: policy.failMode,
      rules: onChainRules,
    });

    return { txHash, cid: pinResult.cid, encrypted };
  }

  /**
   * Fetch a policy from IPFS by CID.
   * Automatically detects and decrypts encrypted policy envelopes.
   *
   * @param cid - IPFS CID of the policy
   * @param authContext - Lit auth context, required only for encrypted policies
   */
  async fetchPolicy(
    cid: string,
    authContext?: unknown
  ): Promise<PolicyJSON> {
    const raw = await this.ipfsClient.fetchRaw(cid);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Failed to parse IPFS content as JSON");
    }

    if (isEncryptedEnvelope(parsed)) {
      if (!this.litClient) {
        throw new Error(
          "LitClient required to decrypt encrypted policy. Provide litConfig in the constructor."
        );
      }
      if (!this.litClient.isConnected()) {
        throw new Error(
          "LitClient not connected. Call getClients().lit.connect() before fetching an encrypted policy."
        );
      }
      if (authContext === undefined) {
        throw new Error(
          "authContext is required to decrypt an encrypted policy."
        );
      }

      return decryptPolicyFn(this.litClient, parsed, authContext);
    }

    // Plain policy — validate through schema
    return deserializePolicy(raw);
  }

  /**
   * Remove the policy for the caller's account
   */
  async removePolicy(): Promise<Hex> {
    return this.engineClient.removePolicy();
  }

  /**
   * Simulate a transaction against a policy locally
   */
  async simulate(
    policy: Policy,
    params: { target: Address; value: bigint; data: Hex }
  ): Promise<EvaluationReport> {
    const caller = this.walletClient?.account?.address;
    if (!caller) {
      throw new Error("WalletClient with account required for simulation");
    }

    return this.simulator.evaluate({
      policy,
      caller,
      target: params.target,
      value: params.value,
      data: params.data,
    });
  }

  /**
   * Format a simulation report for display
   */
  formatReport(report: EvaluationReport): string {
    return this.simulator.formatReport(report);
  }

  /**
   * Get the underlying clients for advanced usage
   */
  getClients() {
    return {
      engine: this.engineClient,
      ipfs: this.ipfsClient,
      lit: this.litClient,
      simulator: this.simulator,
    };
  }
}
