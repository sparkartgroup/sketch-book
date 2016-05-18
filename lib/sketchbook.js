'use strict';

const cheerio = require('cheerio');
const File = require('vinyl');
const fs = require('fs');
const humps = require('humps');
const parameterize = require('parameterize');
const Path = require('path');
const sketch = require('gulp-sketch');
const through = require('through2');

const mdRegExp = require('markdown-it-regexp');
const VAR_SYNTAX = /{{[^>](.*)}}/;
const PARTIAL_SYNTAX = /{{(\s)?>(\s)?['"]?([^'"}\s]*)['"]?(\s)?}}/;

module.exports = {
  getAssets: getAssets,
  getImages: getImages,
  getHeadings: getHeadings,
  getSpecs: getSpecs,
  rebase: rebase,
  renderPages: renderPages
};

var specs = {};
var markdown = [];
var templates;

// optional dependencies, user may bring their own templates and Markdown parser
// TODO: test/support this

var Handlebars;
var markdownIt;

try {
  Handlebars = require('handlebars');
  markdownIt = require('markdown-it')()
    .use(mdRegExp(PARTIAL_SYNTAX, renderPartial))
    .use(mdRegExp(VAR_SYNTAX, renderData))
    .use(require('markdown-it-linkify-images'))
    .use(require('markdown-it-deflist'))
    .use(require('markdown-it-header-sections'))
    .use(require('markdown-it-anchor'));
} catch (err) {}

/**
 * Exports artboards in given Sketch files to SVG.
 *
 * @returns a duplex transform object stream for piping input/output files.
 */

function getAssets () {
  return through.obj(function (file, enc, next) {
    if (Path.extname(file.path) === '.sketch') this.push(file);
    next();
  }).pipe(sketch({
    export: 'artboards',
    formats: 'svg'
  }));
}

/**
 * Parses Markdown source to extract all headings.
 *
 * @returns an array of heading objects.
 */

function getHeadings (source) {
  const ast = markdownIt.parse(source);

  return ast.reduce((headings, token, index) => {
    if (!token.type || token.type !== 'heading_open') return headings;

    return headings.concat({
      text: ast[index + 1].children[0].content,
      anchor: token.attrs && token.attrs.find((attr) => attr[0] === 'id')[1],
      tag: token.tag
    });
  }, []);
}

/**
 * Gathers any found image files and resizes any bitmap images for display on the web.
 *
 * @returns a duplex transform object stream for piping input/output files.
 */

function getImages () {
  return through.obj(function (file, enc, next) {
    if (Path.extname(file.path).match(/(gif|jpg|png|svg)/)) this.push(file);
    next();
  });
  // TODO: resize bitmap images
}

/**
 * Returns value for a given key accessed from a given object.
 * used for stackoverflow.com/a/6394168 hackery
 *
 * @param {object} object - Object to access.
 * @param {string} path - Key to access object with.
 * @returns context value for specified key.
 */

function getProp (object, path) {
  return object[path];
}

/**
 * Parses color and text styles from exported Sketch artboards.
 *
 * @returns a duplex transform object stream for piping input/output files.
 */

function getSpecs (file) {
  if (Path.extname(file.path) !== '.svg') return;

  const $ = cheerio.load(file.contents.toString());

  var swatches = [];
  var textStyles = [];

  $('rect').each((i, layer) => {
    const $layer = $(layer);

    swatches.push({
      hex: $layer.attr('fill'),
      name: $layer.attr('id')
    });
  });

  $('text').each((i, layer) => {
    const $layer = $(layer);

    const textStyle = {
      name: $layer.attr('id'),
      className: parameterize($layer.attr('id'))
    };

    let props = {
      'fontFamily': ($layer.attr('font-family') || $layer.closest('*[font-family]').attr('font-family')).split(',').pop().trim(),
      'fontWeight': $layer.attr('font-weight') || $layer.closest('*[font-weight]').attr('font-weight'),
      'fontSize': ($layer.attr('font-size') || $layer.closest('*[font-size]').attr('font-size'))
    };

    // calculate relative line height
    let lineHeight = ($layer.attr('line-spacing') || $layer.closest('*[line-spacing]').attr('line-spacing'));
    if (lineHeight) props.lineHeight = parseFloat(lineHeight) / parseFloat(props.fontSize);

    // save camelized/integer-based version of props
    textStyle.props = props;

    // save valid version of styles and serialize an inline version
    props = humps.decamelizeKeys(props, { separator: '-' });

    textStyle.inlineStyles = Object.keys(props).reduce((inline, key) => {
      let val = props[key];
      if (key === 'font-size') val = `${val}px`;
      if (key === 'font-family') val = `"${val}"`;
      inline += key + ': ' + val + '; ';
      return inline;
    }, '').trim();

    textStyle.styles = textStyle.inlineStyles.replace(/;\s/g, ';\n');
    textStyles.push(textStyle);
  });

  textStyles = textStyles.reverse();

  return {
    colors: swatches,
    textStyles: textStyles
  };
}

