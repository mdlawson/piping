var path = require("path");
var test = require("ava");
var helpers = require("./helpers");

test.cb("Test that require calls are hooked sucessfully and trigger reloads", function(t) {
  t.plan(3);
  helpers.piping(function(reloader) {
    reloader.on("started", function() {
      t.pass();
    });
    reloader.on("watch", function(file) {
      t.is(path.relative(__dirname, file), "helpers/dummy.js");
      helpers.trigger();
    });
    reloader.on("reloaded", function(status) {
      t.is(status.exitReason, "requested");
      t.end();
      reloader.stop();
    });
  });
});

helpers.child({hook: true}, function() {
  var dummy = require("./helpers/dummy");
  setInterval(function() {}, 200);
})