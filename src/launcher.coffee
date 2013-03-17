cluster = require "cluster"
path = require "path"
natives = ['assert','buffer','child_process','cluster','console','constants','crypto','dgram','dns','domain','events','freelist','fs','http','https','module','net','os','path','punycode','querystring','readline','repl','stream','string_decoder','sys','timers','tls','tty','url','util','vm','zlib']
languages =
  ".coffee":"coffee-script"

cluster.worker.on "message", (options) ->
  main = path.resolve process.cwd(), options.main
  if options.hook
    module = require "module"
    _load_orig = module._load
    
    module._load = (name,parent,isMain) ->
      file = module._resolveFilename name,parent

      if options.includeModules or file.indexOf("node_modules") is -1
        unless file in natives or file is main
          cluster.worker.send file:file

      _load_orig name,parent,isMain
  ext = path.extname options.main
  if languages[ext] then require languages[ext] 
  if options.language then require options.language
  try
    require main    
  catch e
    cluster.worker.send err: e.stack
    cluster.worker.destroy()

