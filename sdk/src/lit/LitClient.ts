import type { Address, Hex } from "viem";
import type { SignedPolicyApproval } from "./AttestationBuilder.js";
import { defaultExpiry } from "./AttestationBuilder.js";
import type { AccessControlCondition } from "./LitEncryption.js";

/**
 * Configuration for Lit Protocol client (v8 / Naga)
 */
export interface LitClientConfig {
  /** Lit network: naga (mainnet), naga-test (testnet), or naga-dev (dev) */
  network: "naga" | "naga-test" | "naga-dev";
  /** IPFS CID of the PolicyKit Lit Action */
  litActionCID: string;
  debug?: boolean;
}

/**
 * Parameters for executing a policy check via Lit Protocol
 */
export interface LitPolicyCheckParams {
  policyCID: string;
  caller: Address;
  target: Address;
  value: bigint;
  calldata: Hex;
  chainId: bigint;
  pkpPublicKey: string;
  /** Auth context from Lit AuthManager (v8) */
  authContext: unknown;
  expirySeconds?: number;
  /** Whether the policy on IPFS is encrypted via Lit */
  encrypted?: boolean;
}

/**
 * Result from a Lit Action policy evaluation
 */
export interface LitPolicyResult {
  approved: boolean;
  signature?: Hex;
  expiry?: bigint;
  failedRule?: string;
  reason?: string;
  ruleResults?: Array<{
    rule: string;
    passed: boolean;
    reason?: string;
  }>;
}

/**
 * Client for interacting with Lit Protocol v8 (Naga) for off-chain policy evaluation.
 *
 * The Lit Action runs on the decentralized Lit Network and:
 * 1. Fetches the policy from IPFS
 * 2. Evaluates Tier 3 off-chain rules
 * 3. If all pass, threshold-signs an EIP-712 PolicyApproval
 * 4. Returns the signature for on-chain verification
 *
 * @example
 * ```ts
 * import { createLitClient } from "@lit-protocol/lit-client";
 * import { nagaDev } from "@lit-protocol/networks";
 * import { LitClient } from "@policy-kit/sdk";
 *
 * const pkLitClient = new LitClient({
 *   network: "naga-dev",
 *   litActionCID: "QmYourLitActionCID...",
 * });
 *
 * await pkLitClient.connect();
 *
 * const result = await pkLitClient.executePolicy({
 *   policyCID: "QmPolicyCID...",
 *   caller: "0x...",
 *   target: "0x...",
 *   value: 0n,
 *   calldata: "0x...",
 *   chainId: 8453n,
 *   pkpPublicKey: "0x...",
 *   authContext: eoaAuthContext,
 * });
 * ```
 */
export class LitClient {
  private readonly config: LitClientConfig;
  private litClient: unknown = null;
  private connected = false;

  constructor(config: LitClientConfig) {
    this.config = config;
  }

  /**
   * Connect to the Lit Protocol network (v8 / Naga).
   * Must be called before executePolicy().
   *
   * Requires @lit-protocol/lit-client and @lit-protocol/networks as peer dependencies.
   */
  async connect(): Promise<void> {
    try {
      // Dynamic imports to avoid hard peer dependency
      // @ts-ignore — peer dependency, not always installed
      const litClientMod = await import("@lit-protocol/lit-client");
      // @ts-ignore — peer dependency, not always installed
      const networksMod = await import("@lit-protocol/networks");

      const createLitClientFn =
        (litClientMod as Record<string, unknown>).createLitClient ??
        (litClientMod as { default?: Record<string, unknown> }).default?.createLitClient;

      if (!createLitClientFn) {
        throw new Error("createLitClient not found in @lit-protocol/lit-client");
      }

      const networks = (networksMod as Record<string, unknown>);
      const networkMap: Record<string, unknown> = {
        naga: networks.naga ?? (networksMod as { default?: Record<string, unknown> }).default?.naga,
        "naga-test": networks.nagaTest ?? (networksMod as { default?: Record<string, unknown> }).default?.nagaTest,
        "naga-dev": networks.nagaDev ?? (networksMod as { default?: Record<string, unknown> }).default?.nagaDev,
      };

      const network = networkMap[this.config.network];
      if (!network) {
        throw new Error(`Unknown Lit network: ${this.config.network}`);
      }

      // v8: createLitClient handles connection internally — no separate connect() call
      const client = await (createLitClientFn as (opts: { network: unknown }) => Promise<unknown>)({
        network,
      });

      this.litClient = client;
      this.connected = true;
    } catch (error) {
      throw new Error(
        `Failed to connect to Lit Protocol. Ensure @lit-protocol/lit-client and @lit-protocol/networks are installed. Error: ${error}`
      );
    }
  }

