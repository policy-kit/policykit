// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../src/core/PolicyEngine.sol";
import "../../src/core/PolicyGuard.sol";
import "../../src/libraries/PolicyCodec.sol";

/// @notice A simple contract that uses PolicyGuard for testing
contract MockGuardedContract is PolicyGuard {
    uint256 public executionCount;

    constructor(address _engine) PolicyGuard(_engine) {}

    function guardedExecute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata attestation
    ) external enforcePolicy(target, value, data, attestation) {
        executionCount++;
    }
}

contract PolicyEngineTest is Test {
    PolicyEngine engine;
    MockGuardedContract guarded;

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant UNISWAP = address(0x1);
    address constant AAVE = address(0x2);
    address constant MALICIOUS = address(0xBAD);

    bytes32 constant MOCK_CID = bytes32(uint256(0x1234));

    function setUp() public {
        engine = new PolicyEngine();
        guarded = new MockGuardedContract(address(engine));
    }

    // ──────────────────── Policy Management ────────────────────

    function test_SetPolicySet() public {
        vm.startPrank(ALICE);

        PolicyCodec.OnChainRule[] memory rules = _createAllowTargetsRules();
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        PolicyCodec.PolicySet memory policy = engine.getPolicy(ALICE);
        assertTrue(policy.exists);
        assertEq(policy.policyCID, MOCK_CID);
        assertEq(policy.ruleCount, 1);
        assertFalse(policy.requireAttestation);

        vm.stopPrank();
    }

    function test_RemovePolicySet() public {
        vm.startPrank(ALICE);

        PolicyCodec.OnChainRule[] memory rules = _createAllowTargetsRules();
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);
        assertTrue(engine.hasPolicy(ALICE));

        engine.removePolicySet();
        assertFalse(engine.hasPolicy(ALICE));

        vm.stopPrank();
    }

    function test_RevertRemoveNonexistent() public {
        vm.prank(ALICE);
        vm.expectRevert(PolicyEngine.NoPolicySet.selector);
        engine.removePolicySet();
    }

    function test_RevertInvalidPKP() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](0);
        vm.expectRevert(PolicyEngine.InvalidPKPAddress.selector);
        engine.setPolicySet(MOCK_CID, address(0), true, PolicyCodec.FailMode.CLOSED, rules);
    }

    // ──────────────────── Policy Checking ────────────────────

    function test_NoPolicyAllowsAll() public {
        bool result = engine.checkPolicy(ALICE, UNISWAP, 0, "", "");
        assertTrue(result);
    }

    function test_AllowTargets_Passes() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = _createAllowTargetsRules();
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        bool result = engine.checkPolicy(ALICE, UNISWAP, 0, "", "");
        assertTrue(result);
    }

    function test_AllowTargets_Denies() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = _createAllowTargetsRules();
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        bool result = engine.checkPolicy(ALICE, MALICIOUS, 0, "", "");
        assertFalse(result);
    }

    function test_MaxValue_Passes() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: true
        });
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        bool result = engine.checkPolicy(ALICE, UNISWAP, 0.5 ether, "", "");
        assertTrue(result);
    }

    function test_MaxValue_Denies() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: true
        });
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        bool result = engine.checkPolicy(ALICE, UNISWAP, 2 ether, "", "");
        assertFalse(result);
    }

    function test_MultipleRules_AllMustPass() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](2);

        // Rule 1: Allow only UNISWAP and AAVE
        address[] memory targets = new address[](2);
        targets[0] = UNISWAP;
        targets[1] = AAVE;
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.ALLOW_TARGETS,
            params: PolicyCodec.encodeTargetListParams(targets),
            enabled: true
        });

        // Rule 2: Max 1 ETH per call
        rules[1] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: true
        });

        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        // Both pass
        assertTrue(engine.checkPolicy(ALICE, UNISWAP, 0.5 ether, "", ""));

        // Target fails
        assertFalse(engine.checkPolicy(ALICE, MALICIOUS, 0.5 ether, "", ""));

        // Value fails
        assertFalse(engine.checkPolicy(ALICE, UNISWAP, 2 ether, "", ""));
    }

    function test_DisabledRulesSkipped() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: false
        });
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        // Should pass even though value exceeds max, since rule is disabled
        assertTrue(engine.checkPolicy(ALICE, UNISWAP, 2 ether, "", ""));
    }

    // ──────────────────── Attestation ────────────────────

    function test_FailClosed_NoAttestation() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](0);
        engine.setPolicySet(MOCK_CID, address(0x999), true, PolicyCodec.FailMode.CLOSED, rules);

        // No attestation provided, fail-closed → deny
        assertFalse(engine.checkPolicy(ALICE, UNISWAP, 0, "", ""));
    }

    function test_FailOpen_NoAttestation() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](0);
        engine.setPolicySet(MOCK_CID, address(0x999), true, PolicyCodec.FailMode.OPEN, rules);

        // No attestation provided, fail-open → allow
        assertTrue(engine.checkPolicy(ALICE, UNISWAP, 0, "", ""));
    }

    // ──────────────────── EvaluateDetailed ────────────────────

    function test_EvaluateDetailed() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](2);

        address[] memory targets = new address[](1);
        targets[0] = UNISWAP;
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.ALLOW_TARGETS,
            params: PolicyCodec.encodeTargetListParams(targets),
            enabled: true
        });
        rules[1] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: true
        });

        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        // Target passes, value fails
        (bool passed, bool[] memory results, string[] memory reasons) =
            engine.evaluateDetailed(ALICE, UNISWAP, 2 ether, "", "");

        assertFalse(passed);
        assertEq(results.length, 2);
        assertTrue(results[0]); // AllowTargets passed
        assertFalse(results[1]); // MaxValue failed
        assertEq(reasons[1], "ETH value exceeds maximum");
    }

    // ──────────────────── PolicyGuard Integration ────────────────────

    function test_PolicyGuard_AllowsExecution() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: true
        });
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        vm.prank(ALICE);
        guarded.guardedExecute(UNISWAP, 0.5 ether, "", "");
        assertEq(guarded.executionCount(), 1);
    }

    function test_PolicyGuard_DeniesExecution() public {
        vm.prank(ALICE);
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: true
        });
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules);

        vm.prank(ALICE);
        vm.expectRevert(PolicyGuard.PolicyDenied.selector);
        guarded.guardedExecute(UNISWAP, 2 ether, "", "");
    }

    // ──────────────────── Update Policy ────────────────────

    function test_UpdatePolicyReplacesOld() public {
        vm.startPrank(ALICE);

        // Set initial policy with 2 rules
        PolicyCodec.OnChainRule[] memory rules1 = new PolicyCodec.OnChainRule[](2);
        address[] memory targets = new address[](1);
        targets[0] = UNISWAP;
        rules1[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.ALLOW_TARGETS,
            params: PolicyCodec.encodeTargetListParams(targets),
            enabled: true
        });
        rules1[1] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(1 ether),
            enabled: true
        });
        engine.setPolicySet(MOCK_CID, address(0), false, PolicyCodec.FailMode.CLOSED, rules1);

        // MALICIOUS is denied
        assertFalse(engine.checkPolicy(ALICE, MALICIOUS, 0, "", ""));

        // Update to allow everything (no rules)
        PolicyCodec.OnChainRule[] memory rules2 = new PolicyCodec.OnChainRule[](0);
        bytes32 newCID = bytes32(uint256(0x5678));
        engine.setPolicySet(newCID, address(0), false, PolicyCodec.FailMode.CLOSED, rules2);

        // Now MALICIOUS is allowed
        assertTrue(engine.checkPolicy(ALICE, MALICIOUS, 0, "", ""));

        // CID updated
        assertEq(engine.getPolicy(ALICE).policyCID, newCID);

        vm.stopPrank();
    }

    // ──────────────────── Helpers ────────────────────

    function _createAllowTargetsRules() internal pure returns (PolicyCodec.OnChainRule[] memory) {
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        address[] memory targets = new address[](2);
        targets[0] = UNISWAP;
        targets[1] = AAVE;
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.ALLOW_TARGETS,
            params: PolicyCodec.encodeTargetListParams(targets),
            enabled: true
        });
        return rules;
    }
}
