# sketch-book

An opinionated workflow and CLI tool for generating design documentation from typical files/artifacts of the design process and serving it up as a website. It has been designed to minimize friction between design and development through automation with these carefully chosen features:

 - Export crisp and measurable SVGs from [Sketch][sketch]
 
 - Parse color, typography, and other specs from Sketch artboards

 - Gather reference images

 - Generate a static site from [Markdown][commonmark] files with access to all of the above
 
 - Deploy to [GitHub Pages](#pages) or anywhere


Usage 
-----

sketch-book [requires node.js][node] to run. [Install it with npm][npm] which hopefully is already in use for development in your project. Once installed, these commands are available:

    $ sketchbook --help

      Usage
        $ sketchbook <file|directory|glob>... [-o output path]
        
      Any mix of Sketch, image, and Markdown files are accepted as input.
      Supported globs: https://git.io/vrluA

      Options
        -o, --output  Path to write rendered pages and prepped assets to
        -t, --template  Path to a custom Handlebars layout template

Input
-----

#### Markdown

Each Markdown file is rendered to a like-named HTML file. The hierarchy of any directories is also preserved.

[markdown-it][markdown-it] parses your content following the [CommonMark][commonmark] spec and these plugins:

 - [markdown-it-anchor][markdown-it-anchor] adds anchors to each heading for linking
 - [markdown-it-deflist][markdown-it-deflist] adds support for [definition lists][deflist]
 - [markdown-it-header-sections][markdown-it-header-sections] wraps content after headings in a `<section>` for styling
 - [markdown-it-implicit-figures][markdown-it-implicit-figures] wraps standalone images and alt text in a `<figure>`
 - [markdown-it-linkify-images][markdown-it-linkify-images] automatically links images to simplify enlarging and sharing

You can also embed other pages like this:

    {{> example_folder/markdown_file}}

#### Sketch Files

In addition to being a source for visual examples, your Sketch files themselves can also be parsed for color and text style specs. Make any artboards that contain examples of these exportable to SVG. Name layers containing examples as they should appear in your documentation. Parsed specs are available to render within pages using built-in templates, specified like this:

    {{ colors: Example Artboard }}
    {{ styles: Example Artboard }}

[Browse built-in templates](boilerplate)

#### Images

 - SVG
 - PNG
 - JPEG
 - GIF

Images are copied to your output path as assets for your static site. Be sure to size them appropriately for display on the web.


Recommendations 
---------------

What your documentation consists of exactly is up to you! And your team, and your process. But plenty of previously published projects should help provide some precedent and ideas to get started.

 - [iOS Human Interface Guidelines][apple-hig]
 - [Google Material Design Guidelines][goog]
 - [IBM Design Language][ibm]
 - [Styleguides][styleguides]
 - [Wikipedia: Human Interface Guidelines][hig]

#### GitHub

Strongly consider applying the [GitHub Flow][github-flow] to design, this will help you collaborate with developers on your team and perhaps approach design more methodically. With [Git LFS][lfs] you can even commit your Sketch files! 

Install [git-sketch-plugin][git-sketch-plugin] to get visual diffs and Git commands right in Sketch.

[Learn how Shyp is doing this][shyp]

#### Sketch

Symbols were [made for this!][sketch-symbols] Consider maintaining a library of reusable components with which you can compose documentation examples showing them in isolation, in pairs, and brought together into full mockups.


----
[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat-square)](https://github.com/Flet/semistandard)

**[MIT](LICENSE) LICENSE**  
copyright &copy; 2016 sparkart group, inc.


[sketch]: http://www.sketchapp.com/
[npm]: https://www.npmjs.com/package/sketch-book/tutorial
[node]: https://nodejs.org

[commonmark]: http://commonmark.org/
[markdown-it]: https://github.com/markdown-it/markdown-it
[markdown-it-anchor]: https://www.npmjs.com/package/markdown-it-anchor
[markdown-it-deflist]: https://www.npmjs.com/package/markdown-it-deflist
[markdown-it-header-sections]: https://www.npmjs.com/package/markdown-it-header-sections
[markdown-it-implicit-figures]: https://www.npmjs.com/package/markdown-it-implicit-figures
[markdown-it-linkify-images]: https://www.npmjs.com/package/markdown-it-linkify-images
[deflist]: http://pandoc.org/README.html#definition-lists

[hig]: https://en.wikipedia.org/wiki/Human_interface_guidelines
[apple-hig]: https://developer.apple.com/go/?id=ios-hig
[goog]: https://www.google.com/design/spec/material-design
[ibm]: https://www.ibm.com/design/language/framework
[styleguides]: http://styleguides.io

[lfs]: https://git-lfs.github.com/
[github-pages]: https://pages.github.com/
[github-flow]: https://guides.github.com/introduction/flow/
[git-sketch-plugin]: https://github.com/mathieudutour/git-sketch-plugin
[shyp]: https://medium.com/shyp-design/managing-style-guides-at-shyp-c217116c8126
[sketch-symbols]: https://blog.sketchapp.com/sketch-3-7-and-new-symbols-d833a5be4027#.afj5gbsft