/**
 * Gets and compiles template source for a specified boilerplate template filename.
 *
 * @param {string} filename - Valid filename .
 * @returns a compiled Handlebars template function.
 */

function getTemplate (path) {
  if (!Path.isAbsolute(path)) path = Path.join(__dirname, '..', 'boilerplate', path);
  return Handlebars.compile(fs.readFileSync(path, 'utf-8'));
}

/**
 * Rebase file paths onto specified file patterns.
 *
 * @param {array} args - One or more file patterns.
 * @returns a duplex transform object stream for piping input/output files.
 */

function rebase (args) {
  const dirnames = args && args.map((pattern) => Path.join(Path.dirname(pattern).replace(/\*/g, ''), Path.sep)) || [];

  return through.obj(function (file, enc, next) {
    dirnames.forEach((dirname) => {
      file.base = file.base.replace(dirname, '');
      file.path = file.path.replace(dirname, '');
    });

    this.push(file);
    next();
  });
}

/**
 * Parses Markdown to HTML and renders one or more pages from a context that
 * includes this and any parsed Sketch specs.
 *
 * @param {string} customTemplate - Path to a custom Handlebars layout template.
 * @returns a duplex transform object stream for piping input/output files.
 */

function renderPages (customTemplate) {
  // gather exported assets, extract specs to a context, and then render pages

  templates = {
    colors: getTemplate('colors.hbs'),
    styles: getTemplate('styles.hbs')
  };

  templates.layout = (customTemplate && Path.extname(customTemplate).match(/(hbs|handlebars|hb)/))
    ? getTemplate(customTemplate)
    : getTemplate('layout.hbs');

  const assets = [];
  markdown = [];

  return through.obj(function (file, enc, next) {
    if (Path.extname(file.path) === '.svg') assets.push(file);
    if (Path.extname(file.path).substr(1, 1) === 'm') markdown.push(file);
    next();
  }, function (done) {
    // populate specs context if any assets were input
    if (assets) {
      assets.reduce((context, file) => {
        specs[Path.basename(file.path, Path.extname(file.path))] = getSpecs(file);
        return context;
      }, {});
    }

    // render a page for each Markdown source

    markdown.forEach((file) => {
      const source = file.contents.toString();
      const markup = markdownIt.render(source);

      this.push(new File({
        path: file.path.replace(Path.extname(file.path), '.html'),
        contents: new Buffer(templates.layout({
          body: markup,
          headings: getHeadings(source)
        }))
      }));
    });

    done();
  });
}

/**
 * Traverses specs context for data to render inline.
 * Optionally uses a built-in template if specified: `{template}: data`
 *
 * @param {array} ref - Regular Expression match result.
 * @returns raw data or markup, if template is specified.
 */

function renderData (ref) {
  ref = ref[1].split(':');

  if (ref.length > 1) {
    const name = ref.shift();
    var template = templates[name];

    if (!template) throw new Error(`built-in template ${name} not found`);
    // TODO: bubble error to a better place
  }

  const path = ref[0].trim();
  const data = path.split('.').reduce(getProp, specs);

  return template
    ? template(data)
    : data;
}

/**
 * Parses Markdown to HTML and renders one or more pages from a context that
 * includes this and any parsed Sketch specs.
 *
 * @param {string} path - Relative path to a Markdown file.
 * @returns a duplex transform object stream for piping input/output files.
 */

function renderPartial (match) {
  const path = match[3];

  const file = markdown.find((file) => {
    const extname = Path.extname(file.path);
    const dirname = Path.dirname(file.path);
    const basename = Path.basename(file.path, extname);

    return ((path === file.path) || (path === Path.join(dirname, basename)));
  });

  return file
    ? markdownIt.render(file.contents.toString())
    : `Partial '${path}' not found`;
}

