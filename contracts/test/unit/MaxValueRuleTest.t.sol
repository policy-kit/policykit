// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../src/rules/MaxValueRule.sol";
import "../../src/libraries/PolicyCodec.sol";

contract MaxValueRuleTest is Test {
    MaxValueRule rule;

    function setUp() public {
        rule = new MaxValueRule();
    }

    function test_AllowsValueBelowMax() public view {
        bytes memory params = PolicyCodec.encodeMaxValueParams(1 ether);
        (bool passed,) = rule.evaluate(params, address(this), address(0x1), 0.5 ether, "");
        assertTrue(passed);
    }

    function test_AllowsValueEqualToMax() public view {
        bytes memory params = PolicyCodec.encodeMaxValueParams(1 ether);
        (bool passed,) = rule.evaluate(params, address(this), address(0x1), 1 ether, "");
        assertTrue(passed);
    }

    function test_DeniesValueAboveMax() public view {
        bytes memory params = PolicyCodec.encodeMaxValueParams(1 ether);
        (bool passed, string memory reason) = rule.evaluate(params, address(this), address(0x1), 2 ether, "");
        assertFalse(passed);
        assertEq(reason, "ETH value exceeds maximum");
    }

    function test_AllowsZeroValue() public view {
        bytes memory params = PolicyCodec.encodeMaxValueParams(1 ether);
        (bool passed,) = rule.evaluate(params, address(this), address(0x1), 0, "");
        assertTrue(passed);
    }

    function testFuzz_MaxValueRule(uint256 maxVal, uint256 sentVal) public view {
        vm.assume(maxVal > 0);
        bytes memory params = PolicyCodec.encodeMaxValueParams(maxVal);
        (bool passed,) = rule.evaluate(params, address(this), address(0x1), sentVal, "");
        assertEq(passed, sentVal <= maxVal);
    }
}
