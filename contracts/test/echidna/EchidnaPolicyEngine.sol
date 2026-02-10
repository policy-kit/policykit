// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PolicyEngine} from "../../src/core/PolicyEngine.sol";
import {PolicyCodec} from "../../src/libraries/PolicyCodec.sol";

/// @title EchidnaPolicyEngine
/// @notice Echidna property tests for PolicyEngine invariants
contract EchidnaPolicyEngine {
    PolicyEngine internal engine;

    // Track state for property assertions
    bool internal policyWasSet;

    constructor() {
        engine = new PolicyEngine();
    }

    // ──────────────────── Helper ────────────────────

    function _makeAllowTargetsRule(address target) internal pure returns (PolicyCodec.OnChainRule[] memory) {
        address[] memory targets = new address[](1);
        targets[0] = target;

        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.ALLOW_TARGETS,
            params: PolicyCodec.encodeTargetListParams(targets),
            enabled: true
        });
        return rules;
    }

    function _makeMaxValueRule(uint256 maxVal) internal pure returns (PolicyCodec.OnChainRule[] memory) {
        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](1);
        rules[0] = PolicyCodec.OnChainRule({
            ruleType: PolicyCodec.RuleType.MAX_VALUE,
            params: PolicyCodec.encodeMaxValueParams(maxVal),
            enabled: true
        });
        return rules;
    }

    // ──────────────────── Properties ────────────────────

    /// @notice An account with no policy should always pass checkPolicy
    function echidna_no_policy_always_passes() public returns (bool) {
        // Use a fresh address that never had a policy set
        address fresh = address(uint160(uint256(keccak256(abi.encode(block.timestamp, block.number)))));
        bool result = engine.checkPolicy(fresh, address(0x1), 0, "", "");
        return result == true;
    }

    /// @notice After setPolicySet, hasPolicy must return true for msg.sender
    function test_set_policy_creates_entry(bytes32 cid) public {
        PolicyCodec.OnChainRule[] memory rules = _makeMaxValueRule(1 ether);

        engine.setPolicySet(cid, address(0), false, PolicyCodec.FailMode.OPEN, rules);

        assert(engine.hasPolicy(address(this)));
    }

    /// @notice After removePolicySet, hasPolicy must return false for msg.sender
    function test_remove_policy_clears_entry(bytes32 cid) public {
        PolicyCodec.OnChainRule[] memory rules = _makeMaxValueRule(1 ether);

        engine.setPolicySet(cid, address(0), false, PolicyCodec.FailMode.OPEN, rules);
        assert(engine.hasPolicy(address(this)));

        engine.removePolicySet();
        assert(!engine.hasPolicy(address(this)));
    }

    /// @notice Setting a policy twice should overwrite cleanly (last-write wins)
    function test_policy_overwrite(bytes32 cid1, bytes32 cid2, uint256 maxVal1, uint256 maxVal2) public {
        PolicyCodec.OnChainRule[] memory rules1 = _makeMaxValueRule(maxVal1);
        engine.setPolicySet(cid1, address(0), false, PolicyCodec.FailMode.OPEN, rules1);

        PolicyCodec.OnChainRule[] memory rules2 = _makeMaxValueRule(maxVal2);
        engine.setPolicySet(cid2, address(0), false, PolicyCodec.FailMode.OPEN, rules2);

        PolicyCodec.PolicySet memory policy = engine.getPolicy(address(this));
        assert(policy.policyCID == cid2);
        assert(policy.ruleCount == 1);
        assert(policy.exists);
    }

    /// @notice MaxValue rule: value <= maxValue must always pass
    function test_max_value_allows_under_limit(uint256 maxVal, uint256 value) public {
        if (maxVal == 0) maxVal = 1;
        if (value > maxVal) value = maxVal;

        PolicyCodec.OnChainRule[] memory rules = _makeMaxValueRule(maxVal);
        engine.setPolicySet(bytes32(0), address(0), false, PolicyCodec.FailMode.OPEN, rules);

        bool result = engine.checkPolicy(address(this), address(0x1), value, "", "");
        assert(result == true);
    }

    /// @notice MaxValue rule: value > maxValue must always fail
    function test_max_value_blocks_over_limit(uint256 maxVal, uint256 value) public {
        if (maxVal >= type(uint256).max) maxVal = type(uint256).max - 1;
        if (value <= maxVal) value = maxVal + 1;

        PolicyCodec.OnChainRule[] memory rules = _makeMaxValueRule(maxVal);
        engine.setPolicySet(bytes32(0), address(0), false, PolicyCodec.FailMode.OPEN, rules);

        bool result = engine.checkPolicy(address(this), address(0x1), value, "", "");
        assert(result == false);
    }

    /// @notice AllowTargets: calling an allowed target must pass
    function test_allow_targets_passes_allowed(address target) public {
        if (target == address(0)) target = address(0x1);

        PolicyCodec.OnChainRule[] memory rules = _makeAllowTargetsRule(target);
        engine.setPolicySet(bytes32(0), address(0), false, PolicyCodec.FailMode.OPEN, rules);

        bool result = engine.checkPolicy(address(this), target, 0, "", "");
        assert(result == true);
    }

    /// @notice AllowTargets: calling a non-allowed target must fail
    function test_allow_targets_blocks_non_allowed(address allowed, address target) public {
        if (allowed == address(0)) allowed = address(0x1);
        if (allowed == target) return; // skip when allowed == target (after normalization)

        PolicyCodec.OnChainRule[] memory rules = _makeAllowTargetsRule(allowed);
        engine.setPolicySet(bytes32(0), address(0), false, PolicyCodec.FailMode.OPEN, rules);

        bool result = engine.checkPolicy(address(this), target, 0, "", "");
        assert(result == false);
    }

    /// @notice requireAttestation with FailMode.CLOSED and no attestation must fail
    function test_attestation_required_closed_fails_without_attestation(address pkp) public {
        if (pkp == address(0)) pkp = address(0x1);

        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](0);
        engine.setPolicySet(bytes32(0), pkp, true, PolicyCodec.FailMode.CLOSED, rules);

        bool result = engine.checkPolicy(address(this), address(0x1), 0, "", "");
        assert(result == false);
    }

    /// @notice requireAttestation with FailMode.OPEN and no attestation should pass (on-chain rules only)
    function test_attestation_required_open_passes_without_attestation(address pkp) public {
        if (pkp == address(0)) pkp = address(0x1);

        PolicyCodec.OnChainRule[] memory rules = new PolicyCodec.OnChainRule[](0);
        engine.setPolicySet(bytes32(0), pkp, true, PolicyCodec.FailMode.OPEN, rules);

        bool result = engine.checkPolicy(address(this), address(0x1), 0, "", "");
        assert(result == true);
    }

    /// @notice removePolicySet on a nonexistent policy must revert
    function test_remove_nonexistent_reverts() public {
        // Ensure no policy exists for a fresh address
        // Since we're msg.sender and may have set policies, use a try/catch
        if (engine.hasPolicy(address(this))) {
            engine.removePolicySet();
        }

        // Now it should revert
        try engine.removePolicySet() {
            assert(false); // should not reach here
        } catch {
            // expected revert
        }
    }
}
