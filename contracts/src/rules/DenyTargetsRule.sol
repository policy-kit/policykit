// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRuleEvaluator} from "./IRuleEvaluator.sol";
import {PolicyCodec} from "../libraries/PolicyCodec.sol";

/// @title DenyTargetsRule
/// @notice Tier 1 rule: denies transactions to blacklisted target addresses
contract DenyTargetsRule is IRuleEvaluator {
    function evaluate(
        bytes memory params,
        address,
        address target,
        uint256,
        bytes calldata
    ) external pure override returns (bool passed, string memory reason) {
        PolicyCodec.TargetListParams memory decoded = PolicyCodec.decodeTargetListParams(params);

        for (uint256 i = 0; i < decoded.targets.length; i++) {
            if (decoded.targets[i] == target) {
                return (false, "Target address is in denylist");
            }
        }

        return (true, "");
    }
}
