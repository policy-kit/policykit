// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IStatefulRuleEvaluator} from "./IRuleEvaluator.sol";
import {PolicyCodec} from "../libraries/PolicyCodec.sol";

/// @title SpendLimitRule
/// @notice Tier 2 rule: rate-limited token spending within a rolling time window
contract SpendLimitRule is IStatefulRuleEvaluator {
    /// @notice Tracks cumulative spending per account per rule
    struct SpendState {
        uint256 spent;
        uint256 windowStart;
    }

    /// @dev account => ruleIndex => SpendState
    mapping(address => mapping(uint256 => SpendState)) public spendStates;

    /// @notice ERC20 transfer selector: transfer(address,uint256)
    bytes4 private constant TRANSFER_SELECTOR = 0xa9059cbb;

    /// @notice ERC20 approve selector: approve(address,uint256)
    bytes4 private constant APPROVE_SELECTOR = 0x095ea7b3;

    function evaluate(
        bytes memory params,
        address caller,
        address target,
        uint256 value,
        bytes calldata data
    ) external view override returns (bool passed, string memory reason) {
        PolicyCodec.SpendLimitParams memory decoded = PolicyCodec.decodeSpendLimitParams(params);

        uint256 spendAmount = _extractSpendAmount(decoded.token, target, value, data);
        if (spendAmount == 0) {
            return (true, "");
        }

        // This is a view-only check — we use caller as the policy owner for lookups
        // The actual ruleIndex is passed during record(), here we compute a deterministic key
        bytes32 stateKey = keccak256(abi.encode(caller, decoded.token, decoded.windowSeconds));
        uint256 ruleIndex = uint256(stateKey) % type(uint256).max;

        SpendState memory state = spendStates[caller][ruleIndex];

        uint256 currentSpent = state.spent;
        // Reset window if expired
        if (block.timestamp >= state.windowStart + decoded.windowSeconds) {
            currentSpent = 0;
        }

        if (currentSpent + spendAmount > decoded.maxAmount) {
            return (false, "Spend limit exceeded for window");
        }

        return (true, "");
    }

    function record(
        address policyOwner,
        uint256 ruleIndex,
        bytes memory params,
        address,
        address target,
        uint256 value,
        bytes calldata data
    ) external override {
        PolicyCodec.SpendLimitParams memory decoded = PolicyCodec.decodeSpendLimitParams(params);

        uint256 spendAmount = _extractSpendAmount(decoded.token, target, value, data);
        if (spendAmount == 0) return;

        SpendState storage state = spendStates[policyOwner][ruleIndex];

        // Reset window if expired
        if (block.timestamp >= state.windowStart + decoded.windowSeconds) {
            state.spent = 0;
            state.windowStart = block.timestamp;
        }

        state.spent += spendAmount;
    }

    /// @dev Extract the spend amount from a transaction
    function _extractSpendAmount(
        address token,
        address target,
        uint256 value,
        bytes calldata data
    ) internal pure returns (uint256) {
        // If the target is the token contract, check for transfer/approve
        if (target == token && data.length >= 68) {
            bytes4 selector = bytes4(data[:4]);
            if (selector == TRANSFER_SELECTOR || selector == APPROVE_SELECTOR) {
                // Decode amount from transfer(address,uint256) or approve(address,uint256)
                (, uint256 amount) = abi.decode(data[4:68], (address, uint256));
                return amount;
            }
        }

        // For native ETH tracking, use address(0) as token
        if (token == address(0)) {
            return value;
        }

        return 0;
    }
}
