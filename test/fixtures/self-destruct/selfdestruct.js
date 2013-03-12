/*! vim:set ts=2 sw=2 sts=2 expandtab */
/*! This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

let micropilot =require("micropilot/micropilot");
const observers = require("sdk/deprecated/observer-service");

observers.add("test-selfdestruct-die-now",function(){
	micropilot.killaddon();  // kill self.
});

let main = exports.main = function(options,callback){
	let reason = options.loadReason;
	observers.notify("test-selfdestruct",reason);
}

require("sdk/system/unload").when(function(reason){
	observers.notify("test-selfdestruct",reason);
})