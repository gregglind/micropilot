Micropilot
==============

Flavor your addon with a one-file event observation and recording platform.

Example
----------

`require("micropilot").Micropilot('mystudy').observe(['topic1','topic2']).
  run(84600 * 1000 /*1 day*/).then(
    function(mtp){ mtp.upload(url); mtp.stop() })`

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

	Fuse({start: Date.now(),duration:1000 /* 1 sec */}).then(
	 function(){Micropilot('mystudy').run()} )

Stop recording (messages arrive but aren't recorded)

- turn on private browsing.  `require('pb').activate()` (soon to be deprecated!)
- `yourstudy.stop()`
- `yourstudy.isrunning = false`

Add more topics (channels), or remove them:

  yourstudy.watch(more_topics_list)
  yourstudy.unwatch(topics_list)

Remove all topics

  yourstudy.unwatch()

Just record some event without setting up a channel:

  `yourstudy.record(data)`

See all recording events in the console.

- `require('simpleprefs').prefs['logtoconsole'] = true`

Stop the callback in `run().then()`... (unlight the Fuse!)

  `yourstudy.stop();`

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

My `startdate` is wrong

  ```
  // will stop the study run callback, if it exists
  mystudy.startdate = whenever  // setter
  mystudy.run(newduration).then(callback)
  ```

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