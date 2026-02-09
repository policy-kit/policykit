// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../src/rules/AllowSelectorsRule.sol";
import "../../src/rules/DenySelectorsRule.sol";
import "../../src/libraries/PolicyCodec.sol";

contract SelectorRulesTest is Test {
    AllowSelectorsRule allowRule;
    DenySelectorsRule denyRule;

    // ERC20 selectors
    bytes4 constant TRANSFER = 0xa9059cbb;
    bytes4 constant APPROVE = 0x095ea7b3;
    bytes4 constant TRANSFER_FROM = 0x23b872dd;

    function setUp() public {
        allowRule = new AllowSelectorsRule();
        denyRule = new DenySelectorsRule();
    }

    // ── AllowSelectors ──

    function test_AllowSelectors_AllowsWhitelisted() public view {
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = TRANSFER;
        selectors[1] = APPROVE;
        bytes memory params = PolicyCodec.encodeSelectorListParams(selectors);

        bytes memory callData = abi.encodeWithSelector(TRANSFER, address(0x1), uint256(100));
        (bool passed,) = allowRule.evaluate(params, address(this), address(0x1), 0, callData);
        assertTrue(passed);
    }

    function test_AllowSelectors_DeniesNonWhitelisted() public view {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = TRANSFER;
        bytes memory params = PolicyCodec.encodeSelectorListParams(selectors);

        bytes memory callData = abi.encodeWithSelector(APPROVE, address(0x1), uint256(100));
        (bool passed,) = allowRule.evaluate(params, address(this), address(0x1), 0, callData);
        assertFalse(passed);
    }

    function test_AllowSelectors_AllowsEmptyCalldata() public view {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = TRANSFER;
        bytes memory params = PolicyCodec.encodeSelectorListParams(selectors);

        (bool passed,) = allowRule.evaluate(params, address(this), address(0x1), 0, "");
        assertTrue(passed);
    }

    // ── DenySelectors ──

    function test_DenySelectors_DeniesBlacklisted() public view {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = APPROVE;
        bytes memory params = PolicyCodec.encodeSelectorListParams(selectors);

        bytes memory callData = abi.encodeWithSelector(APPROVE, address(0x1), uint256(100));
        (bool passed,) = denyRule.evaluate(params, address(this), address(0x1), 0, callData);
        assertFalse(passed);
    }

    function test_DenySelectors_AllowsNonBlacklisted() public view {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = APPROVE;
        bytes memory params = PolicyCodec.encodeSelectorListParams(selectors);

        bytes memory callData = abi.encodeWithSelector(TRANSFER, address(0x1), uint256(100));
        (bool passed,) = denyRule.evaluate(params, address(this), address(0x1), 0, callData);
        assertTrue(passed);
    }

    function test_DenySelectors_AllowsEmptyCalldata() public view {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = APPROVE;
        bytes memory params = PolicyCodec.encodeSelectorListParams(selectors);

        (bool passed,) = denyRule.evaluate(params, address(this), address(0x1), 0, "");
        assertTrue(passed);
    }
}
