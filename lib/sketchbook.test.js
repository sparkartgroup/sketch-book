'use strict';

const SUPPORTED_SKETCH_VERSIONS = ['3.7.2'];
const LATEST_SKETCH_VERSION = '3.7.2';

const assert = require('assert');
const childProc = require('child_process');
const File = require('vinyl');
const fixtureStream = require('from2-array').obj;
const fs = require('fs');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const Path = require('path');
const vfs = require('vinyl-fs');

const sketchbook = require('./sketchbook');
const cliPath = Path.join(__dirname, 'sketchbook.cli.js');

lab.experiment('getAssets', () => {
  SUPPORTED_SKETCH_VERSIONS.forEach((version) => {
    lab.experiment('Sketch ' + version, () => {
      const fixturePath = Path.join(process.cwd(), 'test_fixtures', 'sketch', version + '.sketch');
      var fixtures = {};

      lab.before((done) => {
        vfs.src(fixturePath)
          .pipe(sketchbook.getAssets())
          .on('data', (file) => {
            const filename = file.path.replace(file.base, '').replace(Path.extname(file.path), '');
            fixtures[filename] = file;
          })
          .on('finish', done);
      });

      lab.test('exports artboards as SVG files', (done) => {
        if (version !== LATEST_SKETCH_VERSION) done(); // only test this for latest (installed) version
        vfs.src(fixturePath)
          .pipe(sketchbook.getAssets())
          .on('data', (file) => assert(Path.extname(file.path) === '.svg'))
          .on('finish', done);
      });

      lab.test('parses color values from an exported artboard', (done) => {
        const specs = sketchbook.getSpecs(fixtures['Palette']);
        assert(specs.colors.length === 6);
        assert(specs.colors[0].hex === '#2069B4');
        assert(specs.colors[0].name === 'blue400');
        done();
      });

      lab.test('parses text styles from an exported artboard', (done) => {
        let specs = sketchbook.getSpecs(fixtures['Text Styles']);

        assert(specs.textStyles.length === 6);

        assert(specs.textStyles[0].props.fontWeight === 'normal');
        assert(specs.textStyles[0].props.fontSize === '64');
        assert(specs.textStyles[0].props.lineHeight === 1.5);
        assert(specs.textStyles[0].props.fontFamily === 'Helvetica Neue');

        specs = sketchbook.getSpecs(fixtures['Text Styles / Mixed']);

        assert(specs.textStyles.length === 6);

        assert(specs.textStyles[0].props.fontWeight === '300');
        assert(specs.textStyles[0].props.fontSize === '64');
        assert(specs.textStyles[0].props.lineHeight === 1.5);
        assert(specs.textStyles[0].props.fontFamily === 'Helvetica Neue');

        assert(specs.textStyles[5].props.fontWeight === 'normal');
        assert(specs.textStyles[5].props.fontSize === '14');
        assert(specs.textStyles[5].props.lineHeight === 1.5);
        assert(specs.textStyles[5].props.fontFamily === 'Georgia');

        done();
      });

      lab.test('serializes parsed text styles to a string', (done) => {
        let specs = sketchbook.getSpecs(fixtures['Text Styles']);

        assert(specs.textStyles[0].inlineStyles === 'font-family: "Helvetica Neue"; font-weight: normal; font-size: 64px; line-height: 1.5;');
        assert(specs.textStyles[0].styles === 'font-family: "Helvetica Neue";\nfont-weight: normal;\nfont-size: 64px;\nline-height: 1.5;');

        specs = sketchbook.getSpecs(fixtures['Text Styles / Mixed']);

        assert(specs.textStyles[0].inlineStyles === 'font-family: "Helvetica Neue"; font-weight: 300; font-size: 64px; line-height: 1.5;');
        assert(specs.textStyles[5].inlineStyles === 'font-family: "Georgia"; font-weight: normal; font-size: 14px; line-height: 1.5;');

        done();
      });

      lab.test('creates a parameterized class name for each parsed text style', (done) => {
        let specs = sketchbook.getSpecs(fixtures['Text Styles']);
        assert(specs.textStyles[0].className === 'h1');
        assert(specs.textStyles[1].className === 'h2');
        done();
      });
    });
  });
});

lab.experiment('getHeadings', (done) => {
  lab.test('extracts headings from a Markdown document into an array of structured data', (done) => {
    const headings = sketchbook.getHeadings('# Hello\nWorld\n## Hello Again\nWorld');
    assert(headings.length === 2);
    assert(headings[1].text === 'Hello Again');
    assert(headings[1].tag === 'h2');
    assert(headings[1].anchor === 'hello-again');
    done();
  });
});

