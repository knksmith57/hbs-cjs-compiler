'use strict'

const async = require('async')
const debug = require('debug')('hbs-cjs-precompiler')
const fs = require('fs')
const glob = require('glob')
const handlebars = require('handlebars')
const minify = require('uglify-js').minify
const path = require('path')
const procs = require('os').cpus().length
const resolveBin = require('resolve-bin')
const spawn = require('child_process').spawn
const sprintf = require('util').format
const strToModule = require('require-from-string')

const spawnCommand = resolveBin.sync('handlebars')

/** @type {asScript} */
module.exports.asScript = asScript

/** @type {asModule} */
module.exports.asModule = asModule

const moduleTemplateFn = handlebars.compile(
  fs.readFileSync(path.resolve(__dirname, 'moduleTemplate.hbs')).toString()
)

/**
 * Compiles a directory of handlebars templates and returns a CommonJS
 * module capable of rendering them.
 *
 * @param {String} templateDir path to template directory
 * @param {Object=} options compile options
 *
 * @returns {Promise}
 */
function asModule (templateDir, options) {
  return new Promise((resolve, reject) => {
    asScript(templateDir, options)
      .catch(reject)
      .then((moduleStr) => {
        resolve(strToModule(moduleStr))
      })
  })
}

/**
 * Compiles a directory of handlebars templates and generates a CommonJS
 * module script capable of rendering them.
 *
 * @param {String} templateDir path to template directory
 * @param {Object=} options compile options
 *
 * @returns {Promise}
 */
function asScript (templateDir, options) {
  var terminating = false
  var workerFns = []
  var workers = {}

  var helpers = options.helpers || []
  var namespace = options.namespace ? options.namespace + '/' : ''

  // handle killing child processes gracefully
  process.on('SIGTERM', onTerminate)
  process.on('SIGINT', onTerminate)

  templateDir = path.resolve(process.cwd(), templateDir)
  var fileGlob = path.resolve(templateDir, '**/*.hbs')

  return new Promise((resolve, reject) => {
    glob(fileGlob, {baseDir: templateDir, follow: true}, (err, templates) => {
      if (err) {
        debug('error globbing for templates')
        return reject(new Error(err))
      }

      debug('found %d templates: %s', templates.length, JSON.stringify(templates, null, 2))

      workerFns = templates.map((template) => {
        return createWorker.bind(null, template)
      })

      debug('compiling %d templates using a max of %d processes', templates.length, procs)

      async.parallelLimit(workerFns, procs, (workerErr, results) => {
        if (workerErr) {
          return reject(new Error(workerErr))
        }

        resolve(moduleTemplateFn({templateFns: results}))
      })
    })
  })

  /**
   * Spawns a worker to compile handlebars template specified by `partial`.
   *
   * @param {String} partial path to partial
   * @param {Function} cb callback function
   *
   * @returns {void}
   */
  function createWorker (partial, cb) {
    var bufs = []
    var handlebarsArgs = []
    var output

    if (terminating) {
      return cb(new Error('process terminating'))
    }

    var partialName = partialPathToName(partial)

    debug('precompiling %s', partialName)

    handlebarsArgs.push('--simple')

    // add arguments for all specified-known helpers
    helpers.forEach((helper) => {
      handlebarsArgs.push('--known', helper)
    })

    var worker = spawn(spawnCommand, handlebarsArgs.concat(partial))

    workers[worker.pid] = worker

    worker.stdout.on('data', bufs.push.bind(bufs))
    worker.stdout.on('end', () => {
      output = {
        fn: minify(sprintf(
          'Handlebars.template(%s);',
          Buffer.concat(bufs).toString()
        ), {fromString: true}).code,
        name: partialName
      }
    })
    worker.stderr.pipe(process.stderr)

    worker.on('close', (code) => {
      delete workers[worker.pid]

      if (code !== 0) {
        return cb(new Error('failed to precompile ' + partialName))
      }

      cb(null, output)
    })
  }

  /**
   * Generates partial name from the specified partial path.
   *
   * @param {String} partial path to partial
   * @returns {String}
   */
  function partialPathToName (partial) {
    // via http://stackoverflow.com/a/4250408
    return namespace + path.relative(templateDir, String(partial)).replace(/\.[^/.]+$/, '')
  }

  /**
   * Terminates all active workers.
   * @returns {void}
   */
  function onTerminate () {
    if (terminating) {
      return
    }

    terminating = true

    // kill all workers
    var workerPids = Object.keys(workers)
    if (workerPids) {
      workerPids.forEach((pid) => {
        console.error('sending kill signal to worker %s', pid)
        workers[pid].kill()
      })
    }
  }
}
