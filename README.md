# Piping
Piping adds "hot reloading" functionality to node, watching all your project files and reloading when anything changes. 

Piping uses the currently unstable "cluster" API to spawn your application in a thread and then kill/reload it when necessary. Because of this, piping should be considered unstable and should not be used in production (why would you ever need live code reloading in production anyway). Currently, at least on windows, the cluster API seems stable enough for development.

## Usage

Piping is not a binary, so you can continue using your current workflow for running your application ("wooo!"). Basic usage is as follows:

    if require("piping")()
      # application logic here
      express = require "express"
      app = express()
      app.listen 3000

or in plain JS

    if (require("piping")()) {
      // application logic here
      express = require("express");
      app = express();
      app.listen(3000);
    }

This if condition is necessary because your file will be invoked twice, but should only actually do anything the second time, when it is spawned as a separate node process, supervised by piping. Piping returns true when its good to go. 

the function returned by piping also accepts an options object. The following options are supported:
- __main__ _(path)_: The path to the "top" file of your application. Defaults to `require.main.filename`, which should be sufficient provided you launch your application via "node yourapp.js". Other launch methods may require this to be set manually. If your app doesn't reload/reloads when it shouldn't, try changing this. 
- __hook__ _(true/false)_: Whether to hook into node's "require" function and only watch required files. Defaults to false, which means piping will watch all the files in the folder in which main resides. The require hook can only detect files required after invoking this module!
- __includeModules__ _(true/false)_: Whether to include required files than reside in node_modules folders. Only has an effect when hook is true. For ignoring node_modules when hook is false, please use ignore.
- __ignore__ _(regex)_: Files/paths matching this regex will not be watched. Defaults to `/(\/\.|~$)/` 

