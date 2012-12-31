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

let {Micropilot,Fuse,EventStore,snoop} = require('micropilot');

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

/* EventStore */

exports['test EventStore add getall'] = function(assert,done){
  let idb = EventStore('someid');
  let group = promised(Array); // then(after all resolve, any order)
  group(idb.add({a:1}), idb.add({b:2}),idb.add({c:3})).then(function(){
    idb.getAll().then(
      function(data){
        // [{"a":1,"eventstoreid":1},
      // {"b":2,"eventstoreid":2},
        // {"c":3,"eventstoreid":3}]
        assert.equal(data.length,3)
        done();
      }
    )
  })
}


/* micropilot */

exports['test empty unwatch clears all topics'] = function(assert){
	let mtp = Micropilot(uu()).watch(['a','b']);
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
	let seen = 0;
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
	mtp.run();
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
  let group = promised(Array);
  let check = function(){ mtp.data().then(function(data){
    if (data.length == 3){
      assert.pass();
      done();
    } else {
      assert.fail("Data length != 3");
      done();
    }
  })};
	group(mtp.record({abc:1}), mtp.record({abc:2}), mtp.record({abc:3})).then(check);
};


/**
 * Call the underlying data store clear function
 * An empty db might hang around somewhere, but with 0 rows.
 */
exports['test clear clears data'] = function(assert, done){
  let mtp = Micropilot(uu());
  let group = promised(Array);
  let check = function(){ mtp.clear().then(function(result){
    mtp.data().then(function(data){
      if (data.length == 0){
        assert.pass();
        done();
      } else {
        assert.fail("Not all data cleared");
        done();
      }
    })

  })};
  group(mtp.record({abc:1}), mtp.record({abc:2}), mtp.record({abc:3})).then(check);
};

exports['test upload'] = function(assert,done){
  let mtp = Micropilot(uu());
  let group = promised(Array);
  group(mtp.record({abc:1}), mtp.record({abc:2})).then(function(){
    mtp.upload('http://some/false/url').then(good(assert,done))
  })
}

/* snoop */

exports['test snoop does something'] = function(assert){
  assert.ok(JSON.stringify(snoop()));
  // maybe assert has right keys?
}

/* Tests for Fuse */
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


/*  integration test */

exports['test full integration test'] = function(assert){
  // Annotated Example

  let monitor = require("micropilot").Micropilot('tabsmonitor');
  /* Effects:
    * Create IndexedDb:  youraddonid:micropilot-tabsmonitor
    * Create objectStore: tabsmonitor
    * Using `simple-store` persist the startdate of `tabsmonitor`
      as now.
    *
  */
  monitor.record({c:1}).then(function(d){assert.ok(d);
    assert.deepEqual(d,{"id":1,"data":{"c":1}} ) })
  /* in db => {"c"1, "eventstoreid":1} <- added "eventstoreid" key */
  /* direct record call.  Simplest API. */

  monitor.data().then(function(data){assert.ok(data.length==1)})
  /* Promises the data:  [{"c":1, "eventstoreid":1}] */

  monitor.clear().then(function(){assert.pass("async, clear the data and db")})

  // *Observe using topic channels*

  monitor.watch(['topic1','topic2'])
  /* Any observer-service.notify events in 'topic1', 'topic2' will be
     recorded in the IndexedDb */

  monitor.watch(['topic3']) /* add topic3 as well */

  monitor.unwatch(['topic3']) /* changed our mind. */

  observer.notify('kitten',{ts: Date.now(), a:1}) // not recorded, wrong topic

  observer.notify('topic1',{ts: Date.now(), b:1}) // will be recorded, good topic

  monitor.data().then(function(data){/* console.log(JSON.stringify(data))*/ })
  /* [{"ts": somets, "b":1}] */

  monitor.stop().record({stopped:true})  // won't record

  monitor.data().then(function(data){
    assert.ok(data.length==1);
    assert.ok(data[0]['b'] == 1);
  })

  monitor.isrunning = true;  // turns recording back on.

  // Longer runs
  let microsecondstorun = 86400 * 1000 // 1 day!
  monitor.run(microsecondstorun).then(function(mtp){
    console.log("Promises a Fuse that will be");
    console.log("called no earlier 24 hours after mtp.startdate.");
    console.log("Even / especially surviving Firefox restarts.");
    console.log("Run stops any previous fuses.");
    mtp.stop(); /* stop this study from recording*/
    mtp.upload(UPLOAD_URL).then(function(response){
      if (response.status != 200){
        console.error("what a bummer.")
      }
    })
  });

  monitor.stop();  // stop the Fuse!
  monitor.run();   // no argument -> forever.  Returned promise will never resolve.

  // see what will be sent.
  monitor.upload('http://fake.com',{simulate: true}).then(function(request){
    /*
    console.log(JSON.stringify(request.content));

    {"events":[{"ts":1356989653822,"b":1,"eventstoreid":1}],
    "userdata":{"appname":"Firefox",
      "location":"en-US",
      "fxVersion":"17.0.1",
      "updateChannel":"release",
      "addons":[]},
    "ts":1356989656951,
    "uploadid":"5d772ebd-1086-ea46-8439-0979217d29f7",
    "personid":"57eef97d-c14b-6840-b966-b01e1f6eb04c"}
    */
  })

  /* we have overrides for some pieces if we need them...*/
  monitor._config.personid /* store/modify the person uuid between runs */
  monitor.startdate /* setting this stops the Fuse, to allow 're-timing' */
  monitor.upload('fake.com',{simulate:true, uploadid: 1}); /* give an uploadid */

  monitor.stop();
  assert.pass();
}

require("test").run(exports);