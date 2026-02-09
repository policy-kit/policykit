import {
  type Address,
  type Hex,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";

/**
 * EIP-712 domain for PolicyKit attestations
 */
export const POLICY_KIT_DOMAIN = {
  name: "PolicyKit",
  version: "1",
} as const;

/**
 * EIP-712 type definition for PolicyApproval
 */
export const POLICY_APPROVAL_TYPES = {
  PolicyApproval: [
    { name: "caller", type: "address" },
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "calldataHash", type: "bytes32" },
    { name: "expiry", type: "uint256" },
    { name: "policyCID", type: "bytes32" },
    { name: "chainId", type: "uint256" },
  ],
} as const;

/**
 * Parameters for building a policy approval attestation
 */
export interface PolicyApprovalParams {
  caller: Address;
  target: Address;
  value: bigint;
  calldata: Hex;
  expiry: bigint;
  policyCID: Hex;
  chainId: bigint;
}

/**
 * A signed policy approval
 */
export interface SignedPolicyApproval {
  approval: {
    caller: Address;
    target: Address;
    value: bigint;
    calldataHash: Hex;
    expiry: bigint;
    policyCID: Hex;
    chainId: bigint;
  };
  signature: Hex;
}

/**
 * Build EIP-712 typed data for a policy approval.
 * Used by the Lit Action to sign and by the SDK to verify.
 */
export function buildPolicyApproval(params: PolicyApprovalParams) {
  const calldataHash = keccak256(params.calldata);

  return {
    domain: {
      ...POLICY_KIT_DOMAIN,
      chainId: Number(params.chainId),
      verifyingContract: undefined, // Set by the caller based on engine address
    },
    types: POLICY_APPROVAL_TYPES,
    primaryType: "PolicyApproval" as const,
    message: {
      caller: params.caller,
      target: params.target,
      value: params.value,
      calldataHash,
      expiry: params.expiry,
      policyCID: params.policyCID,
      chainId: params.chainId,
    },
  };
}

/**
 * Encode a signed policy approval for on-chain submission.
 * Returns ABI-encoded (PolicyApproval, signature) bytes.
 */
export function encodeAttestation(signed: SignedPolicyApproval): Hex {
  const approvalAbi = parseAbiParameters(
    "(address caller, address target, uint256 value, bytes32 calldataHash, uint256 expiry, bytes32 policyCID, uint256 chainId), bytes signature"
  );

  return encodeAbiParameters(approvalAbi, [
    {
      caller: signed.approval.caller,
      target: signed.approval.target,
      value: signed.approval.value,
      calldataHash: signed.approval.calldataHash,
      expiry: signed.approval.expiry,
      policyCID: signed.approval.policyCID,
      chainId: signed.approval.chainId,
    },
    signed.signature,
  ]);
}

/**
 * Calculate the default expiry timestamp (5 minutes from now)
 */
export function defaultExpiry(secondsFromNow = 300): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + secondsFromNow);
}
