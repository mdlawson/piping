cluster = require "cluster"
path = require "path"
colors = require "colors"

options =
    hook: false
    includeModules: false
    main: require.main.filename
    ignore: /(\/\.|~$)/
    respawnOnExit: true

module.exports = (ops) ->
  if typeof ops is "string" or ops instanceof String
    options.main = path.resolve ops
  else
    options[key] = value for key,value of ops

  if cluster.isMaster
    cluster.setupMaster
      exec: path.join(path.dirname(module.filename),"launcher.js")

    chokidar = require "chokidar"

    # Workaround for https://github.com/paulmillr/chokidar/issues/237
    fixChokidar = (file) ->
      file.slice(0, -1) + "["+file.slice(-1)+"]"

    initial = if options.hook then fixChokidar options.main else path.dirname options.main

    watcher = chokidar.watch initial,
      ignored: options.ignore
      ignoreInitial: true
      usePolling: options.usePolling
      interval: options.interval || 100
      binaryInterval: options.binaryInterval || 300

    cluster.fork()
    respawnPending = false
    lastErr = ""


    cluster.on "exit", (dead,code,signal) ->
      hasWorkers = false
      for id, worker of cluster.workers
        hasWorkers = true

      if !hasWorkers && (respawnPending || options.respawnOnExit)
        cluster.fork()
        respawnPending = false


    cluster.on "online", (worker) ->
      worker.send options
      worker.on "message", (message) ->
        if message.err && (!options.respawnOnExit || message.err isnt lastErr)
          console.log "[piping]".bold.red,"can't execute file:",options.main
          console.log "[piping]".bold.red,"error given was:",message.err
          if options.respawnOnExit
            lastErr = message.err
            console.log "[piping]".bold.red,"further repeats of this error will be suppressed..."
        else if message.file
          if options.usePolling
            watcher.add message.file
          else
            watcher.add (fixChokidar message.file)


    watcher.on "change", (file) ->
      console.log "[piping]".bold.red,"File",path.relative(process.cwd(),file),"has changed, reloading."

      # if a worker is already running, kill it and let the exit handler respawn it
      for id, worker of cluster.workers
        respawnPending = true
        process.kill(worker.process.pid, 'SIGTERM') # worker.kill() doesn't send SIGTERM

      # if a worker died somehow, respawn it right away
      unless respawnPending
        cluster.fork()

    return false
  else
    return true
