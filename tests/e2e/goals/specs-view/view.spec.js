/**
 * Tests the initial, and if the hit is registered in the database
 * Tests if Geo ip is working by spoofing a Dutch ip address and checking if it ends up in the sessions table.
 */

const {runGoalTest} = require("./../goals.js");
let config = {
    name: 'Viewport Goal',
    permalink: 'pretty',
    beaconEnabled: true,
    cookieless: false,
    turboMode: false,
};


runGoalTest('views', config);

