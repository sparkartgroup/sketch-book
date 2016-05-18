#!/usr/bin/env node
'use strict';

const chalk = require('chalk');
const fs = require('fs');
const merge = require('merge-stream');
const meow = require('meow');
const Path = require('path');
const vfs = require('vinyl-fs');

const sketchbook = require('./sketchbook');
const PREFIX = chalk.yellow('sketchbook ░░');

function logError (err) {
  console.error(PREFIX, chalk.red(err));
}

const defaults = {
  output: '.build'
};

const cli = meow(`
  Usage
    $ sketchbook <file|directory|glob>... [-o output path] [-t template path]

  Any mix of Sketch, image, and Markdown files are accepted as input.
  Supported globs: https://git.io/vrluA

  Options
    -o, --output    Path to write rendered pages and supporting assets to
    -t, --template  Path to a custom Handlebars layout template
`, {
  alias: {
    o: 'output',
    t: 'template'
  }
});

// flag validation

if (cli.input.length === 0) {
  logError('must specify one or more input files (Sketch, Markdown, and images)');
  process.exit(1);
}

if (cli.flags.template && (typeof cli.flags.template !== 'string' || !Path.extname(cli.flags.template).match(/(hbs|handlebars|hb)/))) {
  logError('custom template must be Handlebars and end in .hbs, .handlebars, or .hb');
  process.exit(1);
}

if (cli.flags.template) {
  var customTemplatePath = Path.join(process.cwd(), cli.flags.template);

  try {
    fs.statSync(customTemplatePath);
  } catch (err) {
    logError(`specified template does not exist: ${customTemplatePath}`);
    process.exit(1);
  }
}

// create build pipeline

const assets = vfs.src(cli.input).pipe(sketchbook.getAssets());
const images = vfs.src(cli.input).pipe(sketchbook.getImages());
const outputDir = cli.flags.output || defaults.output;

merge()
  .add(merge(vfs.src(cli.input), assets).pipe(sketchbook.renderPages(customTemplatePath)))
  .add(assets)
  .add(images)
  .pipe(sketchbook.rebase(cli.input))
  .pipe(vfs.dest(outputDir))
  .on('end', () => {
    console.info(PREFIX, chalk.green('Done!') + chalk.gray(' output saved to ') + chalk.cyan('outputDir'));
  });
