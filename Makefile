#/* This Source Code Form is subject to the terms of the Mozilla Public
# * License, v. 2.0. If a copy of the MPL was not distributed with this
# * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#  Makefile for Test Pilot 2


TOP ?= $(shell pwd)
FOX=Aurora

# see http://stackoverflow.com/questions/649246/is-it-possible-to-create-a-multi-line-string-variable-in-a-makefile
define HELPDOC

  cover     -
  test      - FOX=Aurora, "", 17, etc.  (osx bundle name)
  docs      -
  help      - this help.

Note:  some targets are in the make file, some stuff is in `cfx`

endef
export HELPDOC

help:
	@echo "$$HELPDOC"


cover:
	cd $(TOP) &&\
	rm -rf fakey &&\
	mkdir -p fakey/lib && cp -r data doc test package.json fakey &&\
	(find lib -name '*js' -print0 | while IFS="" read -r -d "" file ; \
		do    ./node_modules/coverjs-moz/bin/coverjs -o fakey/`dirname "$$file"` \
	    --escodegen-options '{"moz":{"starlessGenerator":true,"parenthesizedComprehensionBlock":true}}' "$$file"; \
	     done )

test:  cover
	cd $(TOP) &&\
	(cfx test $(OPTS) --pkgdir=fakey -b /Applications/Firefox$(FOX).app/Contents/MacOS/firefox ;\
	node coverreport.js < coverstats-micropilot@ux.mozilla.org.json  > gh-pages/coverreport.html )

docs:
	# needs prep to set up right, alas.
	cd $(TOP) &&\
	./node_modules/dox/bin/dox < lib/micropilot.js  | ./node_modules/dox-template/bin/dox-template  -n Micropilot -r "0.3"  > gh-pages/index.html

testmobile:  cover
	cd $(TOP) &&\
	cfx test $(OPTS) --pkgdir=fakey -a fennec-on-device --mobile-app fennec --force-mobile -b /Users/glind/Downloads/android-sdk-macosx/platform-tools/adb

