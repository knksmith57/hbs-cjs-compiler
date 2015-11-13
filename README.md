Handlebars CommonJS Compiler
============================

> Super fast handlebars compiler for building node.js-friendly CommonJS modules.

```
$ npm install hbs-cjs-compiler
```

## Usage Examples
The compiler can be used as both a CLI tool and a module.

### CLI
```
## install the package globally to take advantage of the CLI
$ npm install --global hbs-cjs-compiler

## compile a directory of templates and save to a file called "templates-module.js"
$ hbs-cjs-compiler path/to/myTemplates -f myTemplates.js
```

### API
```
## install the package into your project
$ npm install --save hbs-cjs-compiler
```

```
const compiler = require('hbs-cjs-compiler');

// compile templates and write module script to myModule.js
compiler.asScript('path/to/myTemplates').then(script => fs.writeFileSync('myTemplates.js', script));

// generate render module from templates and render 'someTemplate'
compiler.asModule('path/to/myTemplates').then((renderFn) => {
  renderFn('someTemplate'); // ==> renders path/to/myTemplates/someTemplate.hbs
});
```

## Render Module Usage
The CommonJS module produced by the compiler exposes a simple render method and the associated `HandlebarsEnvironment`.

```
const myTemplates = require('./myTemplates');

// render 'someTemplate'
var renderedHtml = myTemplates('someTemplate');


// register a helper called 'echoHelloWorld' used in the compiled templates
myTemplates.handlebars.registerHelper({
    echoHelloWorld: function() { return 'Hello World'; }
});
```
