/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

let uuid = require('sdk/util/uuid').uuid;
let uu = exports.uu = function(){
        return uuid().number.slice(1,-1)
};

let jsondump = exports.jsondump = function(thing) {
  console.log(JSON.stringify(thing,null,2))
};

let good = exports.good = function(assert,done){
	return function(){
		assert.pass();
		done();
	}
};

let bad = exports.bad = function(assert,done,msg){
	return function(){
		assert.fail(msg);
		done();
	}
};
