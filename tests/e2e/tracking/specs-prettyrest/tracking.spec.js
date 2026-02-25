/**
 * Tests the initial, and if the hit is registered in the database
 * Tests if Geo ip is working by spoofing a Dutch ip address and checking if it ends up in the sessions table.
 */

const {runTrackingTest} = require("./../tracking");
let config = {
    name: 'REST API (Pretty)',
    permalink: 'pretty',
    beaconEnabled: false,
    cookieless: false,
    turboMode: false,
    combineVarsAndScripts: false,
    ghostMode: false,
};

runTrackingTest('prettyrest', config);

