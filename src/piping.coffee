cluster = require "cluster"
path = require "path"
colors = require "colors"

options =
    hook: false
    includeModules: false
    main: require.main.filename
    ignore: /(\/\.|~$)/

module.exports = (ops) ->
  if typeof ops is "string" or ops instanceof String
    options.main = path.resolve ops
  else
    options[key] = value for key,value of ops

  if cluster.isMaster
    cluster.setupMaster
      exec: path.join(path.dirname(module.filename),"launcher.js")

    chokidar = require "chokidar"

    initial = if options.hook then options.main else path.dirname options.main

    watcher = chokidar.watch initial,
      ignored: options.ignore
      ignoreInitial: true
      usePolling: options.usePolling
      interval: options.interval || 100
      binaryInterval: options.binaryInterval || 300

    worker = cluster.fork()

    cluster.on "exit", (dead,code,signal) ->
      if worker is null
        # worker was killed due to a file change - respawn
        worker = cluster.fork()
      else
        # worker died by itself - wait for file change
        worker = null

    cluster.on "online", (worker) ->
      worker.send options
      worker.on "message", (message) ->
        if message.err
          console.log "[piping]".bold.red,"can't execute file:",options.main
          console.log "[piping]".bold.red,"error given was:",message.err
        else if message.file
          watcher.add message.file


    watcher.on "change", (file) ->
      console.log "[piping]".bold.red,"File",path.relative(process.cwd(),file),"has changed, reloading."
      if (worker)
        # if a worker is already running, kill it and let the exit handler respawn it
        worker.kill()
        worker = null
      else
        # if a worker died somehow, respawn it right away
        worker = cluster.fork()

    return false
  else
    return true
