function parseTsvToJson(tsv) {
    const lines = tsv.trim().split('\n');
    const headers = lines[0].split('\t');
    return lines.slice(1).map(line => {
        const values = line.split('\t');
        return headers.reduce((obj, key, i) => {
            obj[key] = values[i];
            return obj;
        }, {});
    });
}
export { parseTsvToJson };