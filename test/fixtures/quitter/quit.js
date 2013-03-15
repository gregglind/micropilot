"use strict";

// https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIAppStartup

let {Cc,Ci} = require("chrome");
let appStartup = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);

let jsondump = function(thing){
   return JSON.stringify(thing,null,2)
}

console.log("starting",Date.now());
let p = require("micropilot/micropilot").Micropilot("study");

require("timers").setTimeout(function(){
    console.log("quitting:", Date.now());
    appStartup.quit(appStartup.eAttemptQuit);
},100);

exports.onUnload = function(reason){
  console.log(jsondump(p._config));
  console.log("unloading, b/c", reason, Date.now());
}
