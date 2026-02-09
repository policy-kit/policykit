import { toHex, type Hex } from "viem";

/**
 * Convert a CID string to bytes32 hex for on-chain storage.
 * Uses the raw bytes of the CID (truncated/padded to 32 bytes).
 */
export function cidToBytes32(cid: string): Hex {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(cid);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return toHex(padded);
}

/**
 * Convert a bytes32 hex back to a CID string.
 * Strips trailing null bytes.
 */
export function bytes32ToCid(hex: Hex): string {
  const bytes = hexToBytes(hex);
  // Find the last non-zero byte
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end--;
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes.slice(0, end));
}

/**
 * Validate that a string looks like an IPFS CID.
 * Supports CIDv0 (Qm...) and CIDv1 (bafy...).
 */
export function isValidCID(cid: string): boolean {
  // CIDv0: starts with Qm, 46 chars
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) {
    return true;
  }
  // CIDv1: starts with bafy, variable length
  if (/^bafy[a-z2-7]{50,}$/.test(cid)) {
    return true;
  }
  return false;
}

function hexToBytes(hex: Hex): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
