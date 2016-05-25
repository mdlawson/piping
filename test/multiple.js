var test = require("ava");
var helpers = require("./helpers");

test.cb("Test a process can be reloaded multiple times", function(t) {
  t.plan(4);
  helpers.piping(function(reloader) {
    reloader.on("started", function() {
      t.pass();
      helpers.trigger();
    });
    var count = 0;
    reloader.on("reloaded", function(status) {
      t.is(status.exitReason, "requested");
      if (count++ < 2) helpers.trigger();
      else {
        t.end();
        reloader.stop();
      }
    });
  });
});

helpers.child(function() {
  setInterval(function() {}, 200);
})