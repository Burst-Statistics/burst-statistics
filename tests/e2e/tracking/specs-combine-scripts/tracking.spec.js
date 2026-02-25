/**
 * Tests the initial, and if the hit is registered in the database
 * Tests if Geo ip is working by spoofing a Dutch ip address and checking if it ends up in the sessions table.
 */

const {runTrackingTest} = require("./../tracking");
let config = {
    name: 'Beacon&Cookieless',
    permalink: 'pretty',
    beaconEnabled: true,
    cookieless: true,
    turboMode: false,
    combineVarsAndScripts: true,
    ghostMode: false,
};
runTrackingTest('beaconcookieless', config);

