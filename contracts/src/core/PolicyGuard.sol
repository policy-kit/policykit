// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPolicyEngine} from "./IPolicyEngine.sol";

/// @title PolicyGuard
/// @notice Abstract contract that any project can inherit to enforce PolicyKit policies.
///         Provides the `enforcePolicy` modifier for check-execute-record flow.
abstract contract PolicyGuard {
    /// @notice The PolicyEngine instance used for policy evaluation
    IPolicyEngine public immutable policyEngine;

    /// @notice Emitted when a policy-guarded execution succeeds
    event PolicyGuardedExecution(address indexed account, address indexed target, uint256 value);

    error PolicyDenied();

    /// @param _policyEngine Address of the deployed PolicyEngine contract
    constructor(address _policyEngine) {
        policyEngine = IPolicyEngine(_policyEngine);
    }

    /// @notice Modifier that enforces policy checks before and records state after execution
    /// @param target The target address of the transaction
    /// @param value The ETH value being sent
    /// @param data The calldata being sent
    /// @param attestation The Lit PKP attestation (empty bytes if no Tier 3 rules)
    modifier enforcePolicy(
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata attestation
    ) {
        // Check policy before execution
        bool allowed = policyEngine.checkPolicy(msg.sender, target, value, data, attestation);
        if (!allowed) revert PolicyDenied();

        // Execute the guarded function
        _;

        // Record execution for Tier 2 stateful rules
        policyEngine.recordExecution(msg.sender, target, value, data);

        emit PolicyGuardedExecution(msg.sender, target, value);
    }

    /// @notice Check if a transaction would pass the policy without executing
    /// @param target The target address
    /// @param value The ETH value
    /// @param data The calldata
    /// @param attestation The attestation bytes
    /// @return passed Whether the policy check passes
    /// @return ruleResults Per-rule pass/fail array
    /// @return reasons Per-rule reason strings
    function simulatePolicy(
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata attestation
    ) external returns (bool passed, bool[] memory ruleResults, string[] memory reasons) {
        return policyEngine.evaluateDetailed(msg.sender, target, value, data, attestation);
    }
}
