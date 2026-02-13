import type { Address } from "viem";

/**
 * Configuration for PKP management (Lit SDK v8 / Naga)
 */
export interface PKPManagerConfig {
  /** The Lit network to use */
  litNetwork: "naga" | "naga-test" | "naga-dev";
}

/**
 * Information about a minted PKP
 */
export interface PKPInfo {
  tokenId: string;
  publicKey: string;
  ethAddress: Address;
}

/**
 * Manages Lit Protocol Programmable Key Pairs (PKPs) for PolicyKit.
 * Updated for Lit SDK v8 (Naga).
 *
 * In v8, PKP minting and permission management moved to the litClient:
 *   - `litClient.mintWithEoa(...)` / `litClient.mintWithAuth(...)`
 *   - `litClient.getPKPPermissionsManager()` for managing permissions
 *
 * PKPs are threshold keys that can only sign when invoked by a specific
 * Lit Action (identified by its IPFS CID). This ensures:
 * - No single entity can use the PKP to sign arbitrary data
 * - The PKP can only sign policy approvals when the Lit Action code says so
 * - The user owns the PKP NFT (non-custodial)
 *
 * @example
 * ```ts
 * import { createLitClient } from "@lit-protocol/lit-client";
 * import { nagaDev } from "@lit-protocol/networks";
 *
 * const litClient = await createLitClient({ network: nagaDev });
 *
 * const pkpManager = new PKPManager({
 *   litNetwork: "naga-dev",
 * });
 *
 * const pkp = await pkpManager.mintPKP({
 *   litClient,
 *   account: myViemAccount,
 *   permittedActionCID: "QmYourLitActionCID...",
 * });
 *
 * console.log(pkp.ethAddress); // Use this as pkpAddress in PolicyEngine
 * ```
 */
export class PKPManager {
  private readonly config: PKPManagerConfig;

  constructor(config: PKPManagerConfig) {
    this.config = config;
  }

  /**
   * Mint a new PKP bound to a specific Lit Action.
   *
   * In v8, PKP minting uses litClient.mintWithEoa() or litClient.mintWithAuth().
   * After minting, use getPKPPermissionsManager() to set permitted actions.
   *
   * @param params.litClient - The Lit client instance (from createLitClient)
   * @param params.account - A viem Account used to sign the on-chain mint tx
   * @param params.permittedActionCID - IPFS CID of the Lit Action to bind
   */
  async mintPKP(params: {
    litClient: unknown;
    account: unknown;
    permittedActionCID: string;
  }): Promise<PKPInfo> {
    try {
      const client = params.litClient as {
        mintWithEoa: (args: { account: unknown }) => Promise<{
          hash: string;
          data: { tokenId: string; publicKey: string; ethAddress: string };
        }>;
        getPKPPermissionsManager: (args: {
          pkpIdentifier: { tokenId: string };
          account: unknown;
        }) => Promise<{
          addPermittedAction: (args: {
            ipfsId: string;
            scopes: string[];
          }) => Promise<unknown>;
        }>;
      };

      // v8: Mint PKP using the litClient directly
      const mintResult = await client.mintWithEoa({
        account: params.account,
      });

      const pkpInfo: PKPInfo = {
        tokenId: mintResult.data.tokenId,
        publicKey: mintResult.data.publicKey,
        ethAddress: mintResult.data.ethAddress as Address,
      };

      // v8: Use PKP Permissions Manager to add permitted action
      const permissionsManager = await client.getPKPPermissionsManager({
        pkpIdentifier: { tokenId: pkpInfo.tokenId },
        account: params.account,
      });
      await permissionsManager.addPermittedAction({
        ipfsId: params.permittedActionCID,
        scopes: ["sign-anything"],
      });

      return pkpInfo;
    } catch (error) {
      throw new Error(
        `Failed to mint PKP. Ensure @lit-protocol/lit-client is installed and connected. Error: ${error}`
      );
    }
  }

  /**
   * Get PKP info by token ID using the litClient view helpers (v8).
   */
  async getPKPInfo(params: {
    litClient: unknown;
    tokenId: string;
  }): Promise<PKPInfo> {
    try {
      const client = params.litClient as {
        viewPKPsByAddress?: (args: { ownerAddress: string }) => Promise<
          Array<{ tokenId: string; publicKey: string; ethAddress: string }>
        >;
      };

      // In v8, PKP view helpers are available on the litClient
      // For direct token ID lookup, use the contracts package
      // @ts-ignore — peer dependency
      const { LitContracts } = await import("@lit-protocol/contracts");

      const networkMap: Record<string, string> = {
        naga: "naga",
        "naga-test": "naga-test",
        "naga-dev": "naga-dev",
      };

      const contracts = new LitContracts({
        network: networkMap[this.config.litNetwork],
      });
      await contracts.connect();

      const publicKey = await contracts.pkpNftContract.read.getPubkey(params.tokenId);
      const ethAddress = (await contracts.pkpNftContract.read.getEthAddress(
        params.tokenId
      )) as Address;

      return {
        tokenId: params.tokenId,
        publicKey: publicKey as string,
        ethAddress,
      };
    } catch (error) {
      throw new Error(`Failed to get PKP info: ${error}`);
    }
  }

  /**
   * Update the permitted Lit Action CID for a PKP (v8).
   * Uses litClient.getPKPPermissionsManager() for permission management.
   */
  async updatePermittedAction(params: {
    litClient: unknown;
    account: unknown;
    pkpTokenId: string;
    oldActionCID: string;
    newActionCID: string;
  }): Promise<void> {
    try {
      const client = params.litClient as {
        getPKPPermissionsManager: (args: {
          pkpIdentifier: { tokenId: string };
          account: unknown;
        }) => Promise<{
          addPermittedAction: (args: {
            ipfsId: string;
            scopes: string[];
          }) => Promise<unknown>;
          removePermittedAction?: (args: {
            ipfsId: string;
          }) => Promise<unknown>;
        }>;
      };

      const permissionsManager = await client.getPKPPermissionsManager({
        pkpIdentifier: { tokenId: params.pkpTokenId },
        account: params.account,
      });

      // Remove old permitted action
      if (permissionsManager.removePermittedAction) {
        await permissionsManager.removePermittedAction({
          ipfsId: params.oldActionCID,
        });
      }

      // Add new permitted action
      await permissionsManager.addPermittedAction({
        ipfsId: params.newActionCID,
        scopes: ["sign-anything"],
      });
    } catch (error) {
      throw new Error(`Failed to update permitted action: ${error}`);
    }
  }
}
