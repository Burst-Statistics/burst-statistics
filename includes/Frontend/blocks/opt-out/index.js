/**
 * Visitor opt-out block.
 *
 * Dynamic: the button is rendered in PHP and gets its state in the browser, so
 * a cached page shows each visitor their own choice. The editor shows the same
 * server render, with both labels editable in the sidebar.
 */
( function( blocks, element, i18n, blockEditor, components, ServerSideRender ) {
	const el = element.createElement;
	const __ = i18n.__;

	// Name, title, icon, category and attributes all come from block.json,
	// which WordPress hands to the editor. Only what cannot be expressed as
	// metadata is registered here. Repeating any of it would let the two
	// definitions drift, and the copy in this file would win.
	blocks.registerBlockType( 'burst/opt-out', {
		edit: ( { attributes, setAttributes } ) => el(
			element.Fragment,
			null,
			el(
				blockEditor.InspectorControls,
				null,
				el(
					components.PanelBody,
					{ title: __( 'Labels', 'burst-statistics' ) },
					el( components.TextControl, {
						label: __( 'Opt out label', 'burst-statistics' ),
						help: __( 'Shown while the visitor is being tracked. Leave empty for the default.', 'burst-statistics' ),
						value: attributes.opt_out_label,
						onChange: value => setAttributes({ opt_out_label: value })
					}),
					el( components.TextControl, {
						label: __( 'Opt in label', 'burst-statistics' ),
						help: __( 'Shown while the visitor is opted out. Leave empty for the default.', 'burst-statistics' ),
						value: attributes.opt_in_label,
						onChange: value => setAttributes({ opt_in_label: value })
					})
				)
			),
			// This element is the block's root in the editor, which is what makes
			// it selectable; the server render is the block's own markup inside it.
			el(
				'div',
				blockEditor.useBlockProps(),
				el( ServerSideRender, {
					block: 'burst/opt-out',
					attributes: attributes
				})
			)
		),
		save: () => null
	});
}( window.wp.blocks, window.wp.element, window.wp.i18n, window.wp.blockEditor, window.wp.components, window.wp.serverSideRender ) );
