var test = require("ava");
var path = require("path");
var helpers = require("./helpers");

test.cb("Test a process reloads on request when files change", function(t) {
  t.plan(3);
  helpers.piping(function(reloader) {
    reloader.on("started", function() {
      t.pass();
      helpers.trigger();
    });
    reloader.on("reloaded", function(status) {
      t.is(status.exitReason, "requested");
      t.is(path.relative(__dirname, status.fileChanged), "helpers/dummy.js");
      t.end();
      reloader.stop();
    });
  });
});

helpers.child(function() {
  setInterval(function() {}, 200);
})