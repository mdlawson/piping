import * as path from "path";
import * as colors from "colors";
import { assign, isString, isNull, isFunction, isBoolean, values } from "lodash";
import { watch } from "chokidar";

const EventEmitter = require("events");
const cluster = require("cluster");
const defaultOptions = {
  hook: false,
  includeModules: false,
  main: process.argv[1],
  args: process.argv.slice(2),
  ignore: /(\/\.|~\$)/,
  respawnOnExit: false,
  throw: true,
  quiet: false
};

const emitter = new EventEmitter();

/**
 * Function called on supervisor process to watch files and handle reloads
 */
function monitor(options, ready) {
  const root = options.hook ? options.main : path.dirname(options.main);

  const watcher = watch(root, {
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

  const fork = cluster.fork.bind(cluster, options.env);

  let main = null;
  let kill = null;
  const status = {
    exiting: false,
    exited: false,
    firstRun: true,
    exitReason: null,
    fileChanged: null,
  };

  // Handle unrequested exits
  cluster.on("exit", function(worker, code, signal) {
    if (!status.exited) {
      status.exitReason = code == 0 ? "exited" : "errored";
      emitter.emit("exited", status);
      if (options.respawnOnExit) fork();
    }
  });

  // Application started
  cluster.on("online", function(worker) {
    status.exiting = false;
    status.exiting = false;
    main = worker;

    if (status.firstRun) {
      emitter.emit("started", status);
      status.firstRun = false;
    } else {
      worker.send({status});
      emitter.emit("reloaded", status);
    }


    worker.on("message", function(worker, message, handle) {
      if (arguments.length === 2) {
        handle = message;
        message = worker;
        worker = undefined;
      }
      if (message.file) { // Handle messages about new files to watch
        watcher.add(message.file);
        emitter.emit("watch", message.file);
      }
      if (message.exiting) { // Handle messages acknowledging reloads
        emitter.emit("waiting", status);
        clearTimeout(kill);
      }
    });
  });

  // Handle file changes
  watcher.on("change", function(file) {
    if (!main) return; // No process is running yet, nothing to do.
    const filename = path.relative(process.cwd(), file);
    options.quiet || console.log("[piping]".bold.red, "File", filename, "has changed, reloading.");

    if (!main.isConnected()) return fork(); // Old process is dead, just start new one

    // Schedule a kill if graceful reload fails
    kill = setTimeout(function() {
      status.exitReason = "killed";
      main.disconnect();
      main.process.kill();
    }, 1000);

    status.exiting = true;
    status.exitReason = "requested";
    status.fileChanged = file;
    emitter.emit("reloading", status);
    main.send({status}); // Tell the process to exit
    main.once("disconnect", function() { // Handle graceful exit by restarting
      clearTimeout(kill);
      if (status.exiting) {
        status.exiting = false;
        status.exited = true;
        fork();
      }
    });
  });

  emitter.stop = function() {
    main.process.kill();
  }

  ready && ready(emitter);
  fork();
}

export default function piping(options, ready) {
  if (isFunction(options)) {
    ready = options;
    options = null;
  }
  if (isString(options)) {
    options = assign(defaultOptions, { main: options });
  } else {
    options = assign(defaultOptions, options);
  }
  options.main = path.resolve(options.main);

  // First run, need to start monitor
  if (cluster.isMaster) {
    if (options.throw) {
      // Avoid exicuting rest of file by use of an exception we then handle with
      // the node uncaughtException handler. Will not work inside a try/catch block.
      const uncaught = "uncaughtException";
      const listeners = process.listeners(uncaught);
      process.removeAllListeners(uncaught); // Clean up all existing listeners temporarily
      process.on(uncaught, function() {
        listeners.forEach(function(listener) { // Re-add old listeners
          process.on(uncaught, listener)
        });
        monitor(options, ready); // Good to go, no more stack
      });
      throw new Error();
    }
    // Otherwise we just return false, caller is responsible for not running application code
    monitor(options, ready);
    return false;
  }

  // At this point, we are the supervised application process on the second run
  const worker = cluster.worker;
  const kill = worker.kill.bind(worker);

  // Exit this process, potentially informing the supervisor we are handling it
  function exit() {
    if (emitter.emit("reload", kill)) {
      worker.send({exiting: true});
    } else {
      setTimeout(kill, 500)
    }
  }

  worker.on("message", function({status}) {
    if (status) {
      if (status.exiting) exit(); // Message is telling us to exit
      else emitter.emit("reloaded", status); // Otherwise, we have just reloaded
    }
  });

  if (options.hook) {
    // Patch module loading
    const module = require("module");

    const load = module._load;

    module._load = function(name, parent, isMain) {
      const file = module._resolveFilename(name, parent, isMain);

      // Ignore module files unless includeModules is set
      if (name[0] === "." || (options.includeModules && file.indexOf("node_modules") > 0)) {
        worker.send({file}); // Tell supervisor about the file
      }

      return load(name, parent, isMain);
    }
  }


  return emitter;
}

module.exports = piping;