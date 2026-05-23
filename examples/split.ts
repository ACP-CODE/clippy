import { Command } from "../src";

const program = new Command('split');

program
    .option('--first','')
    .option('-s, --separator <char>', '', {default: ''})
    .argument('<string>', '')
    .action((string, options) => {
        const limit = options.first ? 1 : undefined;
        console.log(string.split(options.separator, limit));
    });

program.parse();

const options = program.opts() as { first?: boolean; separator?: string };
console.log('Options:', options.first);
// const limit = options.first ? 1 : undefined;
// console.log(program.args[0].split(options.separator, limit));

// Try the following:
//    pnpm tsx split -s / --fits a/b/c
//    pnpm tsx split -s / --first a/b/c
//    pnpm tsx split --separator=, a,b,c
