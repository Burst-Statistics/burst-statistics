const {wpCli} = require("./wpCli");
const {parseTsvToJson} = require("./parseTsvToJson");

async function getTableData(table, where = '') {
    let whereSql = '';
    if (where !== '') {
        whereSql = `WHERE ${where}`;
    }
    let data = await wpCli(`db query "SELECT * FROM ${table} ${whereSql}"`);
    return parseTsvToJson(data);
}
export { getTableData };