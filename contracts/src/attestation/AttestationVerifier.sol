// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712PolicyDomain} from "./EIP712PolicyDomain.sol";

/// @title AttestationVerifier
/// @notice Verifies EIP-712 signed attestations from Lit Protocol PKPs
abstract contract AttestationVerifier is EIP712PolicyDomain {
    using ECDSA for bytes32;

    /// @notice Emitted when an attestation is verified
    event AttestationVerified(
        address indexed caller,
        address indexed target,
        address indexed signer,
        bytes32 policyCID
    );

    /// @notice Verify a policy approval attestation from a Lit PKP
    /// @param approval The policy approval data
    /// @param signature The EIP-712 signature from the Lit PKP
    /// @param expectedSigner The expected PKP address (stored in the policy)
    /// @return True if the attestation is valid
    function _verifyAttestation(
        PolicyApproval memory approval,
        bytes memory signature,
        address expectedSigner
    ) internal view returns (bool) {
        // Check expiry
        if (block.timestamp > approval.expiry) {
            return false;
        }

        // Check chain ID
        if (approval.chainId != block.chainid) {
            return false;
        }

        // Recover signer from EIP-712 signature
        bytes32 digest = getPolicyApprovalDigest(approval);
        address recoveredSigner = digest.recover(signature);

        // Verify the signer matches the expected PKP address
        if (recoveredSigner != expectedSigner) {
            return false;
        }

        return true;
    }

    /// @notice Decode an attestation from raw bytes
    /// @param attestationData ABI-encoded (PolicyApproval, signature)
    /// @return approval The decoded policy approval
    /// @return signature The decoded signature
    function _decodeAttestation(bytes memory attestationData)
        internal
        pure
        returns (PolicyApproval memory approval, bytes memory signature)
    {
        (approval, signature) = abi.decode(attestationData, (PolicyApproval, bytes));
    }
}
