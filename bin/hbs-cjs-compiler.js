#!/usr/bin/env node
'use strict';

const fs    = require('fs');
const yargs = require('yargs');

var argv, cli, helpers, namespace, templateDir;

cli = yargs
  .usage(
`Compiles handlebars templates into CommonJS modules.
Usage: $0 [options] <directory>`)
  .example('$0 templates', 'Compile "templates" directory and print to stdout')
  .example('$0 --known join --known modChoose --file myTemplates.js templates',
    'Compile "templates" directory, output to myTemplates.js, hint about join and modChoose helpers')
  .example('$0 -k join -f myTemplates.js -n bam templates',
    'Compile "templates" directory, output to myTemplates.js, hint about join helper, namespace templates with bam/')
  .version(() => {
    return require('../package.json').version;
  })
  .alias('f', 'file')
  .describe('f', 'Output file')
  .alias('h', 'help')
  .help('h')
  .alias('k', 'known')
  .describe('k', 'Known helper')
  .alias('n', 'namespace')
  .describe('n', 'Template namespace (prefix)');

argv = cli.argv;
templateDir = argv._;
helpers = [];
namespace = argv.namespace || '';

if (argv.known) {
  helpers = argv.known instanceof Array ? argv.known : [argv.known];
}

// must specify exactly one template directory
if (1 !== templateDir.length) {
  console.error('Exactly 1 template directory must be provided\n');
  console.error(cli.help());
  process.exit(1);
}

templateDir = templateDir[0];

require('..').asScript(templateDir, {helpers: helpers, namespace: namespace})
  .catch((err) => {
    console.log(err);
    process.exit(1);
  })
  .then((script) => {
    if (argv.file) {
      fs.writeFileSync(argv.file, script);
    } else {
      process.stdout.write(script);
    }
  });
