const { wpCli } = require( "./wpCli" );
const { parseTsvToJson } = require( "./parseTsvToJson" );

/**
 * Fetch table data using wp-cli + SQL with flexible clauses
 *
 * @param {string} table - Table name, e.g. 'wp_posts'
 * @param {object} [options]
 * @param {string} [options.where]   - WHERE clause (without 'WHERE')
 * @param {string} [options.select]  - Comma-separated columns
 * @param {string} [options.orderBy] - ORDER BY clause (without 'ORDER BY')
 * @param {string|number} [options.limit] - LIMIT clause
 *
 * @returns {Promise<Array<object>>} Parsed result rows
 */
async function getTableData(
    table,
    {
        where = '',
        select = '*',
        orderBy = '',
        limit = ''
    } = {}
) {
    let sql = `SELECT ${select} FROM ${table}`;

    if ( where ) {
        sql += ` WHERE ${where}`;
    }

    if ( orderBy ) {
        sql += ` ORDER BY ${orderBy}`;
    }

    if ( limit !== '' ) {
        sql += ` LIMIT ${limit}`;
    }

    // Escape double quotes for wp-cli
    const safeSql = sql.replace(/"/g, '\\"');

    // Execute SQL via wp-cli
    const raw = await wpCli( `db query "${safeSql}"` );

    // Convert TSV result into JSON array
    return parseTsvToJson( raw );
}

module.exports = { getTableData };
