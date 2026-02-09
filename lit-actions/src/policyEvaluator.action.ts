/**
 * PolicyKit Policy Evaluator — Lit Action (v8 / Naga)
 *
 * This script runs on the Lit Protocol decentralized network.
 * It evaluates Tier 3 off-chain policy rules and, if all pass,
 * threshold-signs an EIP-712 PolicyApproval using the bound PKP.
 *
 * Lit SDK v8 runtime changes:
 * - Parameters are accessed via jsParams.* (no longer injected as globals)
 * - Use Lit.Actions.* (canonical namespace in v8)
 *
 * Inputs (via jsParams):
 * - policyCID: IPFS CID of the policy JSON (plain or encrypted envelope)
 * - caller: Address initiating the transaction
 * - target: Target contract address
 * - value: ETH value (as string)
 * - calldata: Transaction calldata
 * - chainId: Chain ID (as string)
 * - expiry: Approval expiry timestamp (as string)
 * - pkpPublicKey: Public key of the bound PKP
 * - encrypted: Whether the policy on IPFS is encrypted via Lit (boolean)
 *
 * Output (via Lit.Actions.setResponse):
 * - JSON with { approved, signature?, expiry?, failedRule?, reason?, ruleResults? }
 */

import { evaluateMaxSlippage } from "./rules/maxSlippage.js";
import { evaluateSimulation } from "./rules/simulateTransaction.js";
import { evaluateCustomRule } from "./rules/customRule.js";

// Declare Lit globals (available in the Lit Action runtime)
declare const Lit: {
  Actions: {
    setResponse: (args: { response: string }) => void;
    signEcdsa: (args: {
      toSign: Uint8Array;
      publicKey: string;
      sigName: string;
    }) => Promise<{ signature: string; publicKey: string; recid: number }>;
    decryptAndCombine: (args: {
      accessControlConditions: unknown[];
      ciphertext: string;
      dataToEncryptHash: string;
      authSig: null;
      chain: string;
    }) => Promise<string>;
  };
};

// v8: jsParams is a global object containing all parameters
// passed via the jsParams property in executeJs()
declare const jsParams: {
  policyCID: string;
  caller: string;
  target: string;
  value: string;
  calldata: string;
  chainId: string;
  expiry: string;
  pkpPublicKey: string;
  /** Whether the policy on IPFS is encrypted via Lit */
  encrypted: boolean;
};

declare const ethers: {
  utils: {
    solidityKeccak256: (types: string[], values: unknown[]) => string;
    arrayify: (value: string) => Uint8Array;
    keccak256: (data: string) => string;
  };
};

interface PolicyJSON {
  version: string;
  id: string;
  rules: {
    offChain: Array<{
      type: string;
      [key: string]: unknown;
    }>;
  };
}

interface EncryptedPolicyEnvelope {
  v: "policykit-enc-1";
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: unknown[];
}

const go = async () => {
  // v8: Access parameters via the global jsParams object
  // (in v7, these were injected as top-level globals)
  const params = jsParams;

  try {
    // 1. Fetch policy from IPFS
    const policyResponse = await fetch(
      `https://ipfs.io/ipfs/${params.policyCID}`
    );
    if (!policyResponse.ok) {
      Lit.Actions.setResponse({
        response: JSON.stringify({
          approved: false,
          reason: `Failed to fetch policy from IPFS: ${policyResponse.statusText}`,
        }),
      });
      return;
    }

    let policy: PolicyJSON;

    const rawData = await policyResponse.json();

    // 1b. If the policy is encrypted, decrypt it using Lit
    if (params.encrypted || rawData.v === "policykit-enc-1") {
      const envelope = rawData as EncryptedPolicyEnvelope;
      try {
        const decrypted = await Lit.Actions.decryptAndCombine({
          accessControlConditions: envelope.accessControlConditions,
          ciphertext: envelope.ciphertext,
          dataToEncryptHash: envelope.dataToEncryptHash,
          authSig: null,
          chain: "ethereum",
        });
        policy = JSON.parse(decrypted) as PolicyJSON;
      } catch (decryptError) {
        Lit.Actions.setResponse({
          response: JSON.stringify({
            approved: false,
            reason: `Failed to decrypt policy: ${decryptError}`,
          }),
        });
        return;
      }
    } else {
      policy = rawData as PolicyJSON;
    }

    // 2. Evaluate each off-chain rule
    const ruleResults: Array<{
      rule: string;
      passed: boolean;
      reason?: string;
    }> = [];

    const ctx = {
      caller: params.caller,
      target: params.target,
      calldata: params.calldata,
      value: params.value,
      chainId: params.chainId,
    };

    for (const rule of policy.rules.offChain) {
      let result: { passed: boolean; reason?: string };

      switch (rule.type) {
        case "MAX_SLIPPAGE_BPS":
          result = await evaluateMaxSlippage(
            { maxBps: rule.maxBps as number },
            ctx
          );
          break;

        case "REQUIRE_SIMULATION":
          result = await evaluateSimulation(
            { mustSucceed: rule.mustSucceed as boolean },
            ctx
          );
          break;

        case "CUSTOM":
          result = await evaluateCustomRule(
            {
              name: rule.name as string,
              description: rule.description as string,
              logicCID: rule.logicCID as string | undefined,
            },
            ctx
          );
          break;

        default:
          result = { passed: false, reason: `Unknown rule type: ${rule.type}` };
      }

      ruleResults.push({
        rule: rule.type,
        passed: result.passed,
        reason: result.reason,
      });

      // Short-circuit on first failure
      if (!result.passed) {
        Lit.Actions.setResponse({
          response: JSON.stringify({
            approved: false,
            failedRule: rule.type,
            reason: result.reason,
            ruleResults,
          }),
        });
        return;
      }
    }

    // 3. All rules passed — construct the message to sign
    const calldataHash = ethers.utils.keccak256(params.calldata);

    const messageHash = ethers.utils.solidityKeccak256(
      [
        "address",
        "address",
        "uint256",
        "bytes32",
        "uint256",
        "bytes32",
        "uint256",
      ],
      [
        params.caller,
        params.target,
        params.value,
        calldataHash,
        params.expiry,
        // Convert CID to bytes32 (simplified — matches SDK encoding)
        ethers.utils.keccak256(
          ethers.utils.solidityKeccak256(["string"], [params.policyCID])
        ),
        params.chainId,
      ]
    );

    // 4. Threshold-sign with the PKP
    const signature = await Lit.Actions.signEcdsa({
      toSign: ethers.utils.arrayify(messageHash),
      publicKey: params.pkpPublicKey,
      sigName: "policyApproval",
    });

    // 5. Return approval + signature
    Lit.Actions.setResponse({
      response: JSON.stringify({
        approved: true,
        signature: signature.signature,
        expiry: params.expiry,
        ruleResults,
      }),
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        approved: false,
        reason: `Policy evaluation error: ${error}`,
      }),
    });
  }
};

go();
