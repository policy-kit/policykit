// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PolicyCodec
/// @notice Data structures and encoding/decoding helpers for PolicyKit policies
library PolicyCodec {
    /// @notice Rule types supported by the on-chain policy engine
    enum RuleType {
        ALLOW_TARGETS,      // Tier 1: whitelist of allowed target addresses
        DENY_TARGETS,       // Tier 1: blacklist of denied target addresses
        ALLOW_SELECTORS,    // Tier 1: whitelist of allowed function selectors
        DENY_SELECTORS,     // Tier 1: blacklist of denied function selectors
        MAX_VALUE,          // Tier 1: maximum ETH value per call
        SPEND_LIMIT,        // Tier 2: rate-limited token spending per window
        COOLDOWN            // Tier 2: minimum time between calls
    }

    /// @notice Fail mode when off-chain attestation is unavailable
    enum FailMode {
        CLOSED, // Block execution if attestation is missing (safer)
        OPEN    // Allow execution with only on-chain rules (riskier but no lockout)
    }

    /// @notice A single on-chain rule with its type and ABI-encoded parameters
    struct OnChainRule {
        RuleType ruleType;
        bytes params;
        bool enabled;
    }

    /// @notice Complete policy set for an account
    struct PolicySet {
        bytes32 policyCID;           // IPFS CID of full policy JSON
        address pkpAddress;          // Lit PKP authorized to sign attestations
        bool requireAttestation;     // true if policy has Tier 3 off-chain rules
        FailMode failMode;           // behavior when Lit is unreachable
        uint256 ruleCount;
        bool exists;                 // whether a policy has been set
    }

    /// @notice Parameters for AllowTargets / DenyTargets rules
    struct TargetListParams {
        address[] targets;
    }

    /// @notice Parameters for AllowSelectors / DenySelectors rules
    struct SelectorListParams {
        bytes4[] selectors;
    }

    /// @notice Parameters for MaxValue rule
    struct MaxValueParams {
        uint256 maxValue;
    }

    /// @notice Parameters for SpendLimit rule
    struct SpendLimitParams {
        address token;
        uint256 maxAmount;
        uint256 windowSeconds;
    }

    /// @notice Parameters for Cooldown rule
    struct CooldownParams {
        uint256 cooldownSeconds;
    }

    /// @notice Encode target list parameters
    function encodeTargetListParams(address[] memory targets) internal pure returns (bytes memory) {
        return abi.encode(TargetListParams(targets));
    }

    /// @notice Decode target list parameters
    function decodeTargetListParams(bytes memory data) internal pure returns (TargetListParams memory) {
        return abi.decode(data, (TargetListParams));
    }

    /// @notice Encode selector list parameters
    function encodeSelectorListParams(bytes4[] memory selectors) internal pure returns (bytes memory) {
        return abi.encode(SelectorListParams(selectors));
    }

    /// @notice Decode selector list parameters
    function decodeSelectorListParams(bytes memory data) internal pure returns (SelectorListParams memory) {
        return abi.decode(data, (SelectorListParams));
    }

    /// @notice Encode max value parameters
    function encodeMaxValueParams(uint256 maxValue) internal pure returns (bytes memory) {
        return abi.encode(MaxValueParams(maxValue));
    }

    /// @notice Decode max value parameters
    function decodeMaxValueParams(bytes memory data) internal pure returns (MaxValueParams memory) {
        return abi.decode(data, (MaxValueParams));
    }

    /// @notice Encode spend limit parameters
    function encodeSpendLimitParams(
        address token,
        uint256 maxAmount,
        uint256 windowSeconds
    ) internal pure returns (bytes memory) {
        return abi.encode(SpendLimitParams(token, maxAmount, windowSeconds));
    }

    /// @notice Decode spend limit parameters
    function decodeSpendLimitParams(bytes memory data) internal pure returns (SpendLimitParams memory) {
        return abi.decode(data, (SpendLimitParams));
    }

    /// @notice Encode cooldown parameters
    function encodeCooldownParams(uint256 cooldownSeconds) internal pure returns (bytes memory) {
        return abi.encode(CooldownParams(cooldownSeconds));
    }

    /// @notice Decode cooldown parameters
    function decodeCooldownParams(bytes memory data) internal pure returns (CooldownParams memory) {
        return abi.decode(data, (CooldownParams));
    }
}
