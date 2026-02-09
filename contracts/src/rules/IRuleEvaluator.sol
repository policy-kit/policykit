// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IRuleEvaluator
/// @notice Interface for stateless rule evaluators (Tier 1)
interface IRuleEvaluator {
    /// @notice Evaluate a rule against a transaction context
    /// @param params ABI-encoded rule parameters
    /// @param caller The address initiating the transaction
    /// @param target The target contract address
    /// @param value The ETH value being sent
    /// @param data The calldata being sent
    /// @return passed Whether the rule passes
    /// @return reason Human-readable explanation if the rule fails
    function evaluate(
        bytes memory params,
        address caller,
        address target,
        uint256 value,
        bytes calldata data
    ) external view returns (bool passed, string memory reason);
}

/// @title IStatefulRuleEvaluator
/// @notice Interface for stateful rule evaluators (Tier 2) that track state across executions
interface IStatefulRuleEvaluator is IRuleEvaluator {
    /// @notice Record a successful execution for state tracking
    /// @param policyOwner The account that owns the policy
    /// @param ruleIndex The index of this rule in the policy's rule array
    /// @param params ABI-encoded rule parameters
    /// @param caller The address that initiated the transaction
    /// @param target The target contract address
    /// @param value The ETH value sent
    /// @param data The calldata sent
    function record(
        address policyOwner,
        uint256 ruleIndex,
        bytes memory params,
        address caller,
        address target,
        uint256 value,
        bytes calldata data
    ) external;
}
