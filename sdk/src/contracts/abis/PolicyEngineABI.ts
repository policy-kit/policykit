export const POLICY_ENGINE_ABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPolicySet",
    inputs: [
      { name: "policyCID", type: "bytes32", internalType: "bytes32" },
      { name: "pkpAddress", type: "address", internalType: "address" },
      { name: "requireAttestation", type: "bool", internalType: "bool" },
      { name: "failMode", type: "uint8", internalType: "enum PolicyCodec.FailMode" },
      {
        name: "rules",
        type: "tuple[]",
        internalType: "struct PolicyCodec.OnChainRule[]",
        components: [
          { name: "ruleType", type: "uint8", internalType: "enum PolicyCodec.RuleType" },
          { name: "params", type: "bytes", internalType: "bytes" },
          { name: "enabled", type: "bool", internalType: "bool" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removePolicySet",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "checkPolicy",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "target", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "data", type: "bytes", internalType: "bytes" },
      { name: "attestation", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "evaluateDetailed",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "target", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "data", type: "bytes", internalType: "bytes" },
      { name: "attestation", type: "bytes", internalType: "bytes" },
    ],
    outputs: [
      { name: "passed", type: "bool", internalType: "bool" },
      { name: "ruleResults", type: "bool[]", internalType: "bool[]" },
      { name: "reasons", type: "string[]", internalType: "string[]" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordExecution",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "target", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPolicy",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct PolicyCodec.PolicySet",
        components: [
          { name: "policyCID", type: "bytes32", internalType: "bytes32" },
          { name: "pkpAddress", type: "address", internalType: "address" },
          { name: "requireAttestation", type: "bool", internalType: "bool" },
          { name: "failMode", type: "uint8", internalType: "enum PolicyCodec.FailMode" },
          { name: "ruleCount", type: "uint256", internalType: "uint256" },
          { name: "exists", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasPolicy",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRule",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "ruleIndex", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct PolicyCodec.OnChainRule",
        components: [
          { name: "ruleType", type: "uint8", internalType: "enum PolicyCodec.RuleType" },
          { name: "params", type: "bytes", internalType: "bytes" },
          { name: "enabled", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PolicySetUpdated",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "policyCID", type: "bytes32", indexed: false },
      { name: "pkpAddress", type: "address", indexed: false },
      { name: "requireAttestation", type: "bool", indexed: false },
      { name: "failMode", type: "uint8", indexed: false },
      { name: "ruleCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicySetRemoved",
    inputs: [{ name: "account", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "PolicyCheckPassed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PolicyCheckFailed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const;
