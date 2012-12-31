Micropilot
==============

Flavor your addon with a one-file event observation and recording platform.

Example
----------

```
require("micropilot").Micropilot('mystudy').watch(['topic1','topic2']).
  run(84600 * 1000 /*1 day*/).then(
    function(mtp){ mtp.upload(url); mtp.stop() })
```

Longer, Annotated Example, Demoing Api
-----------------------------------------

```
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
```

FAQ
-----

Why have a `studyid`?

* used as `IndexedDb` collection name.
* used for the 'start time' persistent storage key, to persist between runs.

Timestamps on events?

* you need to timestamp your own events!

What are events?

* any jsonable (as claimed by `JSON.stringify`) object.

Run indefinitely...

   `micropilot('yourid').run()  // will never resolve.`

Wait before running / delay startup?

* do it yourself... using `setTimeout` or `Fuse` like:

```
	Fuse({start: Date.now(),duration:1000 /* 1 sec */}).then(
	 function(){Micropilot('mystudy').run()} )
```

Stop recording (messages arrive but aren't recorded)

- turn on private browsing.  `require('pb').activate()` (soon to be deprecated!)
- `yourstudy.stop()`
- `yourstudy.isrunning = false`

Add more topics (channels), or remove them:

```
  yourstudy.watch(more_topics_list)
  yourstudy.unwatch(topics_list)
```

Remove all topics

  yourstudy.unwatch()

Just record some event without setting up a channel:

  `yourstudy.record(data)`

See all recording events in the console.

- `require('simpleprefs').prefs['logtoconsole'] = true`

Stop the callback in `run().then()`... (unlight the Fuse!)

  ```yourstudy.stop();```

Fusssing with internals:

* `id`:  don't change this

Do studies persist after Firefox shutdown / restart?

* Yes, in that the start time is recorded using `simple-storeage`, ensuring that the duration is 'total duration'.  In other words `run(duration=many_ms)` will Do The Right Thing.
* Data persists between runs.

How do I clean up my mess?

```
  Micropilot('studyname').run(duration).then(function(mtp){
    mtp.stop();
    mtp.upload(somewhere);
    mtp.cleardata();    // collection name might still exist
    require('simple-storage').store.micropilot = undefined
    let addonid = require('self').id;
    require("sdk/addon/installer").uninstall(addonid); // apoptosis of addon
  })
```

I don't want to actually record / I want to do something else on observation.

* `yourstudy._watchfn = function(subject){}` before any registration / run.
* (note:  you can't just replace `record` because it's a `heritage` frozen object key)

How can I notify people on start / stop / comletion / upload?

* Write your own
* use Test Pilot 2, or similar.

How do uploads work?

* snoops some user data, and all recorded events
* to `url`.  returns promise on response.
* for now, it's up to you to check that response, url and otherwise check that you are happy with it.

  let micro = require('micropilot');
  let studyname = 'mystudy';
  micro.Micropilot(studyname).upload(micro.UPLOAD_URL + studyname).then(
    function(response){ /* check response, retry using Fuse, etc. */ })

My `startdate` is wrong

```
  // will stop the study run callback, if it exists
  mystudy.startdate = whenever  // setter
  mystudy.run(newduration).then(callback)
```

Event Entry Order is Wrong / Some got lost

* Events are written asynchronously.  Order is not guaranteed.
* During catastrophic Firefox crash, some events may not be written.


I Want a Pony

* Ponies are scheduled for Version 2.
* You can't have a pony, since this is JavaScript and not Python.


Glossary
-----------

* `observe` / `notify`:  Global `observerService` terms.
* `watch` / `unwatch`:  `Micropilot` listens to `observer` for `topics`
* `record`: attempt to write data to the `IndexedDb`
* `event`:  in Micropilot, any `JSON.stringify`-able object.  Used broadly for "a thing of human interest that happened", not in the strict JS sense.

Other Gory Details and Sharp Edges:
-------------------------------------

Study `run(duration).then(callback)` is a `setTimout` based on `Date.now()`, `startdate` and the `duration`.  If you want a more sophisticated timing loop, use a `Fuse` or write your own.



Authors
----------

Gregg Lind <glind@mozilla.com>

License
----------

MPL2