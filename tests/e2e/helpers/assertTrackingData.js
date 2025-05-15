const {expect} = require("@playwright/test");

function assertTrackingData(data, page) {
    expect(data.length).toBe(1);
    expect(data[0].time).toBeTruthy();
    expect(data[0].uid).toBeTruthy();
    expect(data[0].page_url).toBe(page.page_url);
    expect(data[0].parameters).toBe(page.parameter);
    expect(parseInt(data[0].browser_id)).toBeGreaterThan(0);
    expect(parseInt(data[0].platform_id)).toBeGreaterThan(0);
    expect(parseInt(data[0].device_id)).toBeGreaterThan(0);
}
export { assertTrackingData };