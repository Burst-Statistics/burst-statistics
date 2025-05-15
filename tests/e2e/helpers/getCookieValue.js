async function getCookieValue(page, name) {
    const cookies = await page.context().cookies();
    const cookie = cookies.find(c => c.name === name);
    return cookie ? cookie.value : null;
}

module.exports = { getCookieValue };