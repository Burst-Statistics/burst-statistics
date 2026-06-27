import { __ } from '@wordpress/i18n';

/**
 * Single source of truth for metric label, definition, optional "why it matters",
 * and optional privacy note shown in metric-explainer tooltips across the dashboard.
 *
 * Rules: one dominant answer per field; front-load the key word; never restate
 * the label; plain language; privacy notes only where they build trust.
 *
 * Set `url` on an entry to surface a "Learn more" link at the foot of the tooltip.
 *
 * @type {Object.<string, {label: string, definition: string, whyItMatters?: string, privacyNote?: string, url?: string}>}
 */
export const METRIC_DEFINITIONS = {
	visitors: {
		label: __( 'Visitors', 'burst-statistics' ),
		definition: __( 'Unique people who visited your site', 'burst-statistics' )
	},
	sessions: {
		label: __( 'Sessions', 'burst-statistics' ),
		definition: __( 'A single continuous visit: one or more pageviews by the same visitor, ending after 30 minutes of inactivity.', 'burst-statistics' )
	},
	pageviews: {
		label: __( 'Pageviews', 'burst-statistics' ),
		definition: __( 'Total number of pages loaded, including repeated views of the same page by the same visitor.', 'burst-statistics' )
	},
	bounces: {
		label: __( 'Bounces', 'burst-statistics' ),
		definition: __( 'Sessions where only one page was viewed or user left the page within 5 seconds.', 'burst-statistics' )
	},
	bounce_rate: {
		label: __( 'Bounce Rate', 'burst-statistics' ),
		definition: __( 'Percentage of sessions where only one page was viewed or user left the page within 5 seconds.', 'burst-statistics' ),
		whyItMatters: __( 'High bounce rates on landing pages often signal slow load times or mismatched search intent.', 'burst-statistics' )
	},
	conversions: {
		label: __( 'Conversions', 'burst-statistics' ),
		definition: __( 'Number of times a visitor completed a goal you configured, such as a form submission or button click.', 'burst-statistics' )
	},
	conversion_rate: {
		label: __( 'Conversion rate', 'burst-statistics' ),
		definition: __( 'Percentage of visitors who completed a goal during the selected period.', 'burst-statistics' ),
		whyItMatters: __( 'Even a small improvement here can significantly increase the return from your existing traffic.', 'burst-statistics' )
	},
	time_on_page: {
		label: __( 'Time on page', 'burst-statistics' ),
		definition: __( 'Average time visitors spent on a page, measured from page load to the next navigation event.', 'burst-statistics' ),
		whyItMatters: __( 'Short times on content-heavy pages may indicate visitors are not finding what they expected.', 'burst-statistics' )
	},

	// Device categories.
	desktop: {
		label: __( 'Desktop', 'burst-statistics' ),
		definition: __( 'Visitors using a desktop or laptop computer, identified by screen width and user-agent.', 'burst-statistics' )
	},
	tablet: {
		label: __( 'Tablet', 'burst-statistics' ),
		definition: __( 'Visitors on tablet-sized screens such as an iPad, identified by screen width and user-agent.', 'burst-statistics' )
	},
	mobile: {
		label: __( 'Mobile', 'burst-statistics' ),
		definition: __( 'Visitors on phones and small-screen devices, identified by screen width and user-agent.', 'burst-statistics' )
	},
	other: {
		label: __( 'Other', 'burst-statistics' ),
		definition: __( 'Devices that could not be classified as desktop, tablet, or mobile. Including smart TVs, game consoles, and bots that passed bot filtering.', 'burst-statistics' )
	},

	// Engagement metrics.
	outgoing_links: {
		label: __( 'Outgoing links', 'burst-statistics' ),
		definition: __( 'Clicks on links that lead visitors away from your site, tracked by attaching a click listener to external anchor elements.', 'burst-statistics' ),
		whyItMatters: __( 'Frequently clicked outbound links show where your visitors go next. Useful for partnership and monetization decisions.', 'burst-statistics' ),
		url: 'https://burst-statistics.com/guides/external-link-tracking-see-where-your-visitors-go-next/'
	},
	forms: {
		label: __( 'Forms', 'burst-statistics' ),
		definition: __( 'Tracks form views, starts, and submissions for any form on your site, including Contact Form 7, Gravity Forms, and WPForms.', 'burst-statistics' ),
		whyItMatters: __( 'Comparing submissions to views reveals your form conversion rate and highlights drop-off points.', 'burst-statistics' )
	},
	search_terms: {
		label: __( 'Website searches', 'burst-statistics' ),
		definition: __( 'Words and phrases visitors typed into your site\'s own search bar, captured from the search query parameter in the URL.', 'burst-statistics' ),
		whyItMatters: __( 'Zero-result searches reveal content gaps. Topics your visitors want but cannot find on your site.', 'burst-statistics' ),
		url: 'https://burst-statistics.com/guides/search-insights-see-what-visitors-are-looking-for-on-your-website/'
	},

	// Live count.
	live_visitors: {
		label: __( 'Live', 'burst-statistics' ),
		definition: __( 'Visitors who loaded a page on your site in the last 5 minutes, updated automatically.', 'burst-statistics' )
	}
};
