// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../src/rules/DenyTargetsRule.sol";
import "../../src/libraries/PolicyCodec.sol";

contract DenyTargetsRuleTest is Test {
    DenyTargetsRule rule;

    address constant BLOCKED = address(0xBAD);
    address constant SAFE = address(0x1);

    function setUp() public {
        rule = new DenyTargetsRule();
    }

    function test_DeniesBlocklistedTarget() public view {
        address[] memory targets = new address[](1);
        targets[0] = BLOCKED;
        bytes memory params = PolicyCodec.encodeTargetListParams(targets);

        (bool passed, string memory reason) = rule.evaluate(params, address(this), BLOCKED, 0, "");
        assertFalse(passed);
        assertEq(reason, "Target address is in denylist");
    }

    function test_AllowsNonBlocklistedTarget() public view {
        address[] memory targets = new address[](1);
        targets[0] = BLOCKED;
        bytes memory params = PolicyCodec.encodeTargetListParams(targets);

        (bool passed,) = rule.evaluate(params, address(this), SAFE, 0, "");
        assertTrue(passed);
    }

    function test_EmptyDenylistAllowsAll() public view {
        address[] memory targets = new address[](0);
        bytes memory params = PolicyCodec.encodeTargetListParams(targets);

        (bool passed,) = rule.evaluate(params, address(this), BLOCKED, 0, "");
        assertTrue(passed);
    }
}
