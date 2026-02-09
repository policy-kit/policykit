// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRuleEvaluator} from "./IRuleEvaluator.sol";
import {PolicyCodec} from "../libraries/PolicyCodec.sol";
import {CalldataParser} from "../libraries/CalldataParser.sol";

/// @title AllowSelectorsRule
/// @notice Tier 1 rule: only allows calls with whitelisted function selectors
contract AllowSelectorsRule is IRuleEvaluator {
    function evaluate(
        bytes memory params,
        address,
        address,
        uint256,
        bytes calldata data
    ) external pure override returns (bool passed, string memory reason) {
        // If calldata is empty (plain ETH transfer), allow by default
        if (data.length < 4) {
            return (true, "");
        }

        bytes4 selector = CalldataParser.extractSelector(data);
        PolicyCodec.SelectorListParams memory decoded = PolicyCodec.decodeSelectorListParams(params);

        for (uint256 i = 0; i < decoded.selectors.length; i++) {
            if (decoded.selectors[i] == selector) {
                return (true, "");
            }
        }

        return (false, "Function selector not in allowlist");
    }
}
