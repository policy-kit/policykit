// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PolicyCodec} from "../libraries/PolicyCodec.sol";

/// @title IPolicyEngine
/// @notice Interface for the PolicyKit policy engine
interface IPolicyEngine {
    /// @notice Emitted when a policy set is created or updated
    event PolicySetUpdated(
        address indexed account,
        bytes32 policyCID,
        address pkpAddress,
        bool requireAttestation,
        PolicyCodec.FailMode failMode,
        uint256 ruleCount
    );

    /// @notice Emitted when a policy set is removed
    event PolicySetRemoved(address indexed account);

    /// @notice Emitted when a policy check passes
    event PolicyCheckPassed(address indexed account, address indexed target);

    /// @notice Emitted when a policy check fails
    event PolicyCheckFailed(address indexed account, address indexed target, string reason);

    /// @notice Set or update the policy for the caller's account
    function setPolicySet(
        bytes32 policyCID,
        address pkpAddress,
        bool requireAttestation,
        PolicyCodec.FailMode failMode,
        PolicyCodec.OnChainRule[] calldata rules
    ) external;

    /// @notice Remove the policy for the caller's account
    function removePolicySet() external;

    /// @notice Check a transaction against an account's policy
    function checkPolicy(
        address account,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata attestation
    ) external returns (bool);

    /// @notice Evaluate a transaction and return detailed per-rule results
    function evaluateDetailed(
        address account,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata attestation
    ) external returns (bool passed, bool[] memory ruleResults, string[] memory reasons);

    /// @notice Record a successful execution for Tier 2 stateful rules
    function recordExecution(
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external;

    /// @notice Get the policy set for an account
    function getPolicy(address account) external view returns (PolicyCodec.PolicySet memory);

    /// @notice Check if an account has a policy set
    function hasPolicy(address account) external view returns (bool);
}
