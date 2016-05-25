var test = require("ava");
var helpers = require("./helpers");

test.cb("Test if reload hook can be used for cleanup to exit cleanly", function(t) {
  t.plan(3);
  helpers.piping(function(reloader) {
    reloader.on("started", function() {
      t.pass();
      helpers.trigger();
    });
    reloader.on("waiting", function() {
      t.pass();
    });
    reloader.on("reloaded", function(status) {
      t.is(status.exitReason, "requested");
      t.end();
      reloader.stop();
    });
  });
});

helpers.child(function(reloader) {
  var interval = setInterval(function() {}, 200);
  reloader.on("reload", function(done) {
    clearInterval(interval);
    done();
  });
})