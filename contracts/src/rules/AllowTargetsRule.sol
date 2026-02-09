// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRuleEvaluator} from "./IRuleEvaluator.sol";
import {PolicyCodec} from "../libraries/PolicyCodec.sol";

/// @title AllowTargetsRule
/// @notice Tier 1 rule: only allows transactions to whitelisted target addresses
contract AllowTargetsRule is IRuleEvaluator {
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
                return (true, "");
            }
        }

        return (false, "Target address not in allowlist");
    }
}
