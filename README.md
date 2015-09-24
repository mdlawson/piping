# Piping

There are already node "wrappers" that handle watching for file changes and restarting your application (such as [node-supervisor](https://github.com/isaacs/node-supervisor)), as well as reloading on crash, but I wasn't fond of having that.
Piping adds "hot reloading" functionality to node, watching all your project files and reloading when anything changes, without requiring a "wrapper" binary.

Piping uses the currently unstable "cluster" API to spawn your application in a thread and then kill/reload it when necessary. Because of this, piping should be considered unstable and should not be used in production (why would you ever need live code reloading in production anyway). Currently, at least on windows, the cluster API seems stable enough for development.

Also check out [piping-browser](http://github.com/mdlawson/piping-browser) which does a similar job for the browser using browserify

## Installation
```
npm install piping
```
## Usage

Piping is not a binary, so you can continue using your current workflow for running your application ("wooo!"). Basic usage is as follows:
```javascript
if (require("piping")()) {
  // application logic here
  express = require("express");
  app = express();
  app.listen(3000);
}
```
or in coffeescript:
```coffee
if require("piping")()
  # application logic here
  express = require "express"
  app = express()
  app.listen 3000
```
This if condition is necessary because your file will be invoked twice, but should only actually do anything the second time, when it is spawned as a separate node process, supervised by piping. Piping returns true when its good to go.

the function returned by piping also accepts an options object. The following options are supported:
- __main__ _(path)_: The path to the "top" file of your application. Defaults to `require.main.filename`, which should be sufficient provided you launch your application via "node yourapp.js". Other launch methods may require this to be set manually. If your app doesn't reload/reloads when it shouldn't, try changing this.
- __hook__ _(true/false)_: Whether to hook into node's "require" function and only watch required files. Defaults to false, which means piping will watch all the files in the folder in which main resides. The require hook can only detect files required after invoking this module!
- __includeModules__ _(true/false)_: Whether to include required files than reside in node_modules folders. Defaults to false. Only has an effect when hook is true. For ignoring node_modules when hook is false, please use ignore.
- __ignore__ _(regex)_: Files/paths matching this regex will not be watched. Defaults to `/(\/\.|~$)/`
- __language__ _(string)_: The name of a module that will be required before your main is invoked. This allows for "coffee-script" to be specified to support a coffeescript main, launchable though "coffee". Probably works for other languages as well. Coffeescripters don't actually need this, as coffee-script is required automatically if main is a .coffee file.
- __usePolling__ _(true/false)_ : From chokidar. Default false. Whether to use fs.watchFile (backed by polling), or fs.watch. It is typically necessary to set this to true to successfully watch files over a network.
- __interval__ _(true/false)_ : From chokidar. Polling specific. Interval of file system polling (default 100).
- __binaryInterval__ _(true/false)_ : From chokidar. Polling specific. Interval of file system polling for binary files.
- __respawnOnExit__ _(true/false)_ : Default true. Whether the application should respawn after exiting. If you experience problems with infinite loops, try setting this to false.

Example:
```javascript
if (require("piping")({main:"./app/server.js",hook:true})){
  // app logic
}
```
Piping can also be used just by passing a string. In this case, the string is taken to be the "main" option:
```javascript
if (require("piping")("./app/server.js")){
  // app logic
}
```
One negative of all the examples above is the extra indent added to your code. To avoid this, you can choose to return when piping is false:

```javascript
if (!require("piping")()) { return; }
// application logic here
```
or in coffeescript:
```coffee
if not require("piping")() then return
# application logic here
```
