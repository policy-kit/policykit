// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CalldataParser
/// @notice Utilities for parsing transaction calldata
library CalldataParser {
    /// @notice Extract the function selector (first 4 bytes) from calldata
    /// @param data The calldata to parse
    /// @return selector The 4-byte function selector
    function extractSelector(bytes calldata data) internal pure returns (bytes4 selector) {
        if (data.length < 4) {
            return bytes4(0);
        }
        return bytes4(data[:4]);
    }

    /// @notice Check if calldata matches a specific function selector
    /// @param data The calldata to check
    /// @param selector The selector to match against
    /// @return True if the calldata starts with the given selector
    function matchesSelector(bytes calldata data, bytes4 selector) internal pure returns (bool) {
        return extractSelector(data) == selector;
    }
}
