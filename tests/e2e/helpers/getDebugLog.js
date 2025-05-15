const { wpCli } = require('./wpCli');

async function getDebugLog () {
    try {
        return await wpCli('eval "\\$file = WP_CONTENT_DIR . \'/debug.log\';if ( ! file_exists( \\$file ) ) {touch( \\$file );} echo file_get_contents( \\$file );"');

        // return await wpCli('eval "echo file_get_contents( WP_CONTENT_DIR . \'/debug.log\' );"');
    } catch (error) {
        console.error('❌ Failed to read debug.log:', error.message || error);
        return null;
    }
}
module.exports = { getDebugLog };