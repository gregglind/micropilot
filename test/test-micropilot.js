/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

let uuid = require('sdk/util/uuid').uuid;
let uu = exports.uu = function(){
        return uuid().number.slice(1,-1)
};
const observer = require("observer-service");

let {Micropilot,Fuse} = require('micropilot');

let good = function(assert,done){
	return function(){
		assert.pass();
		done();
	}
};

let bad = function(assert,done,msg){
	return function(){
		assert.fail(msg);
		done();
	}
};

/* micropilot */

exports['test empty unwatch clears all topics'] = function(assert){
	let mtp = Micropilot(uu()).watch(['a','b']);
	console.log(Object.keys(mtp._watched));
	assert.deepEqual(Object.keys(mtp._watched).sort(),['a','b']);
	mtp.unwatch();
	assert.deepEqual(Object.keys(mtp._watched),[]);
};

exports['test mtp watches a channel (replaced _watchfn)'] = function(assert,done){
	let mtp = Micropilot(uu());
	mtp._watchfn = function(subject){mtp.unwatch(); mtp.stop(); good(assert,done)()};
	mtp.watch(['kitten']).run()
	observer.notify('kitten',{});
};

exports['test mtp watches multiple channels (replaced _watchfn)'] = function(assert,done){
	let mtp = Micropilot(uu());
	seen = 0;
	mtp._watchfn = function(subject){
		seen++;
		if (seen == Object.keys(mtp._watched).length) {
			mtp.unwatch(); mtp.stop(); good(assert,done)();
		};
	};
	mtp.watch(['kitten','cat']);
	assert.deepEqual(Object.keys(mtp._watched).sort(),['cat','kitten']);
	mtp.watch(['dog']);
	assert.deepEqual(Object.keys(mtp._watched).sort(),['cat','dog','kitten']);
	mtp.run()
	observer.notify('kitten',{});
	observer.notify('cat',{});
	observer.notify('dog',{}); // seen all 3, should done!
};


/*
exports['test micropilot record works'] = function(assert,done){
	bad(assert,done,"unfinished")
};
*/
exports['test data gets all data'] = function(assert, done){
  let mtp = Micropilot(uu());
	mtp.record('a').record('b').record('c'); // this api might change
	mtp.data().then(function(data){
		if (data.length == 3){
			assert.pass();
			done();
		} else {
			assert.fail("Data length != 3");
			done();
		}
	})
};


exports['test Fuse with intervals runs many times'] = function(assert,done){
	let counter = 0;
	let counterfn = function(){
		counter++;
		if (counter > 10) {f.stop(); assert.pass(); done()};
	};
	let f = Fuse({start: Date.now(), duration:10*1000, pulseinterval:10,
		pulsefn: counterfn});
}

exports['test Fuse finishes'] = function(assert,done){
	let f = Fuse({start: Date.now(), duration:10}).then(
		good(assert,done));
};

require("test").run(exports);