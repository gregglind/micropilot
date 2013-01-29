/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { defer, promised, resolve } = require('api-utils/promise');
let uuid = require('sdk/util/uuid').uuid;
let uu = exports.uu = function(){
        return uuid().number.slice(1,-1)
};
const observer = require("observer-service");
const timers = require("timers");

let {Micropilot,Fuse,EventStore,snoop, killaddon} = require('micropilot');

// EVENTSTORE performance

exports['test many async writes'] = function(assert,done){
  // stress-ish test... we observe 140/sec approx.
  let idb = EventStore(uu());
  let start = Date.now();
  let n = 1000;
  let adds = [];
  for (let ii = 0; ii < n; ii++){
    adds.push(idb.add({"a":ii}));
  }
  let check = function(){
    idb.getAll().then(
      function(data){
        /// eventstoreids COULD BE in any order, due to async nature of record
        assert.equal(data.length, adds.length)
        let t = Date.now();
        console.log("min. writes/sec:", 1000*n/(t-start));
        done();
      }
    )
  };
  promised(Array).apply(null,adds).then(check);
}

require("test").run(exports);
