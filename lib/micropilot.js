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

"use strict";

const { Class } = require('sdk/core/heritage');
const { Collection } = require("collection");
const { defer, promised, resolve } = require('api-utils/promise');
const { indexedDB } = require('./indexed-db'); // until it goes back in sdk
const observer = require("observer-service");
const pb = require("private-browsing");
const myprefs = require("simple-prefs").prefs;
const Request = require("request").Request;
const {storage} = require("simple-storage");
const timers = require("timers");
let uuid = require('sdk/util/uuid').uuid;

let uu = exports.uu = function(){
        return uuid().number.slice(1,-1)
};

let UPLOAD_URL = exports.UPLOAD_URL = "https://testpilot.mozillalabs.com/submit/";

// Warning: micropilot steals the simple store 'micropilot' key by name
if (storage.micropilot===undefined) storage.micropilot = {};

let requestError = function(evt) console.error(evt.target.errorCode);

let EventStore = exports.EventStore = Class({
  initialize: function(collection,keyname){
    this.collection = collection;
    this.keyname = keyname || "eventstoreid";
  },
  type: "EventStore",
  db: function(){
    let that = this;
    let {promise, resolve} = defer();
    // TODO each EventStore has different Db, so the createObjectStore will work.  Is this gross?
    let request = indexedDB.open("micropilot-"+that.collection,1);
    request.onerror = requestError;
    request.onupgradeneeded = function (event) {
      let objectStore = request.result.createObjectStore(that.collection,{keyPath: that.keyname, autoIncrement: true });
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
    /* removes the db */
    let that = this;
    let {promise, resolve} = defer();
    let request = indexedDB.deleteDatabase("micropilot-"+that.collection,1);
    request.onerror = requestError;
    // called after onupgradeneeded
    request.onsuccess = function(event) {
      resolve(request.result);
    };
    return promise;
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
        this.eventstore = EventStore(this.studyid);
        this._config = storage.micropilot[studyid]; // persists
        if (this._config === undefined) {
          this._config = {};
          this._config.personid = uu();
        }
        this._startdate = this._config.startdate = Date.now(); // start now
        this.isrunning = true; // starts running by default
    },
    type: 'Micropilot',

    get startdate() this._startdate,
    // resetting the startdate kills existing run / fuse
    set startdate(ts) {
      this.stop();
      this._startdate = ts;
    },
    /**
     * promise of the data, once it is available
     */
    data: function() this.eventstore.getAll(),

    /**
     */
    clear: function(){
      return this.eventstore.clear();
    },

    /**
     * returns promise of EventStore.add, which is {id:,data:}
     * unless record "doesn't happen" because of private browsing or non-running
     */
    record: function(data){
      // TODO, what should these branches return?
      if (! this.isrunning) return resolve(undefined);
      if (pb.isActive) return resolve(undefined);  // respect private browsing

      // todo, what if it's not jsonable?
      JSON.stringify(data);
      myprefs.logtoconsole && console.log("RECORDING:", JSON.stringify(data));
      return resolve(this.eventstore.add(data));
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
      if (unwatch_list === undefined) unwatch_list = Object.keys(this._watched);
      let that = this;
      unwatch_list.forEach(function(t) that._unwatch(t));
      return this;
    },

    /**
     */
    upload:  function(url,options){
      // get all... is this tangled between getting and posting?
      // attempt to post
      options = options===undefined ? {} : options;
      let that = this;
      let simulate = options.simulate;
      let { promise, resolve } = defer();
      let uploadid = options.uploadid || uu(); // specific to the upload
      this.data().then(function(data){
        let payload = {events:data};
        payload.userdata = snoop();
        payload.ts = Date.now();
        payload.uploadid = uploadid;
        payload.personid = that._config.personid;
        let R = Request({
          url: url,
          content: payload,
          contentType: "application/json",
          onComplete: function (response) {
            resolve(response) }
        });
        if (simulate) {
          resolve(R);
        } else {
          R.post();
        }
      });
      return promise;
    }

});

let snoop = exports.snoop = function(){
  let LOCALE_PREF = "general.useragent.locale";
  let UPDATE_CHANNEL_PREF = "app.update.channel";
  let xa = require("xul-app");
  let prefs = require('preferences-service');

  let u = {};
  u.appname = xa.name;
  u.location = prefs.get(LOCALE_PREF)
  u.fxVersion = xa.version;
  u.os = require('runtime').os;
  u.updateChannel = prefs.get(UPDATE_CHANNEL_PREF)
  u.addons = [] // get this in some sync way? or move this all to async?
  return u;
}

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
    timers.clearTimeout(kitten);
    mtp.upload('http://some/url'); mtp.stop(); })

}

