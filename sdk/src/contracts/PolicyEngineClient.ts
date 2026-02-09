import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  type Chain,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import type {
  OnChainRule,
  PolicySet,
} from "../core/types.js";
import { POLICY_ENGINE_ABI } from "./abis/PolicyEngineABI.js";

export interface PolicyEngineClientConfig {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  engineAddress: Address;
}

/**
 * Typed wrapper around PolicyEngine.sol using viem
 */
export class PolicyEngineClient {
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly engineAddress: Address;

  constructor(config: PolicyEngineClientConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.engineAddress = config.engineAddress;
  }

  /**
   * Deploy a policy set for the caller's account
   */
  async deployPolicy(params: {
    policyCID: Hex;
    pkpAddress: Address;
    requireAttestation: boolean;
    failMode: number;
    rules: OnChainRule[];
  }): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("WalletClient required for write operations");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.walletClient.chain ?? null,
      account: this.walletClient.account!,
      address: this.engineAddress,
      abi: POLICY_ENGINE_ABI,
      functionName: "setPolicySet",
      args: [
        params.policyCID,
        params.pkpAddress,
        params.requireAttestation,
        params.failMode,
        params.rules.map((r) => ({
          ruleType: r.ruleType,
          params: r.params as Hex,
          enabled: r.enabled,
        })),
      ],
    });

    return hash;
  }

  /**
   * Get the policy for an account
   */
  async getPolicy(account: Address): Promise<PolicySet> {
    const result = await this.publicClient.readContract({
      address: this.engineAddress,
      abi: POLICY_ENGINE_ABI,
      functionName: "getPolicy",
      args: [account],
    });

    return result as unknown as PolicySet;
  }

  /**
   * Check if an account has a policy set
   */
  async hasPolicy(account: Address): Promise<boolean> {
    const result = await this.publicClient.readContract({
      address: this.engineAddress,
      abi: POLICY_ENGINE_ABI,
      functionName: "hasPolicy",
      args: [account],
    });

    return result as boolean;
  }

  /**
   * Remove the policy for the caller's account
   */
  async removePolicy(): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("WalletClient required for write operations");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.walletClient.chain ?? null,
      account: this.walletClient.account!,
      address: this.engineAddress,
      abi: POLICY_ENGINE_ABI,
      functionName: "removePolicySet",
    });

    return hash;
  }

  /**
   * Simulate a policy check via eth_call (does not modify state)
   */
  async simulateCheckPolicy(params: {
    account: Address;
    target: Address;
    value: bigint;
    data: Hex;
    attestation: Hex;
  }): Promise<boolean> {
    const { result } = await this.publicClient.simulateContract({
      address: this.engineAddress,
      abi: POLICY_ENGINE_ABI,
      functionName: "checkPolicy",
      args: [
        params.account,
        params.target,
        params.value,
        params.data,
        params.attestation,
      ],
    });

    return result as boolean;
  }

  /**
   * Get the chain for the currently configured client
   */
  getChain(): Chain | undefined {
    return this.publicClient.chain;
  }

  /**
   * Get the engine contract address
   */
  getEngineAddress(): Address {
    return this.engineAddress;
  }
}

/**
 * Get the default chain configuration
 */
export function getChainConfig(chain: "base" | "base-sepolia"): Chain {
  return chain === "base" ? base : baseSepolia;
}
