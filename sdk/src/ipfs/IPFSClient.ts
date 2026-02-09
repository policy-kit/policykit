import type { PolicyJSON } from "../core/PolicySchema.js";
import { serializePolicy, deserializePolicy } from "../core/PolicySchema.js";

/**
 * Configuration for IPFS client backends
 */
export interface IPFSBackendConfig {
  type: "pinata" | "web3storage" | "local";
  apiKey?: string;
  apiSecret?: string;
  gateway?: string;
  apiUrl?: string;
}

/**
 * Result of pinning content to IPFS
 */
export interface PinResult {
  cid: string;
  size: number;
}

/**
 * IPFS client for pinning and fetching PolicyKit policies.
 * Supports multiple backends for redundancy.
 */
export class IPFSClient {
  private readonly backends: IPFSBackendConfig[];
  private readonly defaultGateway: string;

  constructor(
    backends: IPFSBackendConfig[] = [],
    defaultGateway = "https://ipfs.io/ipfs"
  ) {
    this.backends = backends;
    this.defaultGateway = defaultGateway;
  }

  /**
   * Pin a policy JSON to IPFS.
   * Pins to all configured backends for redundancy.
   */
  async pin(policy: PolicyJSON): Promise<PinResult> {
    const content = serializePolicy(policy);

    // Try each backend
    for (const backend of this.backends) {
      try {
        return await this.pinToBackend(backend, content);
      } catch (error) {
        console.warn(
          `Failed to pin to ${backend.type}, trying next backend...`,
          error
        );
      }
    }

    // If no backends configured or all fail, throw
    throw new Error(
      "Failed to pin to IPFS. Configure at least one backend (pinata, web3storage, or local)."
    );
  }

  /**
   * Fetch a policy from IPFS by CID.
   */
  async fetch(cid: string): Promise<PolicyJSON> {
    const url = `${this.defaultGateway}/${cid}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
    }

    const text = await response.text();
    return deserializePolicy(text);
  }

  /**
   * Pin raw string content to IPFS (e.g. an encrypted policy envelope).
   * Unlike pin(), this does not serialize through PolicyJSON.
   */
  async pinRaw(content: string): Promise<PinResult> {
    for (const backend of this.backends) {
      try {
        return await this.pinToBackend(backend, content);
      } catch (error) {
        console.warn(
          `Failed to pin to ${backend.type}, trying next backend...`,
          error
        );
      }
    }

    throw new Error(
      "Failed to pin to IPFS. Configure at least one backend (pinata, web3storage, or local)."
    );
  }

  /**
   * Fetch raw string content from IPFS by CID.
   * Unlike fetch(), this does not deserialize through PolicyJSON validation.
   */
  async fetchRaw(cid: string): Promise<string> {
    const url = `${this.defaultGateway}/${cid}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Verify that a CID matches the expected content.
   */
  async verify(cid: string, policy: PolicyJSON): Promise<boolean> {
    try {
      const fetched = await this.fetch(cid);
      const fetchedContent = serializePolicy(fetched);
      const expectedContent = serializePolicy(policy);
      return fetchedContent === expectedContent;
    } catch {
      return false;
    }
  }

  private async pinToBackend(
    backend: IPFSBackendConfig,
    content: string
  ): Promise<PinResult> {
    switch (backend.type) {
      case "pinata":
        return this.pinToPinata(backend, content);
      case "web3storage":
        return this.pinToWeb3Storage(backend, content);
      case "local":
        return this.pinToLocal(backend, content);
      default:
        throw new Error(`Unknown IPFS backend: ${backend.type}`);
    }
  }

  private async pinToPinata(
    config: IPFSBackendConfig,
    content: string
  ): Promise<PinResult> {
    const apiUrl = config.apiUrl || "https://api.pinata.cloud";

    const response = await fetch(`${apiUrl}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: config.apiKey || "",
        pinata_secret_api_key: config.apiSecret || "",
      },
      body: JSON.stringify({
        pinataContent: JSON.parse(content),
        pinataMetadata: { name: "policykit-policy" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Pinata pin failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { IpfsHash: string; PinSize: number };
    return { cid: data.IpfsHash, size: data.PinSize };
  }

  private async pinToWeb3Storage(
    config: IPFSBackendConfig,
    content: string
  ): Promise<PinResult> {
    const apiUrl = config.apiUrl || "https://api.web3.storage";

    const response = await fetch(`${apiUrl}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`web3.storage pin failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { cid: string };
    return { cid: data.cid, size: content.length };
  }

  private async pinToLocal(
    config: IPFSBackendConfig,
    content: string
  ): Promise<PinResult> {
    const apiUrl = config.apiUrl || "http://localhost:5001";

    const formData = new FormData();
    formData.append("file", new Blob([content], { type: "application/json" }));

    const response = await fetch(`${apiUrl}/api/v0/add`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Local IPFS pin failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { Hash: string; Size: string };
    return { cid: data.Hash, size: parseInt(data.Size) };
  }
}
