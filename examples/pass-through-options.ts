import { Command } from "../src";
const program = new Command('pass-through-options')

program
    .argument('<utility>', 'Utility to run')
    .argument('[args...]', 'Arguments for the utility')
    .passThroughOptions()
    .option('-d, --dry-run', 'Perform a dry run')
    .action((utility, args, options) => {
        const action = options.dryRun ? 'Would run' : 'Running';
        console.log(`${action}: ${utility} ${args.join(' ')}`);
    });

program.parseAsync()

// Try the following:
//    pnpm tsx pass-through-options.ts git status
//    pnpm tsx pass-through-options.ts git --version
//    pnpm tsx pass-through-options.ts --dry-run git checkout -b new-branch
//    pnpm tsx pass-through-options.ts git push --dry-run