# Piping

There are already node "wrappers" that handle watching for file changes and restarting your application (such as [node-supervisor](https://github.com/isaacs/node-supervisor)), as well as reloading on crash, but I wasn't fond of having that.
Piping adds "hot reloading" functionality to node, watching all your project files and reloading when anything changes, without requiring a "wrapper" binary.

Piping uses the node cluster API to spawn your application in a thread and then kill/reload it when necessary. Piping should not be used in production.

## Installation
```
npm install piping
```
## Usage

Piping is super simple to integrate and should not change the way you run your application:
```javascript
require("piping")();
// Application logic here
express = require("express");
app = express();
app.listen(3000);
```
With the default settings, this will cause a second instance of your application to be launched, which is monitored by the first. Piping then does a trick with uncaughtException handling to avoid running any of your code on the first process.

The function returned by piping also accepts an options object. The following options are supported:
- __main__ _(string)_: The path to the "top" file of your application. Defaults to `process.argv[1]`, which should be sufficient provided you launch your application via "node yourapp.js". Other launch methods may require this to be set manually. If your app doesn't reload/reloads when it shouldn't, try changing this.
- __args__ _(string[])_: Arguments to pass to your application. Defaults to the current arguments.
- __hook__ _(boolean)_: Whether to hook into node's "require" function and only watch required files. Defaults to false, which means piping will watch all the files in the folder in which main resides. The require hook can only detect files required after invoking this module!
- __includeModules__ _(boolean)_: Whether to include required files than reside in node_modules folders. Defaults to false. Only has an effect when hook is true. For ignoring node_modules when hook is false, please use ignore.
- __ignore__ _(regex)_: Files/paths matching this regex will not be watched. Defaults to `/(\/\.|~$)/`
- __respawnOnExit__ _(boolean)_ : Default false. Whether the application should respawn after exiting. If you experience problems with infinite loops, try setting this to false.
- __throw__ _(boolean)_: Use the trick with exceptions to avoid running your code in the first instance. Defaults to true. If set to false, you will need to use an if statement around the piping call to tell if your code should run. Piping returns a truthy value in this case.
- __quiet__ _(boolean)_: Suppress piping output. Defaults to false.
- __usePolling__ _(boolean)_ : From chokidar. Default false. Whether to use fs.watchFile (backed by polling), or fs.watch. It is typically necessary to set this to true to successfully watch files over a network.
- __interval__ _(integer)_ : From chokidar. Polling specific. Interval of file system polling (default 100).
- __binaryInterval__ _(integer)_ : From chokidar. Polling specific. Interval of file system polling for binary files.

Example:
```javascript
require("piping")({main: "./app/server.js", hook:true});
// App logic
```
Piping can also be used just by passing a string. In this case, the string is taken to be the "main" option:
```javascript
require("piping")("./app/server.js");
// App logic

```

## Events

Piping emits lifecycle events on both the supervisor and your application process, allowing for custom behavior. Most events provide the reloaders status, in the form:

```javascript
{
  exiting: boolean, // True if the process is about to reload
  firstRun: boolean, // True on the first run of the application
  exitReason: string? // Reason for last exit, one of "exited", "errored", "killed", "requested"
  fileChanged: string? // Name of file which changed and triggered the last reload.
}
```
* exited: The last application process exited of its own accord, with 0 error code.
* errored: The last application process exited with a non zero exit code.
* killed: The last application process has to be killed in order to reload.
* requested: The last application process reloaded cleanly as requested.

### Supervisor

You can receive lifecycle events by passing in a function as the second parameter to the piping call, or the first if you are not specifying any options.
This function will be called once everything is ready, and will be passed an EventEmitter. See the example below for supported events:

```javascript
require("piping")(function(reloader){
  reloader.on("started", function(status) {
    // called on the first run of the application.
  });
  reloader.on("watch", function(file) {
    // called when a file is added to the watch list by the require hook.
  });
  reloader.on("reloading", function(status) {
    // called when the application is about to reload.
  });
  reloader.on("waiting", function(status) {
    // called when the application has indicated it will reload.
  });
  reloader.on("reloaded", function(status) {
    // called when the application has completed a reload.
  });
  reloader.on("exited", function(status) {
    // called when the application exits unprompted.
  });
});
```

### Application

On the application process, the piping call will return an EventEmitter. See the example below for supported events:

```javascript
const reloader = require("piping")();
reloader.on("reload", function(done) {
  // called when a reload is requested by the supervisor.
  // You can use this to do any clean up required.
  // If this event is handled by your application you need to call the done function to indicate your application can be restarted now.
});
reloader.on("reloaded", function(status) {
  // called after a successful reload on the new application instance.
});
```