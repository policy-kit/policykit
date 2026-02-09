// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../src/core/PolicyEngine.sol";
import "../../src/modules/PolicyKit7579Module.sol";
import "../../src/libraries/PolicyCodec.sol";

contract PolicyKit7579ModuleTest is Test {
    PolicyEngine engine;
    PolicyKit7579Module module7579;

    address constant ALICE = address(0xA11CE);
    address constant UNISWAP = address(0x1);
    bytes32 constant MOCK_CID = bytes32(uint256(0x1234));

    function setUp() public {
        engine = new PolicyEngine();
        module7579 = new PolicyKit7579Module(address(engine));
    }

    function test_Install() public {
        vm.prank(ALICE);
        module7579.onInstall("");
        assertTrue(module7579.isInitialized(ALICE));
    }

    function test_Uninstall() public {
        vm.startPrank(ALICE);
        module7579.onInstall("");
        assertTrue(module7579.isInitialized(ALICE));

        module7579.onUninstall("");
        assertFalse(module7579.isInitialized(ALICE));
        vm.stopPrank();
    }

    function test_RevertDoubleInstall() public {
        vm.startPrank(ALICE);
        module7579.onInstall("");
        vm.expectRevert(PolicyKit7579Module.AlreadyInitialized.selector);
        module7579.onInstall("");
        vm.stopPrank();
    }

    function test_RevertUninstallNotInitialized() public {
        vm.prank(ALICE);
        vm.expectRevert(PolicyKit7579Module.NotInitialized.selector);
        module7579.onUninstall("");
    }

    function test_ModuleTypes() public view {
        assertTrue(module7579.isModuleType(1)); // VALIDATOR
        assertTrue(module7579.isModuleType(4)); // HOOK
        assertFalse(module7579.isModuleType(2)); // EXECUTOR
        assertFalse(module7579.isModuleType(3)); // FALLBACK
    }

    function test_ValidateUserOp_NoPolicy() public {
        vm.startPrank(ALICE);
        module7579.onInstall("");

        bytes memory signature = abi.encode(bytes("sig"), bytes(""));
        uint256 result = module7579.validateUserOp(bytes32(0), signature);
        assertEq(result, 0); // valid
        vm.stopPrank();
    }

    function test_ValidateUserOp_NotInitialized() public {
        vm.prank(ALICE);
        bytes memory signature = abi.encode(bytes("sig"), bytes(""));
        uint256 result = module7579.validateUserOp(bytes32(0), signature);
        assertEq(result, 1); // SIG_VALIDATION_FAILED
    }
}
