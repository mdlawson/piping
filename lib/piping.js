"use strict";

exports.__esModule = true;
exports.default = piping;

var _path = require("path");

var path = _interopRequireWildcard(_path);

var _colors = require("colors");

var colors = _interopRequireWildcard(_colors);

var _lodash = require("lodash");

var _chokidar = require("chokidar");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var EventEmitter = require("events");
var cluster = require("cluster");
var defaultOptions = {
  hook: false,
  includeModules: false,
  main: process.argv[1],
  args: process.argv.slice(2),
  ignore: /(\/\.|~\$)/,
  respawnOnExit: false,
  throw: true,
  quiet: false
};

var emitter = new EventEmitter();

/**
 * Function called on supervisor process to watch files and handle reloads
 */
function monitor(options, ready) {
  var root = options.hook ? options.main : path.dirname(options.main);

  var watcher = (0, _chokidar.watch)(root, {
    ignored: options.ignore,
    ignoreInitial: true,
    usePolling: options.usePolling,
    interval: options.interval || 100,
    binaryInterval: options.binaryInterval || 300
  });

  cluster.setupMaster({
    exec: options.main,
    args: options.args
  });

  var fork = cluster.fork.bind(cluster, options.env);

  var main = null;
  var kill = null;
  var status = {
    exiting: false,
    exited: false,
    firstRun: true,
    exitReason: null,
    fileChanged: null
  };

  // Handle unrequested exits
  cluster.on("exit", function (worker, code, signal) {
    if (!status.exited) {
      status.exitReason = code == 0 ? "exited" : "errored";
      emitter.emit("exited", status);
      if (options.respawnOnExit) fork();
    }
  });

  // Application started
  cluster.on("online", function (worker) {
    status.exiting = false;
    status.exiting = false;
    main = worker;

    if (status.firstRun) {
      emitter.emit("started", status);
      status.firstRun = false;
    } else {
      worker.send({ status: status });
      emitter.emit("reloaded", status);
    }

    worker.on("message", function (worker, message, handle) {
      if (arguments.length === 2) {
        handle = message;
        message = worker;
        worker = undefined;
      }
      if (message.file) {
        // Handle messages about new files to watch
        watcher.add(message.file);
        emitter.emit("watch", message.file);
      }
      if (message.exiting) {
        // Handle messages acknowledging reloads
        emitter.emit("waiting", status);
        clearTimeout(kill);
      }
    });
  });

  // Handle file changes
  watcher.on("change", function (file) {
    if (!main) return; // No process is running yet, nothing to do.
    var filename = path.relative(process.cwd(), file);
    options.quiet || console.log("[piping]".bold.red, "File", filename, "has changed, reloading.");

    if (!main.isConnected()) return fork(); // Old process is dead, just start new one

    // Schedule a kill if graceful reload fails
    kill = setTimeout(function () {
      status.exitReason = "killed";
      main.disconnect();
      main.process.kill();
    }, 1000);

    status.exiting = true;
    status.exitReason = "requested";
    status.fileChanged = file;
    emitter.emit("reloading", status);
    main.send({ status: status }); // Tell the process to exit
    main.once("disconnect", function () {
      // Handle graceful exit by restarting
      clearTimeout(kill);
      if (status.exiting) {
        status.exiting = false;
        status.exited = true;
        fork();
      }
    });
  });

  emitter.stop = function () {
    main.process.kill();
  };

  ready && ready(emitter);
  fork();
}

function piping(options, ready) {
  if ((0, _lodash.isFunction)(options)) {
    ready = options;
    options = null;
  }
  if ((0, _lodash.isString)(options)) {
    options = (0, _lodash.assign)(defaultOptions, { main: options });
  } else {
    options = (0, _lodash.assign)(defaultOptions, options);
  }
  options.main = path.resolve(options.main);

  // First run, need to start monitor
  if (cluster.isMaster) {
    if (options.throw) {
      (function () {
        // Avoid exicuting rest of file by use of an exception we then handle with
        // the node uncaughtException handler. Will not work inside a try/catch block.
        var uncaught = "uncaughtException";
        var listeners = process.listeners(uncaught);
        process.removeAllListeners(uncaught); // Clean up all existing listeners temporarily
        process.on(uncaught, function () {
          listeners.forEach(function (listener) {
            // Re-add old listeners
            process.on(uncaught, listener);
          });
          monitor(options, ready); // Good to go, no more stack
        });
        throw new Error();
      })();
    }
    // Otherwise we just return false, caller is responsible for not running application code
    monitor(options, ready);
    return false;
  }

  // At this point, we are the supervised application process on the second run
  var worker = cluster.worker;
  var kill = worker.kill.bind(worker);

  // Exit this process, potentially informing the supervisor we are handling it
  function exit() {
    if (emitter.emit("reload", kill)) {
      worker.send({ exiting: true });
    } else {
      setTimeout(kill, 500);
    }
  }

  worker.on("message", function (_ref) {
    var status = _ref.status;

    if (status) {
      if (status.exiting) exit(); // Message is telling us to exit
      else emitter.emit("reloaded", status); // Otherwise, we have just reloaded
    }
  });

  if (options.hook) {
    (function () {
      // Patch module loading
      var module = require("module");

      var load = module._load;

      module._load = function (name, parent, isMain) {
        var file = module._resolveFilename(name, parent, isMain);

        // Ignore module files unless includeModules is set
        if (name[0] === "." || options.includeModules && file.indexOf("node_modules") > 0) {
          worker.send({ file: file }); // Tell supervisor about the file
        }

        return load(name, parent, isMain);
      };
    })();
  }

  return emitter;
}

module.exports = piping;