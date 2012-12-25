/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 require('micropilot').Micropilot("mystudy").watch(['topic1','topic2']).run(84600 * 1000).then(function(mtp){
    mtp.upload(url); mtp.stop() })

Should we provide any help in the notifications?
*/

const { Class } = require('sdk/core/heritage');
const { Collection } = require("collection");
const { defer, promised, resolve } = require('api-utils/promise');
const { indexedDB } = require('./indexed-db'); // until it goes back in sdk
const observer = require("observer-service");
const pb = require("private-browsing");
const myprefs = require("simple-prefs").prefs;
const {storage} = require("simple-storage");
const timers = require("timers");


// Warning: micropilot steals the simple store 'micropilot' key by name
if (storage.micropilot===undefined) storage.micropilot = {};

let requestError = function(evt) console.error(evt.target.errorCode);

let EventStore = exports.EventStore = Class({
  initialize: function(collection){
    this.collection = collection;
  },
  type: "EventStore",
  db: function(){
    let that = this;
    let {promise, resolve} = defer();
    let request = indexedDB.open('micropilot',1);
    request.onerror = requestError;
    request.onupgradeneeded = function (event) {
      objectStore = request.result.createObjectStore(that.collection,{keyPath: "eventstoreid", autoIncrement: true });
    };
    // called after onupgradeneeded
    request.onsuccess = function(event) {
      resolve(request.result);
    };
    return promise
  },
  add: function(data){
    let that = this;
    let {promise, resolve} = defer();
    this.db().then(function(db){
      let request = db.transaction([that.collection], "readwrite").objectStore(that.collection).add(data);
      request.onsuccess = function (evt) {
        let newkey = evt.target.result;
        resolve({id: newkey, data:data});
      };
      request.onerror = requestError;
    })
    return promise
  },
  getAll: function(){
    // using getAll() doesn't seem to work, and isn't cross-platform
    let {promise, resolve} = defer();
    let that = this;
    this.db().then(function(db){
      let data = [];
      let req = db.transaction([that.collection], "readonly").objectStore(that.collection).openCursor()
      req.onsuccess = function(event) {
        let cursor = event.target.result;
        if (cursor) {
          data.push(cursor.value);
          cursor.continue();
        }
        else {
          resolve(data);
        }
      };
      req.onerror = requestError;
    })
    return promise;
  },
  clear: function(){
    // TODO, remove collection?  remove all data?
  }
});

/**
 */
let Micropilot = exports.Micropilot = Class({
    /**
     */
    initialize: function(studyid){
        // setup the indexdb
        this.studyid = studyid;
        this._watched = {};
        this._data = []  /* for now! will be indexdb, doesn't persist! */
        this._config = storage.micropilot[studyid]; // persists
        if (this._config === undefined) this._config = {};
        this._startdate = this._config.startdate = Date.now(); // start now
        this.isrunning = true;
    },
    type: 'Micropilot',

    get startdate() this._startdate,
    set startdate(ts) {
      this.stop();
      this._startdate = ts;
    },
    /**
     * promise of the data, once it is available
     */
    data: function() resolve(this._data), // this will be an indexeddb call.

    /**
     */
    cleardata: function(){
      this._data = [];
    },

    /**
     */
    record: function(data){  // TODO, should this be a promise? if so, of what?
      console.log('in record');
      if (! this.isrunning) return this;
      if (pb.isActive) return this;  // respect private browsing

      try {
          JSON.stringify(data);
          myprefs.logtoconsole && console.log("RECORDING", JSON.stringify(data));
          this._data.push(data);
          return this;
      } catch (e) {
          console.error(e, data);
          return this;
      }
    },

    /**
     *
     */
    run:  function(duration){
      this.stop();
      this.isrunning = true; // restart!
      let deferred = defer();
      let that = this;
      // iff!
      if (duration){
        // should this allow / mix all fuse options?
        this.fuse = Fuse({start: this.startdate,duration:duration});
        return this.fuse;
      } else {
        // no duration, so infinite, so nothing to resolve.
      }
      return deferred.promise;
    },

    /**

     Note, doesn't unregister.
     */
    stop:  function(){
      this.isrunning = false;
      this.fuse !== undefined && this.fuse.stop();
      return this;
    },

    /**
     */
    _watch: function(topic){
      if (this._watched[topic]) return

      let that = this;
      let cb = this._watchfn || function(subject) {that.record(subject)}; // recording.
      let o = observer.add(topic,cb); // add to global watch list
      this._watched[topic] = cb;
    },

    /** Update / override the list of channels to watch
     */
    watch: function(watch_list){
        let that = this;
        watch_list.forEach(function(t) that._watch(t))
        return this;
    },

    /**
     */
    _unwatch: function(topic){
      let cb = this._watched[topic];
      cb && observer.remove(topic,cb);
      delete this._watched[topic];
    },

    /**
     * if `unwatch_list` is undefined, unwatch all.
     */
    unwatch: function(unwatch_list){
      unwatch_list === undefined ? unwatch_list = Object.keys(this._watched) : unwatch_list;
      let that = this;
      unwatch_list.forEach(function(t) that._unwatch(t));
      return this;
    },

    /**
     */
    upload:  function(url,fake){
      // get all
      // attempt to post
      let space = "   "
      console.log("========WOULD UPLOAD=======")
      this.getdata().forEach(function(d){
          console.log(space,JSON.stringify(d));
      })
      // should be a url hit, of course.
      return defer();
    }

});

