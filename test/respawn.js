var cluster = require("cluster");
var test = require("ava");
var helpers = require("./helpers");

test.cb("Test that processes can be respawned automatically on exit", function(t) {
  t.plan(3);
  helpers.piping({respawnOnExit: true}, function(reloader) {
    reloader.on("started", function() {
      t.pass();
    });
    reloader.on("exited", function(status) {
      t.is(status.exitReason, "exited");
    });
    reloader.on("reloaded", function(status) {
      t.is(status.exitReason, "exited");
      t.end();
      reloader.stop();
    });
  });
});

helpers.child(function() {
  process.exit(0)
})

