var cluster = require("cluster");
var test = require("ava");
var helpers = require("./helpers");

test.cb("Test that unresponsive processes can be killed to reload them", function(t) {
  t.plan(2);
  helpers.piping(function(reloader) {
    reloader.on("started", function() {
      t.pass();
      helpers.trigger();
    });
    reloader.on("reloaded", function(status) {
      t.is(status.exitReason, "killed");
      t.end();
      reloader.stop();
    });
  });
});

helpers.child(function() {
  while (true) {};
})

