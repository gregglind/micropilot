/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

// code based on test/test-addon-installer.js from sdk

const { Cc, Ci, Cu } = require("chrome");
const AddonInstaller = require("sdk/addon/installer");
const observers = require("sdk/deprecated/observer-service");
const { setTimeout } = require("sdk/timers");
const tmp = require("sdk/test/tmp-file");
const system = require("sdk/system");

const testFolderURL = module.uri.split('test-selfdestruct')[0]; // so gross to hardwire name, sorry.
const ADDON_URL = testFolderURL + "fixtures/self-destruct/self-destruct.xpi";
const ADDON_PATH = tmp.createFromURL(ADDON_URL);

const micropilot = require("micropilot");

exports["test self destruct removes addon"] = function(assert,done){
  let ADDON_URL = testFolderURL + "fixtures/self-destruct/self-destruct.xpi";
  let ADDON_PATH = tmp.createFromURL(ADDON_URL);
  function eventsObserver(subject, data) {
    if (subject == "install") {
      observers.notify("test-selfdestruct-die-now","die");
    };
    if (subject == "uninstall") {
      done();  // the addon uninstalled
    }
  }
  observers.add("test-selfdestruct", eventsObserver, false);

  // Install the test addon
  AddonInstaller.install(ADDON_PATH).then(
    function onInstalled(id) {
      assert.equal(id, "self-destruct-addon@mozilla.com", "`id` is valid");
      // signal the addon to die
      observers.notify("test-selfdestruct-die-now","die");

    },
    function onFailure(code) {
      assert.fail("Install failed: "+code);
      observers.remove("test-selfdestruct", eventsObserver);
      done();
    }
  )
};


exports["test kill other addon by name"] = function(assert,done){
  let ADDON_URL = testFolderURL + "fixtures/addon-install-unit-test@mozilla.com.xpi";
  let ADDON_PATH = tmp.createFromURL(ADDON_URL);

  // Install the test addon
  AddonInstaller.install(ADDON_PATH).then(
    function onInstalled(id) {
      assert.equal(id, "addon-install-unit-test@mozilla.com", "`id` is valid");
      // signal the addon to die
      micropilot.killaddon(id).then(done);
    },
    function onFailure(code) {
      assert.fail("Install failed: "+code);
      done();
    }
  )
};


if (require("sdk/system/xul-app").is("Fennec")) {
  module.exports = {
    "test Unsupported Test": function UnsupportedTest (assert) {
        assert.pass("Skipping this test until Fennec support is implemented.");
    }
  }
}

require("test").run(exports);