  /**
   * Execute the policy evaluation Lit Action.
   *
   * In v8, core APIs use authContext instead of sessionSigs.
   * The authContext should be created via AuthManager:
   *   authManager.createEoaAuthContext({ ... }) or
   *   authManager.createPkpAuthContext({ ... })
   */
  async executePolicy(params: LitPolicyCheckParams): Promise<LitPolicyResult> {
    if (!this.connected || !this.litClient) {
      throw new Error("LitClient not connected. Call connect() first.");
    }

    const client = this.litClient as {
      executeJs: (args: {
        ipfsId: string;
        authContext: unknown;
        jsParams: Record<string, unknown>;
      }) => Promise<{ response: string; signatures?: Record<string, { signature: string }> }>;
    };

    const expiry = defaultExpiry(params.expirySeconds);

    try {
      // v8: executeJs takes authContext instead of sessionSigs
      // v8: jsParams values are accessed via jsParams.* inside the Lit Action
      const result = await client.executeJs({
        ipfsId: this.config.litActionCID,
        authContext: params.authContext,
        jsParams: {
          policyCID: params.policyCID,
          caller: params.caller,
          target: params.target,
          value: params.value.toString(),
          calldata: params.calldata,
          chainId: params.chainId.toString(),
          expiry: expiry.toString(),
          pkpPublicKey: params.pkpPublicKey,
          encrypted: params.encrypted ?? false,
        },
      });

      const response = JSON.parse(result.response) as LitPolicyResult;
      return response;
    } catch (error) {
      return {
        approved: false,
        reason: `Lit Action execution failed: ${error}`,
      };
    }
  }

  /**
   * Encrypt data using Lit Protocol's decentralized encryption.
   * The data can only be decrypted by parties satisfying the access control conditions.
   *
   * v8: Uses litClient.encrypt() with unifiedAccessControlConditions.
   * Encryption does NOT require authContext.
   */
  async encrypt(params: {
    unifiedAccessControlConditions: AccessControlCondition[];
    dataToEncrypt: string;
    chain?: string;
  }): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
    if (!this.connected || !this.litClient) {
      throw new Error("LitClient not connected. Call connect() first.");
    }

    const client = this.litClient as {
      encrypt: (args: {
        unifiedAccessControlConditions: AccessControlCondition[];
        dataToEncrypt: string;
        chain: string;
      }) => Promise<{ ciphertext: string; dataToEncryptHash: string }>;
    };

    return client.encrypt({
      unifiedAccessControlConditions: params.unifiedAccessControlConditions,
      dataToEncrypt: params.dataToEncrypt,
      chain: params.chain ?? "ethereum",
    });
  }

  /**
   * Decrypt data using Lit Protocol's decentralized decryption.
   * The caller must satisfy the access control conditions used during encryption.
   *
   * v8: Uses litClient.decrypt() with the combined `data` object from encrypt(),
   * or individual ciphertext/dataToEncryptHash fields.
   */
  async decrypt(params: {
    unifiedAccessControlConditions: AccessControlCondition[];
    /** Combined encrypted data object from encrypt(). If provided, ciphertext/dataToEncryptHash are ignored. */
    data?: { ciphertext: string; dataToEncryptHash: string };
    /** Individual ciphertext (required if data is not provided) */
    ciphertext?: string;
    /** Individual hash (required if data is not provided) */
    dataToEncryptHash?: string;
    authContext: unknown;
    chain?: string;
  }): Promise<string> {
    if (!this.connected || !this.litClient) {
      throw new Error("LitClient not connected. Call connect() first.");
    }

    const client = this.litClient as {
      decrypt: (args: {
        data?: { ciphertext: string; dataToEncryptHash: string };
        ciphertext?: string;
        dataToEncryptHash?: string;
        unifiedAccessControlConditions: AccessControlCondition[];
        authContext: unknown;
        chain: string;
      }) => Promise<{ decryptedData: Uint8Array; decryptedString?: string }>;
    };

    const result = await client.decrypt({
      ...(params.data
        ? { data: params.data }
        : { ciphertext: params.ciphertext, dataToEncryptHash: params.dataToEncryptHash }),
      unifiedAccessControlConditions: params.unifiedAccessControlConditions,
      authContext: params.authContext,
      chain: params.chain ?? "ethereum",
    });

    return result.decryptedString ?? new TextDecoder().decode(result.decryptedData);
  }

  /**
   * Disconnect from the Lit Protocol network
   */
  async disconnect(): Promise<void> {
    if (this.litClient && this.connected) {
      const client = this.litClient as { disconnect: () => void };
      client.disconnect();
      this.connected = false;
      this.litClient = null;
    }
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the underlying Lit client instance for advanced usage
   */
  getLitClient(): unknown {
    return this.litClient;
  }
}
