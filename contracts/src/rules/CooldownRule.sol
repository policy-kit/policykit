// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IStatefulRuleEvaluator} from "./IRuleEvaluator.sol";
import {PolicyCodec} from "../libraries/PolicyCodec.sol";

/// @title CooldownRule
/// @notice Tier 2 rule: enforces a minimum time delay between executions
contract CooldownRule is IStatefulRuleEvaluator {
    /// @dev account => ruleIndex => last execution timestamp
    mapping(address => mapping(uint256 => uint256)) public lastExecutionTime;

    function evaluate(
        bytes memory params,
        address caller,
        address,
        uint256,
        bytes calldata
    ) external view override returns (bool passed, string memory reason) {
        PolicyCodec.CooldownParams memory decoded = PolicyCodec.decodeCooldownParams(params);

        uint256 lastExec = lastExecutionTime[caller][0]; // simplified lookup for view
        if (lastExec == 0) {
            return (true, "");
        }

        if (block.timestamp < lastExec + decoded.cooldownSeconds) {
            return (false, "Cooldown period has not elapsed");
        }

        return (true, "");
    }

    function record(
        address policyOwner,
        uint256 ruleIndex,
        bytes memory,
        address,
        address,
        uint256,
        bytes calldata
    ) external override {
        lastExecutionTime[policyOwner][ruleIndex] = block.timestamp;
    }
}