lab.experiment('getImages', () => {
  lab.test('filters files to supported image formats', (done) => {
    fixtureStream([new File({ path: 'example.jpg' }), new File({ path: 'example.pdf' })])
      .pipe(sketchbook.getImages())
      .on('data', (file) => assert(Path.extname(file.path) === '.jpg'))
      .on('finish', done);
  });
});

lab.experiment('rebasePath', () => {
  lab.test('rebase output path on specified patterns', (done) => {
    fixtureStream([new File({ path: 'examples/example.jpg' }), new File({ path: 'examples/nested/example.pdf' })])
      .pipe(sketchbook.rebase(['examples/**']))
      .on('data', (file) => assert(!file.path.match('examples/')))
      .on('finish', done);
  });
});

lab.experiment('renderPages', () => {
  lab.test('parses markdown and outputs a HTML file', (done) => {
    fixtureStream([new File({ path: 'example.md', contents: new Buffer('# Hello') })])
      .pipe(sketchbook.renderPages())
      .on('data', (file) => {
        assert(file.contents.toString().match('<h1 id="hello">Hello</h1>'));
        assert(Path.extname(file.path) === '.html');
      })
      .on('finish', done);
  });

  lab.test('accepts a custom Handlebars template', (done) => {
    fixtureStream([new File({ path: '/example.md', contents: new Buffer('# Hello') })])
      .pipe(sketchbook.renderPages('layout.hbs'))
      .on('data', (file) => {
        assert(file.contents.toString().match('<h1 id="hello">Hello</h1>'));
        assert(Path.extname(file.path) === '.html');
      })
      .on('finish', done);
  });

  lab.test('renders parsed specs with built-in templates', (done) => {
    fixtureStream([
      new File({ path: 'Example Styles.svg', contents: fs.readFileSync(Path.join(process.cwd(), 'test_fixtures', 'example_styles.svg')) }),
      new File({ path: 'Example Colors.svg', contents: fs.readFileSync(Path.join(process.cwd(), 'test_fixtures', 'example_colors.svg')) }),
      new File({ path: 'example.md', contents: new Buffer('{{ colors: Example Colors }}\n{{ styles: Example Styles }}') })
    ])
    .pipe(sketchbook.renderPages())
    .on('data', (file) => {
      const output = file.contents.toString();
      assert(output.match('<code style="background-color: #2069B4" class="colors__swatch">#2069B4</code>'));
      assert(output.match('<h4 class="styles__name" style="font-family: &quot;Helvetica Neue&quot;; font-weight: normal; font-size: 64px; line-height: 1.5;">h1</h4>'));
    })
    .on('finish', done);
  });

  lab.test('renders specified Markdown inline (partials)', (done) => {
    fixtureStream([
      new File({ path: 'header1.md', contents: new Buffer('# Hello') }),
      new File({ path: 'header2.md', contents: new Buffer('## Hello 2') }),
      new File({ path: 'header3.md', contents: new Buffer('### Hello 3') }),
      new File({ path: 'partials/nested-header.md', contents: new Buffer('# Nested Hello') }),
      new File({ path: 'example.md', contents: new Buffer('{{> header1}} {{> header2 }} {{ > header3 }} {{> partials/nested-header }} {{> 404}}') })
    ])
    .pipe(sketchbook.renderPages())
    .on('data', (file) => {
      if (file.path.match('example')) {
        const output = file.contents.toString();
        assert(output.match('<h1 id="hello">Hello</h1>'));
        assert(output.match('<h2 id="hello-2">Hello 2</h2>'));
        assert(output.match('<h3 id="hello-3">Hello 3</h3>'));
        assert(output.match('<h1 id="nested-hello">Nested Hello</h1>'));
        assert(output.match("Partial '404' not found"));
      }
    })
    .on('finish', done);
  });
});

lab.experiment('CLI', () => {
  lab.test('is helpful', (done) => {
    const child = childProc.spawn(cliPath, ['--help']);

    child.stdout
      .on('data', (output) => {
        assert(output.toString().match('Usage'));
        done();
      });
  });

  lab.test('requires at least one path', (done) => {
    childProc
      .spawn(cliPath)
      .on('close', (code) => assert(code === 1))
      .on('exit', () => done());
  });

  lab.test('accepts one or more file patterns', (done) => {
    childProc
      .spawn(cliPath, ['example.sketch', 'example/**/*'])
      .on('close', (code) => assert(code === 0))
      .on('exit', () => done());
  });

  lab.test('rejects invalid paths to a custom template', (done) => {
    childProc
      .spawn(cliPath, ['example/**/*', '--template example.hbs'])
      .on('close', (code) => assert(code === 0))
      .on('exit', () => done());
  });
});
