/**
 * Tests the initial, and if the hit is registered in the database
 * Tests if Geo ip is working by spoofing a Dutch ip address and checking if it ends up in the sessions table.
 */

const {runTrackingTest} = require("./../tracking");
let config = {
    name: 'Beacon',
    permalink: 'pretty',
    beaconEnabled: true,
    cookieless: false,
    turboMode: false,
    combineVarsAndScripts: false,
    ghostMode: false,
};

runTrackingTest('beacon', config);

