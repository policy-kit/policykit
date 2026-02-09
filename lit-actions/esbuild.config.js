import { build } from "esbuild";

await build({
  entryPoints: ["src/policyEvaluator.action.ts"],
  bundle: true,
  outfile: "build/policyEvaluator.action.js",
  format: "iife",
  platform: "neutral",
  target: "es2020",
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

console.log("Lit Action built successfully: build/policyEvaluator.action.js");
