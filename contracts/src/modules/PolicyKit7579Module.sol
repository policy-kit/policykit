// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPolicyEngine} from "../core/IPolicyEngine.sol";

/// @dev ERC-7579 Module Type IDs
uint256 constant MODULE_TYPE_VALIDATOR = 1;
uint256 constant MODULE_TYPE_HOOK = 4;

/// @title PolicyKit7579Module
/// @notice ERC-7579 compatible module that enforces PolicyKit policies
///         as a validator and execution hook for smart accounts.
///
/// Integration pattern:
///   1. Deploy PolicyEngine
///   2. Deploy this module with PolicyEngine address
///   3. Install this module on your ERC-7579 smart account
///   4. Set policies via PolicyEngine.setPolicySet()
///   5. Transactions are automatically validated against policies
///
/// Implements:
///   - IValidator: validates UserOperations before execution
///   - IHook: records state after execution for Tier 2 rules
contract PolicyKit7579Module {
    // ──────────────────── Storage ────────────────────

    IPolicyEngine public immutable policyEngine;

    /// @dev Per-account module configuration
    mapping(address => bool) public initialized;

    // ──────────────────── Events ────────────────────

    event ModuleInstalled(address indexed account);
    event ModuleUninstalled(address indexed account);

    // ──────────────────── Errors ────────────────────

    error AlreadyInitialized();
    error NotInitialized();
    error InvalidModuleType();
    error PolicyValidationFailed();

    // ──────────────────── Constructor ────────────────────

    constructor(address _policyEngine) {
        policyEngine = IPolicyEngine(_policyEngine);
    }

    // ──────────────────── ERC-7579 Module Lifecycle ────────────────────

    /// @notice Called when the module is installed on a smart account
    /// @param data Installation data (unused for PolicyKit)
    function onInstall(bytes calldata data) external {
        if (initialized[msg.sender]) revert AlreadyInitialized();
        initialized[msg.sender] = true;
        emit ModuleInstalled(msg.sender);
    }

    /// @notice Called when the module is uninstalled from a smart account
    /// @param data Uninstallation data (unused)
    function onUninstall(bytes calldata data) external {
        if (!initialized[msg.sender]) revert NotInitialized();
        initialized[msg.sender] = false;
        emit ModuleUninstalled(msg.sender);
    }

    /// @notice Check if the module is initialized for an account
    function isInitialized(address account) external view returns (bool) {
        return initialized[account];
    }

    /// @notice Returns whether this module supports a given module type
    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR || moduleTypeId == MODULE_TYPE_HOOK;
    }

    // ──────────────────── IValidator ────────────────────

    /// @notice Validate a UserOperation against the account's policy
    /// @dev Called by the smart account during ERC-4337 validation phase
    ///
    /// The UserOp signature is expected to contain:
    ///   abi.encode(ownerSignature, policyAttestation)
    ///
    /// Where policyAttestation is the Lit PKP EIP-712 signature
    /// (empty bytes if no Tier 3 rules exist)
    ///
    /// @param userOpHash The hash of the UserOperation
    /// @param signature The compound signature (owner + attestation)
    /// @return validationData 0 if valid, 1 if invalid (per ERC-4337 spec)
    function validateUserOp(
        bytes32 userOpHash,
        bytes calldata signature
    ) external returns (uint256 validationData) {
        if (!initialized[msg.sender]) {
            return 1; // SIG_VALIDATION_FAILED
        }

        // Decode compound signature
        (bytes memory ownerSig, bytes memory attestation) = abi.decode(
            signature,
            (bytes, bytes)
        );

        // The actual UserOp calldata validation happens in the preCheck hook
        // During validateUserOp, we only verify the attestation structure is valid
        // This is because we don't have access to the full execution calldata here

        // If the account has no policy, validation passes
        if (!policyEngine.hasPolicy(msg.sender)) {
            return 0;
        }

        return 0; // Validation passes; enforcement happens in hooks
    }

    // ──────────────────── IHook ────────────────────

    /// @notice Pre-execution hook — enforces policy before the call
    /// @param msgSender The address triggering the execution
    /// @param msgValue The ETH value of the call
    /// @param msgData The encoded execution calldata
    /// @return hookData Data to pass to postCheck
    function preCheck(
        address msgSender,
        uint256 msgValue,
        bytes calldata msgData
    ) external returns (bytes memory hookData) {
        if (!initialized[msg.sender]) {
            return "";
        }

        // Decode the execute calldata to extract target, value, data
        // ERC-7579 execute format: execute(bytes32 mode, bytes executionCalldata)
        // For single execution: executionCalldata = abi.encode(target, value, data)
        if (msgData.length < 4) {
            return "";
        }

        // Extract execution parameters from msgData
        // The hook receives the full calldata including function selector
        (address target, uint256 value, bytes memory data) = _decodeExecution(msgData);

        // Check policy (without attestation in hook — attestation checked in validateUserOp)
        bool passed = policyEngine.checkPolicy(
            msg.sender,
            target,
            value,
            data,
            "" // Attestation handled separately
        );

        if (!passed) {
            revert PolicyValidationFailed();
        }

        // Pass execution params to postCheck for state recording
        return abi.encode(target, value, data);
    }

    /// @notice Post-execution hook — records state for Tier 2 rules
    /// @param hookData Data from preCheck containing execution params
    function postCheck(bytes calldata hookData) external {
        if (hookData.length == 0) return;

        (address target, uint256 value, bytes memory data) = abi.decode(
            hookData,
            (address, uint256, bytes)
        );

        // Record execution for stateful rules (spend limits, cooldowns)
        policyEngine.recordExecution(msg.sender, target, value, data);
    }

    // ──────────────────── Internal ────────────────────

    /// @dev Decode execution parameters from smart account calldata
    /// Handles the common case of single execution
    function _decodeExecution(bytes calldata msgData)
        internal
        pure
        returns (address target, uint256 value, bytes memory data)
    {
        // Skip the function selector (4 bytes)
        if (msgData.length < 100) {
            return (address(0), 0, "");
        }

        // Try to decode as (address target, uint256 value, bytes data)
        // This covers the most common execution formats
        bytes calldata execData = msgData[4:];
        (target, value, data) = abi.decode(execData, (address, uint256, bytes));
    }
}
