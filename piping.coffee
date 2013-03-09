cluster = require "cluster"
path = require "path"
natives = ['assert','buffer','child_process','cluster','console','constants','crypto','dgram','dns','domain','events','freelist','fs','http','https','module','net','os','path','punycode','querystring','readline','repl','stream','string_decoder','sys','timers','tls','tty','url','util','vm','zlib']

options =
    hook: false
    includeModules: false
    main: require.main.filename
    ignore: /(\/\.|~$)/ 
module.exports = (ops) ->
  if typeof ops is "string" or ops instanceof String
    options.main = path.resolve ops
  else
    for key,value of ops
      options[key] = value if key isnt main else path.resolve value

  if cluster.isMaster
    cluster.setupMaster
      exec: options.main
      args: process.argv

    chokidar = require "chokidar"

    currentFile = options.main
    currentPath = path.dirname currentFile

    initial = if options.hook then currentFile else currentPath 
    
    watcher = chokidar.watch initial,
      ignored: options.ignore
      ignoreInitial: true
    
    worker = cluster.fork()
    
    messageHandler = (message) -> watcher.add message.file
    
    worker.on "message",messageHandler
    
    cluster.on "exit", (dead,code,signal) ->
      worker = cluster.fork()
      worker.on "message",messageHandler
    
    watcher.on "change", (file) ->
      console.log "[piping] File",path.relative(currentPath,file),"has changed, reloading."
      worker.destroy()
    
    return false
  else
    if options.hook
      module = require "module"
      _load_orig = module._load
      
      module._load = (name,parent,isMain) ->
        file = module._resolveFilename name,parent

        if options.includeModules or file.indexOf("node_modules") is -1
          unless file in natives
            cluster.worker.send file:file

        _load_orig name,parent,isMain

    return true
