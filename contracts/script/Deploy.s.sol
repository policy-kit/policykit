// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/core/PolicyEngine.sol";
import "../src/modules/PolicyKit7579Module.sol";

/// @title Deploy
/// @notice Deployment script for PolicyKit contracts on Base
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy PolicyEngine (deploys all rule evaluator singletons internally)
        PolicyEngine engine = new PolicyEngine();
        console.log("PolicyEngine deployed at:", address(engine));
        console.log("  AllowTargetsRule:", address(engine.allowTargetsRule()));
        console.log("  DenyTargetsRule:", address(engine.denyTargetsRule()));
        console.log("  AllowSelectorsRule:", address(engine.allowSelectorsRule()));
        console.log("  DenySelectorsRule:", address(engine.denySelectorsRule()));
        console.log("  MaxValueRule:", address(engine.maxValueRule()));
        console.log("  SpendLimitRule:", address(engine.spendLimitRule()));
        console.log("  CooldownRule:", address(engine.cooldownRule()));

        // 2. Deploy ERC-7579 Module
        PolicyKit7579Module module7579 = new PolicyKit7579Module(address(engine));
        console.log("PolicyKit7579Module deployed at:", address(module7579));

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID:", block.chainid);
        console.log("PolicyEngine:", address(engine));
        console.log("PolicyKit7579Module:", address(module7579));
    }
}

/// @title DeployBaseSepolia
/// @notice Convenience script for Base Sepolia testnet deployment
contract DeployBaseSepolia is Deploy {
    function setUp() public {
        // Base Sepolia chain ID: 84532
    }
}
