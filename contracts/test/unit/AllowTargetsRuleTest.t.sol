// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../src/rules/AllowTargetsRule.sol";
import "../../src/libraries/PolicyCodec.sol";

contract AllowTargetsRuleTest is Test {
    AllowTargetsRule rule;

    address constant UNISWAP = address(0x1);
    address constant AAVE = address(0x2);
    address constant MALICIOUS = address(0x3);

    function setUp() public {
        rule = new AllowTargetsRule();
    }

    function test_AllowsWhitelistedTarget() public view {
        address[] memory targets = new address[](2);
        targets[0] = UNISWAP;
        targets[1] = AAVE;
        bytes memory params = PolicyCodec.encodeTargetListParams(targets);

        (bool passed,) = rule.evaluate(params, address(this), UNISWAP, 0, "");
        assertTrue(passed);
    }

    function test_DeniesNonWhitelistedTarget() public view {
        address[] memory targets = new address[](2);
        targets[0] = UNISWAP;
        targets[1] = AAVE;
        bytes memory params = PolicyCodec.encodeTargetListParams(targets);

        (bool passed, string memory reason) = rule.evaluate(params, address(this), MALICIOUS, 0, "");
        assertFalse(passed);
        assertEq(reason, "Target address not in allowlist");
    }

    function test_EmptyAllowlistDeniesAll() public view {
        address[] memory targets = new address[](0);
        bytes memory params = PolicyCodec.encodeTargetListParams(targets);

        (bool passed,) = rule.evaluate(params, address(this), UNISWAP, 0, "");
        assertFalse(passed);
    }

    function testFuzz_AllowsOnlyListedTargets(address target) public view {
        address[] memory targets = new address[](2);
        targets[0] = UNISWAP;
        targets[1] = AAVE;
        bytes memory params = PolicyCodec.encodeTargetListParams(targets);

        (bool passed,) = rule.evaluate(params, address(this), target, 0, "");
        bool expected = (target == UNISWAP || target == AAVE);
        assertEq(passed, expected);
    }
}
