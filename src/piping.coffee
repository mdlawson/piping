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

    lastErr = ""    
    worker = cluster.fork()

    cluster.on "exit", (dead,code,signal) -> 
      if worker.err and worker.err isnt lastErr
        console.log "[piping]".bold.red,"can't execute file:",options.main
        console.log "[piping]".bold.red,"error given was:",worker.err
        console.log "[piping]".bold.red,"further repeats of this error will be suppressed..."
      lastErr = worker.err
      worker = cluster.fork()
    
    cluster.on "online", (worker) ->
      worker.send options
      worker.on "message", (message) -> 
        unless message.err
          watcher.add message.file
        else worker.err = message.err
    

    watcher.on "change", (file) ->
      console.log "[piping]".bold.red,"File",path.relative(process.cwd(),file),"has changed, reloading."
      worker.destroy()
    
    return false
  else
    return true
