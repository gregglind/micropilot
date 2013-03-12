/*! vim:set ts=2 sw=2 sts=2 expandtab */
/*! This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

let micropilot =require("micropilot/micropilot");
const observers = require("sdk/deprecated/observer-service");

mtp = micropilot.Micropilot("astudy");

let main = exports.main = function(options,callback){
	let reason = options.loadReason;
	if (mtp._config.startcount === undefined) {
		mtp._config.startcount = 0;
	}
	mtp._config.startcount += 1;
	mtp.record({msg:reason}).then(function(){
		// actually 'realize' the _config, and pass it.
		observers.notify("test-persist",reason,{personid: mtp._config.personid, startdate:mtp._config.startdate});
	})
};
