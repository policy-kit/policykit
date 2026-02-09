import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { simulateCommand } from "./commands/simulate.js";
import { deployCommand } from "./commands/deploy.js";
import { inspectCommand } from "./commands/inspect.js";
import { removeCommand } from "./commands/remove.js";

const program = new Command()
  .name("policykit")
  .description(
    "PolicyKit CLI — Decentralized policies-as-code for smart accounts and agents"
  )
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(simulateCommand);
program.addCommand(deployCommand);
program.addCommand(inspectCommand);
program.addCommand(removeCommand);

program.parse();
