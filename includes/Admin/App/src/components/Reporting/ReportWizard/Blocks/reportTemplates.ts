import { __ } from '@wordpress/i18n';

export const getRecommendationsFooterHtml = () => `
	<div>

		<h1 style="font-weight: 700; margin: 0 0 24px 0; letter-spacing: -0.01em;">${ __( 'Our recommendations', 'burst-statistics' ) }</h1>

		<p style="line-height: 1.7; margin: 0 0 32px 0;">
			${ __( 'Write a short introduction about the statistics and what you have accomplished for your client this week or month.', 'burst-statistics' ) }
		</p>

		<p style="font-weight: 600; margin: 0 0 32px 0;">
			${ __( 'If you have questions, please send us an email or give us a call!', 'burst-statistics' ) }
		</p>

		<p style="font-weight: 700; margin: 0 0 4px 0;">${ __( 'Your Name', 'burst-statistics' ) }</p>

		<p style="margin: 0 0 28px 0;">${ __( 'Your Job Title', 'burst-statistics' ) }</p>

		<div style="margin-bottom: 20px;">
			<p style="font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 4px 0;">${ __( 'Email', 'burst-statistics' ) }</p>
			<p style="font-weight: 700; margin: 0;">${ __( 'info@agency.com', 'burst-statistics' ) }</p>
		</div>

		<div style="margin-bottom: 0;">
			<p style="font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 4px 0;">${ __( 'Phone', 'burst-statistics' ) }</p>
			<p style="font-weight: 700; margin: 0;">${ __( '123-456-7890', 'burst-statistics' ) }</p>
		</div>
	</div>
`;
