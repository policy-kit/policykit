// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPolicyEngine} from "./IPolicyEngine.sol";
import {PolicyCodec} from "../libraries/PolicyCodec.sol";
import {AttestationVerifier} from "../attestation/AttestationVerifier.sol";
import {IRuleEvaluator, IStatefulRuleEvaluator} from "../rules/IRuleEvaluator.sol";
import {AllowTargetsRule} from "../rules/AllowTargetsRule.sol";
import {DenyTargetsRule} from "../rules/DenyTargetsRule.sol";
import {AllowSelectorsRule} from "../rules/AllowSelectorsRule.sol";
import {DenySelectorsRule} from "../rules/DenySelectorsRule.sol";
import {MaxValueRule} from "../rules/MaxValueRule.sol";
import {SpendLimitRule} from "../rules/SpendLimitRule.sol";
import {CooldownRule} from "../rules/CooldownRule.sol";

/// @title PolicyEngine
/// @notice Core contract that stores policies, evaluates on-chain rules,
///         and verifies off-chain Lit PKP attestations.
///         Non-custodial: only the account owner can set/remove their policies.
contract PolicyEngine is IPolicyEngine, AttestationVerifier, ReentrancyGuard {
    // ──────────────────── Storage ────────────────────

    /// @dev account => PolicySet metadata
    mapping(address => PolicyCodec.PolicySet) private _policies;

    /// @dev account => ruleIndex => OnChainRule
    mapping(address => mapping(uint256 => PolicyCodec.OnChainRule)) private _rules;

    // ──────────────────── Rule Evaluator Singletons ────────────────────

    AllowTargetsRule public immutable allowTargetsRule;
    DenyTargetsRule public immutable denyTargetsRule;
    AllowSelectorsRule public immutable allowSelectorsRule;
    DenySelectorsRule public immutable denySelectorsRule;
    MaxValueRule public immutable maxValueRule;
    SpendLimitRule public immutable spendLimitRule;
    CooldownRule public immutable cooldownRule;

    // ──────────────────── Errors ────────────────────

    error NoPolicySet();
    error InvalidPKPAddress();
    error InvalidRuleCount();
    error AttestationRequired();
    error InvalidAttestation();
    error PolicyCheckDenied(string reason);

    // ──────────────────── Constructor ────────────────────

    constructor() {
        allowTargetsRule = new AllowTargetsRule();
        denyTargetsRule = new DenyTargetsRule();
        allowSelectorsRule = new AllowSelectorsRule();
        denySelectorsRule = new DenySelectorsRule();
        maxValueRule = new MaxValueRule();
        spendLimitRule = new SpendLimitRule();
        cooldownRule = new CooldownRule();
    }

    // ──────────────────── Policy Management ────────────────────

    /// @inheritdoc IPolicyEngine
    function setPolicySet(
        bytes32 policyCID,
        address pkpAddress,
        bool requireAttestation,
        PolicyCodec.FailMode failMode,
        PolicyCodec.OnChainRule[] calldata rules
    ) external override {
        if (requireAttestation && pkpAddress == address(0)) {
            revert InvalidPKPAddress();
        }

        // Clear existing rules
        PolicyCodec.PolicySet storage policy = _policies[msg.sender];
        for (uint256 i = 0; i < policy.ruleCount; i++) {
            delete _rules[msg.sender][i];
        }

        // Store new policy metadata
        policy.policyCID = policyCID;
        policy.pkpAddress = pkpAddress;
        policy.requireAttestation = requireAttestation;
        policy.failMode = failMode;
        policy.ruleCount = rules.length;
        policy.exists = true;

        // Store new rules
        for (uint256 i = 0; i < rules.length; i++) {
            _rules[msg.sender][i] = rules[i];
        }

        emit PolicySetUpdated(
            msg.sender,
            policyCID,
            pkpAddress,
            requireAttestation,
            failMode,
            rules.length
        );
    }

    /// @inheritdoc IPolicyEngine
    function removePolicySet() external override {
        PolicyCodec.PolicySet storage policy = _policies[msg.sender];
        if (!policy.exists) revert NoPolicySet();

        // Clear rules
        for (uint256 i = 0; i < policy.ruleCount; i++) {
            delete _rules[msg.sender][i];
        }

        // Clear policy metadata
        delete _policies[msg.sender];

        emit PolicySetRemoved(msg.sender);
    }

    // ──────────────────── Policy Checking ────────────────────

    /// @inheritdoc IPolicyEngine
    function checkPolicy(
        address account,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata attestation
    ) external override nonReentrant returns (bool) {
        PolicyCodec.PolicySet storage policy = _policies[account];

        // If no policy exists, allow by default
        if (!policy.exists) {
            return true;
        }

        // Evaluate all on-chain rules
        for (uint256 i = 0; i < policy.ruleCount; i++) {
            PolicyCodec.OnChainRule storage rule = _rules[account][i];
            if (!rule.enabled) continue;

            (bool passed, string memory reason) = _evaluateRule(rule, account, target, value, data);
            if (!passed) {
                emit PolicyCheckFailed(account, target, reason);
                return false;
            }
        }

        // Verify off-chain attestation if required
        if (policy.requireAttestation) {
            if (attestation.length == 0) {
                // No attestation provided — check fail mode
                if (policy.failMode == PolicyCodec.FailMode.CLOSED) {
                    emit PolicyCheckFailed(account, target, "Attestation required but not provided");
                    return false;
                }
                // OPEN mode: allow with only on-chain rules
            } else {
                // Verify the attestation
                (PolicyApproval memory approval, bytes memory signature) =
                    _decodeAttestation(attestation);

                // Validate the approval matches this transaction
                if (approval.caller != account) {
                    emit PolicyCheckFailed(account, target, "Attestation caller mismatch");
                    return false;
                }
                if (approval.target != target) {
                    emit PolicyCheckFailed(account, target, "Attestation target mismatch");
                    return false;
                }
                if (approval.value != value) {
                    emit PolicyCheckFailed(account, target, "Attestation value mismatch");
                    return false;
                }
                if (approval.calldataHash != keccak256(data)) {
                    emit PolicyCheckFailed(account, target, "Attestation calldata mismatch");
                    return false;
                }
                if (approval.policyCID != policy.policyCID) {
                    emit PolicyCheckFailed(account, target, "Attestation policy CID mismatch");
                    return false;
                }

                bool valid = _verifyAttestation(approval, signature, policy.pkpAddress);
                if (!valid) {
                    emit PolicyCheckFailed(account, target, "Invalid attestation signature or expired");
                    return false;
                }
            }
        }

        emit PolicyCheckPassed(account, target);
        return true;
    }

    /// @inheritdoc IPolicyEngine
    function evaluateDetailed(
        address account,
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata attestation
    ) external override returns (bool passed, bool[] memory ruleResults, string[] memory reasons) {
        PolicyCodec.PolicySet storage policy = _policies[account];

        if (!policy.exists) {
            ruleResults = new bool[](0);
            reasons = new string[](0);
            return (true, ruleResults, reasons);
        }

        // Count enabled rules for array sizing
        uint256 enabledCount = 0;
        for (uint256 i = 0; i < policy.ruleCount; i++) {
            if (_rules[account][i].enabled) enabledCount++;
        }

        // Add one slot for attestation result if required
        uint256 totalResults = policy.requireAttestation ? enabledCount + 1 : enabledCount;
        ruleResults = new bool[](totalResults);
        reasons = new string[](totalResults);

        passed = true;
        uint256 resultIndex = 0;

        // Evaluate on-chain rules
        for (uint256 i = 0; i < policy.ruleCount; i++) {
            PolicyCodec.OnChainRule storage rule = _rules[account][i];
            if (!rule.enabled) continue;

            (bool rulePassed, string memory reason) = _evaluateRule(rule, account, target, value, data);
            ruleResults[resultIndex] = rulePassed;
            reasons[resultIndex] = rulePassed ? "" : reason;
            if (!rulePassed) passed = false;
            resultIndex++;
        }

        // Evaluate attestation
        if (policy.requireAttestation) {
            if (attestation.length == 0) {
                if (policy.failMode == PolicyCodec.FailMode.CLOSED) {
                    ruleResults[resultIndex] = false;
                    reasons[resultIndex] = "Attestation required but not provided";
                    passed = false;
                } else {
                    ruleResults[resultIndex] = true;
                    reasons[resultIndex] = "Attestation skipped (fail-open mode)";
                }
            } else {
                (PolicyApproval memory approval, bytes memory signature) =
                    _decodeAttestation(attestation);
                bool valid = _verifyAttestation(approval, signature, policy.pkpAddress);
                ruleResults[resultIndex] = valid;
                reasons[resultIndex] = valid ? "" : "Invalid attestation";
                if (!valid) passed = false;
            }
        }
    }

    /// @inheritdoc IPolicyEngine
    function recordExecution(
        address account,
        address target,
        uint256 value,
        bytes calldata data
    ) external override {
        PolicyCodec.PolicySet storage policy = _policies[account];
        if (!policy.exists) return;

        for (uint256 i = 0; i < policy.ruleCount; i++) {
            PolicyCodec.OnChainRule storage rule = _rules[account][i];
            if (!rule.enabled) continue;

            // Only record for stateful rules (Tier 2)
            if (rule.ruleType == PolicyCodec.RuleType.SPEND_LIMIT) {
                spendLimitRule.record(account, i, rule.params, msg.sender, target, value, data);
            } else if (rule.ruleType == PolicyCodec.RuleType.COOLDOWN) {
                cooldownRule.record(account, i, rule.params, msg.sender, target, value, data);
            }
        }
    }

    // ──────────────────── View Functions ────────────────────

    /// @inheritdoc IPolicyEngine
    function getPolicy(address account) external view override returns (PolicyCodec.PolicySet memory) {
        return _policies[account];
    }

    /// @inheritdoc IPolicyEngine
    function hasPolicy(address account) external view override returns (bool) {
        return _policies[account].exists;
    }

    /// @notice Get a specific rule for an account
    function getRule(address account, uint256 ruleIndex)
        external
        view
        returns (PolicyCodec.OnChainRule memory)
    {
        return _rules[account][ruleIndex];
    }

    // ──────────────────── Internal ────────────────────

    /// @dev Evaluate a single on-chain rule using the appropriate singleton evaluator
    function _evaluateRule(
        PolicyCodec.OnChainRule storage rule,
        address caller,
        address target,
        uint256 value,
        bytes calldata data
    ) internal view returns (bool, string memory) {
        PolicyCodec.RuleType ruleType = rule.ruleType;

        if (ruleType == PolicyCodec.RuleType.ALLOW_TARGETS) {
            return allowTargetsRule.evaluate(rule.params, caller, target, value, data);
        } else if (ruleType == PolicyCodec.RuleType.DENY_TARGETS) {
            return denyTargetsRule.evaluate(rule.params, caller, target, value, data);
        } else if (ruleType == PolicyCodec.RuleType.ALLOW_SELECTORS) {
            return allowSelectorsRule.evaluate(rule.params, caller, target, value, data);
        } else if (ruleType == PolicyCodec.RuleType.DENY_SELECTORS) {
            return denySelectorsRule.evaluate(rule.params, caller, target, value, data);
        } else if (ruleType == PolicyCodec.RuleType.MAX_VALUE) {
            return maxValueRule.evaluate(rule.params, caller, target, value, data);
        } else if (ruleType == PolicyCodec.RuleType.SPEND_LIMIT) {
            return spendLimitRule.evaluate(rule.params, caller, target, value, data);
        } else if (ruleType == PolicyCodec.RuleType.COOLDOWN) {
            return cooldownRule.evaluate(rule.params, caller, target, value, data);
        }

        return (false, "Unknown rule type");
    }
}
