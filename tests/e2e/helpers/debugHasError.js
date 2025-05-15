const {getDebugLog} = require("./getDebugLog");

async function debugHasError() {
    const log = await getDebugLog();
    console.log(log);

    const errorPattern = /(PHP\s+(Fatal|Parse|Warning|Notice|Error|Recoverable\s+fatal|Deprecated)|WordPress\s+database\s+error)/i;
    return errorPattern.test(log);
}

export {debugHasError};