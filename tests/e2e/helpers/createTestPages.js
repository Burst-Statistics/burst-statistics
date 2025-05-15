const { wpCli } = require('../helpers/wpCli');

async function createTestPages() {
    const result = await wpCli('post list --post_type=page --format=json');
    const pages = JSON.parse(result);
    const titles = pages.map(page => page.post_title);
    const pagesToCreate = [];

    if (!titles.includes('Test Tracking Page')) {
        const content = `
            <button data-burst-goal="1" class="burst-test-goal" data-testid="goal-trigger">Click to Trigger Goal</button>
            <p>This is a test page for Burst Statistics tracking.</p>
            <p>Time on page will be tracked automatically.</p>
            <p>Click the button above to trigger a goal.</p>
        `.trim();

        pagesToCreate.push({
            title: 'Test Tracking Page',
            slug: 'test-tracking-page',
            content,
        });
    }

    if (!titles.includes('Test Another Page')) {
        const content = `
            <p>This is another test page for Burst Statistics tracking.</p>
            <p>This page is used to test page exit tracking.</p>
        `.trim();

        pagesToCreate.push({
            title: 'Test Another Page',
            slug: 'test-another-page',
            content,
        });
    }

    for (const page of pagesToCreate) {
        const command = `post create --post_type=page --post_title="${page.title}" --post_name="${page.slug}" --post_status=publish --post_content="${page.content.replace(/"/g, '\\"')}"`;
        await wpCli(command);
    }
}

module.exports = { createTestPages };
