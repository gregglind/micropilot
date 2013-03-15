#/bin/bash

P=$(pwd)/__junkprofile
rm -rf "$P"
mkdir -p "$P"

# run the same Micropilot-awake, firefox-killing addon twice

( cd fixtures/quitter && \
    cfx run -p "$P" --package-path ../../.. && \
    cfx run -p "$P" --package-path ../../.. ) &> "$P"/result

## the actual test, which probably could be a lot more elegant.

# personid, and startdate should each occur twice, with the same values each time.
# in the addon, it dumps the Micrpilot `._config`.
# this means that the end of this mess should be "2"
A=`egrep "(personid|startdate)" "$P"/result | sort | uniq -c | wc | awk '{print $1}'`

rm -rf "$P"

if test "$A" -eq "2" ; then
   echo $0 "ok"
   exit 0
else
   echo $0 "fail"
   exit 1
fi

