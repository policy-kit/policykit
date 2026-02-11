---
name: policykit
description: Build and enforce transaction policies for ERC-7579 smart accounts and AI agent wallets. Use when defining spending limits, target allowlists, cooldowns, slippage protection, or any programmable guardrails for smart account transactions.
license: MIT
compatibility: Requires Node.js >= 18.0.0 and pnpm or npm. Solidity contracts use Foundry. Supports ERC-4337 and ERC-7579 smart accounts.
metadata:
  author: policy-kit
  version: "0.1.0"
  github: https://github.com/policy-kit/policykit
---

# PolicyKit

PolicyKit is a decentralized policies-as-code SDK for composable, enforceable transaction policies on smart accounts. It combines on-chain smart contracts with off-chain computation via Lit Protocol to provide a three-tier rule evaluation system.

## Capabilities

PolicyKit enables AI agents and developers to:

- **Define transaction policies** using a fluent TypeScript PolicyBuilder API with chainable methods
- **Enforce spending limits** per token with configurable time windows (e.g., 50k USDC per day)
- **Restrict transaction targets** to allowlisted contract addresses (e.g., only Uniswap, Aave)
- **Set cooldowns** between transactions (e.g., minimum 5 minutes between txs)
- **Limit slippage** on DeFi trades with basis-point precision
- **Require transaction simulation** before execution for safety
- **Deploy policies on-chain** to the PolicyEngine smart contract
- **Store policies on IPFS** for decentralized, tamper-proof persistence
- **Evaluate policies off-chain** via Lit Protocol for complex rules with signed attestations
- **Simulate policies locally** for testing without on-chain deployment
- **Manage policies via CLI** with init, deploy, simulate, inspect, and remove commands

## Skills

### Define a Policy

Use `PolicyBuilder` to construct a policy with rules:

```typescript
import { PolicyBuilder } from "@policy-kit/sdk";
import { parseEther } from "viem";

const policy = new PolicyBuilder("my-policy")
  .allowTargets(["0xUniswapRouter", "0xAavePool"])
  .maxValue(parseEther("10"))
  .spendLimit("0xUSDC", parseEther("50000"), 86400)
  .cooldown(300)
  .maxSlippageBps(50)
  .requireSimulation(true)
  .setFailMode("closed")
  .build();
```

### Deploy a Policy

Use the CLI to deploy:

```bash
npx policykit deploy --network base --account 0xYourSmartAccount
```

Or use the SDK client:

```typescript
import { PolicyKitClient } from "@policy-kit/sdk";

const client = new PolicyKitClient({ network: "base" });
await client.deploy(policy, { account: "0xYourSmartAccount" });
```

### Simulate a Policy

Test a policy locally before deploying:

```typescript
import { PolicySimulator } from "@policy-kit/sdk";

const simulator = new PolicySimulator();
const result = await simulator.evaluate(policy, transaction);
// result.allowed: boolean
// result.violations: string[]
```

Or via CLI:

```bash
npx policykit simulate --policy ./my-policy.json --tx ./transaction.json
```

### Initialize a New Policy Project

```bash
npx policykit init my-policy-project
```

## Workflows

### Smart Account Policy Setup

1. Install the SDK: `npm install @policy-kit/sdk`
2. Define a policy using `PolicyBuilder` with desired rules
3. Simulate the policy locally with `PolicySimulator`
4. Deploy the policy using `PolicyKitClient` or the CLI
5. The PolicyEngine smart contract enforces rules on every transaction

### AI Agent Wallet Guardrails

1. Create a policy with strict spending limits and target allowlists
2. Set fail mode to "closed" (deny by default)
3. Add cooldown rules to prevent rapid-fire transactions
4. Deploy to the agent's smart account
5. The agent can only execute transactions that pass all policy rules

### DAO Treasury Protection

1. Define a policy with multi-tier rules (on-chain + off-chain)
2. Set spending limits per token and per time window
3. Restrict targets to approved DeFi protocols
4. Use off-chain rules via Lit Protocol for complex governance checks
5. Deploy as an execution guard on the DAO treasury

## Integration

- **Smart account standards**: ERC-4337, ERC-7579
- **Chains**: Any EVM-compatible chain (Ethereum, Base, Arbitrum, etc.)
- **Storage**: IPFS (Pinata, Infura, custom backends)
- **Off-chain compute**: Lit Protocol v8 (Naga network)
- **Build tools**: Foundry (Solidity contracts), TypeScript (SDK/CLI)
- **Package manager**: npm, pnpm

## Context

PolicyKit uses a three-tier rule evaluation system:

1. **Tier 1 — On-chain stateless rules**: Pure function checks (target allowlists, max value). Cheapest gas cost, no storage reads.
2. **Tier 2 — On-chain stateful rules**: Rules that read/write contract storage (spend limits with time windows, cooldowns, nonce tracking).
3. **Tier 3 — Off-chain rules**: Complex evaluations via Lit Protocol (price oracle checks, slippage calculations, simulation requirements). Produce signed attestations verified on-chain.

Policies are non-custodial — account owners maintain full control and can update or remove policies at any time.
