// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title EIP712PolicyDomain
/// @notice EIP-712 domain and type definitions for PolicyKit attestations
abstract contract EIP712PolicyDomain is EIP712 {
    /// @notice EIP-712 type hash for PolicyApproval
    bytes32 public constant POLICY_APPROVAL_TYPEHASH = keccak256(
        "PolicyApproval(address caller,address target,uint256 value,bytes32 calldataHash,uint256 expiry,bytes32 policyCID,uint256 chainId)"
    );

    /// @notice Struct representing a signed policy approval from Lit PKP
    struct PolicyApproval {
        address caller;
        address target;
        uint256 value;
        bytes32 calldataHash;
        uint256 expiry;
        bytes32 policyCID;
        uint256 chainId;
    }

    constructor() EIP712("PolicyKit", "1") {}

    /// @notice Hash a PolicyApproval struct for EIP-712 signing
    /// @param approval The policy approval to hash
    /// @return The EIP-712 struct hash
    function _hashPolicyApproval(PolicyApproval memory approval) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                POLICY_APPROVAL_TYPEHASH,
                approval.caller,
                approval.target,
                approval.value,
                approval.calldataHash,
                approval.expiry,
                approval.policyCID,
                approval.chainId
            )
        );
    }

    /// @notice Get the full EIP-712 digest for a PolicyApproval
    /// @param approval The policy approval
    /// @return The digest to be signed
    function getPolicyApprovalDigest(PolicyApproval memory approval) public view returns (bytes32) {
        return _hashTypedDataV4(_hashPolicyApproval(approval));
    }
}
