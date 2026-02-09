// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRuleEvaluator} from "./IRuleEvaluator.sol";
import {PolicyCodec} from "../libraries/PolicyCodec.sol";

/// @title MaxValueRule
/// @notice Tier 1 rule: caps the ETH value per transaction
contract MaxValueRule is IRuleEvaluator {
    function evaluate(
        bytes memory params,
        address,
        address,
        uint256 value,
        bytes calldata
    ) external pure override returns (bool passed, string memory reason) {
        PolicyCodec.MaxValueParams memory decoded = PolicyCodec.decodeMaxValueParams(params);

        if (value > decoded.maxValue) {
            return (false, "ETH value exceeds maximum");
        }

        return (true, "");
    }
}
