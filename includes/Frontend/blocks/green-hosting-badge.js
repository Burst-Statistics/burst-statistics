/**
 * Green hosting badge block.
 *
 * Dynamic: the badge is rendered in PHP, so a later check that is no longer
 * green removes it from every page without re-saving them. The editor shows
 * the same server render, or a note when there is no verified badge to show.
 */
( function( blocks, element, i18n, blockEditor, ServerSideRender ) {
	const el = element.createElement;
	const __ = i18n.__;

	/**
	 * Note shown in the editor while there is nothing to render.
	 *
	 * @return {Object} The placeholder element.
	 */
	const emptyNote = () => el(
		'p',
		{ className: 'burst-green-hosting-badge-empty' },
		__( 'The badge appears here once Burst has verified green hosting for this site. Run the check in the Page weight block on the Burst dashboard.', 'burst-statistics' )
	);

	blocks.registerBlockType( 'burst/green-hosting-badge', {
		apiVersion: 3,
		title: __( 'Green hosting badge', 'burst-statistics' ),
		description: __( 'Shows the Green Web Foundation badge when this site\'s hosting is verified green. Shows nothing otherwise.', 'burst-statistics' ),
		icon: 'admin-site-alt3',
		category: 'widgets',
		edit: () => el(
			'div',
			blockEditor.useBlockProps(),
			el( ServerSideRender, {
				block: 'burst/green-hosting-badge',
				EmptyResponsePlaceholder: emptyNote
			})
		),
		save: () => null
	});
}( window.wp.blocks, window.wp.element, window.wp.i18n, window.wp.blockEditor, window.wp.serverSideRender ) );
