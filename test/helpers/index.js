var lodash = require("lodash");
var fs = require("fs");
var path = require("path");
var cluster = require("cluster");
var piping = require("../../lib/piping");

var dummy = path.join(__dirname, "dummy.js");

var defaults = {
  throw: false,
  main: path.join(__dirname, "main.js"),
  quiet: true
}

function trigger() {
  fs.readFile(dummy, function(err, data) {
    if (err) throw err;
    fs.writeFile(dummy, data, function(err) {
      if (err) throw err;
    });
  });
}

function wrapper(override, ready) {

  if (arguments.length === 1) {
    ready = override;
    override = null;
  }
  return piping(options(override), ready);
}

function child(override, fn) {

  if (arguments.length === 1) {
    fn = override;
    override = null;
  }

  if (!cluster.isMaster) {
    fn(piping(options(override)));
  }
}

function options(override) {
  return lodash.assign(defaults, {
    main: module.parent.filename
  }, override)
}

module.exports = {
  trigger: trigger,
  piping: wrapper,
  child: child
}