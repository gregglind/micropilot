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

const testFolderURL = module.uri.split('test-persist')[0]; // so gross to hardwire name, sorry.

const micropilot = require("micropilot");

// we can pull this if bug #850303-addon-installer-enable lands
const { defer } = require("sdk/core/promise");
const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm");

let enable = function enable(addonId) {
  let { promise, resolve, reject } = defer();

  AddonManager.getAddonByID(addonId, function (addon) {
    addon.userDisabled = false;
    resolve();
  });
  return promise;
};

exports["test addon config persists over disable"] = function(assert,done){
  let ADDON_URL = testFolderURL + "fixtures/persist/persist.xpi";
  let ADDON_PATH = tmp.createFromURL(ADDON_URL);
  // in the addon:main -- observers.notify("test-persist",reason,mtp._config);

  let counter = 0;
  let datas = [];
  function eventsObserver(subject, data) {
    counter += 1;
    datas.push(data);
    if (counter == 2) {
      assert.equal(data[0].startdate,data[1].startdate, "startdate is same")
      assert.equal(data[0].personid,data[1].personid, "personid is same")
      done();
    }
  }
  observers.add("test-persist", eventsObserver, false);

  // Install the test addon
  AddonInstaller.install(ADDON_PATH).then(
    function onInstalled(id) {
      assert.equal(id, "persist-addon@mozilla.com", "`id` is valid");  // in!
      AddonInstaller.disable(id).then(function(){
        enable(id).then(function(){
        })
      })
    },
    function onFailure(code) {
      assert.fail("Install failed: "+code);
      observers.remove("test-selfdestruct", eventsObserver);
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