let Fuse = exports.Fuse = Class({
    initialize: function(options){
      let {start,duration,pulseinterval,resolve_this,pulsefn} = options;
      if (resolve_this === undefined) resolve_this = this;
      this.pulseinterval =  pulseinterval;
      let that = this;
      this.start = start;
      this.duration = duration;
      let { promise, resolve } = defer();
      this.promise = promise;
      this.resolve = resolve;
      // should this be setInterval, or setTimeout?
      // setInterval allows one to modify the fuse while running
      // more easily, but setTimeout is much more precise.
      if (pulseinterval){
        this.timerid = timers.setInterval(function(){
          that.checking = true;
          if (pulsefn) {pulsefn(that)}
          if (! duration) return;
          if (Date.now() >= (that.start + that.duration)){
            that.resolve(that.resolve_this);
            that.stop();
          }
          that.checking=false;
        },pulseinterval);
      } else {
        // TODO, what is setTimeout on a negative?
        that.checking=false;
        let timerunningsofar = (Date.now() - this.start);
        if (duration <= timerunningsofar) { // really short intervals
          this.resolve(resolve_this);
          this.stop();
        } else {
          this.timerid = timers.setTimeout(function(){
            that.resolve(that.resolve_this);
            that.stop();
          }, duration - timerunningsofar);
        }
      }
    },
    get then() this.promise.then,
    type: 'Fuse',
    stop: function(){
      if (this.timerid) timers.clearTimeout(this.timerid);
    }
});


let main = exports.main = function (options,callback){
  console.log(Date.now());
  Fuse({start: Date.now(),duration:1000 /* 1 sec */}).then(
    function(){
      console.log(Date.now(),"waited 1 sec.");
      Micropilot('mystudy').run(2000).then(
        function(){console.log(Date.now(),"done!")})}
  )

  let p = Fuse({start:Date.now(), duration:1000,interval:100,
    pulsefn:function(){console.log('pulsing')}}).then(function(){console.log("DID IT!")});

  let staticargs = options.staticArgs;
  let uuid = require('sdk/util/uuid').uuid;
  let kitten = timers.setInterval(function(){
    let d = {cute: true, me: uuid().number.slice(1,-1), ts: Date.now()};
    console.log("NOTIFY:", JSON.stringify(d));
    observer.notify('kitten',d)},1000);

  myprefs['logtoconsole'] = true;
  let mtp = Micropilot("mystudy").watch(['kitten']).run(5 * 1000).then(function(mtp){
    console.log("in the resolution");
    timers.clearTimeout(kitten);
    mtp.upload('http://some/url'); mtp.stop(); })

}

