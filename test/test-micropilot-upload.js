/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// preamble from addon-sdk/test/sdk/test-reqest.jst

const { Request } = require("sdk/request");
const { pathFor } = require("sdk/system");
const file = require("sdk/io/file");

const { Loader } = require("sdk/test/loader");
const options = require("@test/options");

const loader = Loader(module);
const httpd = loader.require("sdk/test/httpd");
if (options.parseable || options.verbose)
  loader.sandbox("sdk/test/httpd").DEBUG = true;
const { startServerAsync } = httpd;

const { Cc, Ci, Cu } = require("chrome");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");

// Use the profile directory for the temporary files as that will be deleted
// when tests are complete
const basePath = pathFor("ProfD")
const port = 8099;

function prepareFile(basename, content) {
  let filePath = file.join(basePath, basename);
  let fileStream = file.open(filePath, 'w');
  fileStream.write(content);
  fileStream.close();
}


// micropilot stuff, from here on out.
const { defer, promised, resolve } = require('api-utils/promise');
let { Micropilot,Fuse,EventStore,snoop, killaddon } = require('micropilot');
const { good, bad, jsondump, uu } = require("./utils");


exports['test upload'] = function(assert,done){
  // server setup.
  let id = uu();
  let srv = startServerAsync(port, basePath);
  let content = id;
  let basename = "upload"
  prepareFile(basename, content);

  let uploadurl = "http://localhost:" + port + "/" + basename;

  let mtp = Micropilot(id)
  let group = promised(Array);
  group(mtp.record({abc:1}), mtp.record({abc:2})).then(function(){
    mtp.upload(uploadurl).then(function(response){
    	assert.ok(response.text == id);
    	srv.stop(done);
  	})
  })
};


exports['test ezupload succssful'] = function(assert,done){
  // server setup.
  let id = uu();
  let port = 8901;
  let srv = startServerAsync(port, basePath);
  let content = id;
  let basename = "upload"
  prepareFile(basename, content);

  let uploadurl = "http://localhost:" + port + "/" + basename;

  let mtp = Micropilot(id)
  let group = promised(Array);
  group(mtp.record({abc:1}), mtp.record({abc:2})).then(function(){
    mtp.ezupload({url:uploadurl}).then(function(cleanup){
      assert.ok(mtp._config.completed == true, "ezupload success, completed true")
      mtp.data().then(function(data){
        assert.equal(data.length,0,"ezupload succuss, data is clear");
        srv.stop(done);
      })
    })
  })
};

require("test").run(exports);