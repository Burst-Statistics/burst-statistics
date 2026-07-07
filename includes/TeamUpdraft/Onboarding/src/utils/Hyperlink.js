/**
 *
 * We can't replace hyperlinks into text with sprintf or with replace() because you will get encoded HTML in the output.
 * This function is a workaround to allow us to have strings with hyperlinks in them, so the translatability is improved.
 *
 * @param root0
 * @param root0.className
 * @param root0.text
 * @param root0.target
 * @param root0.url
 * @param root0.rel
 */
const Hyperlink = ( { className, text, target, url, rel } ) => {
	let label_pre = '';
	let label_post = '';
	let link_text = '';
	if ( text.indexOf( '%s' ) !== -1 ) {
		const parts = text.split( /%s/ );
		label_pre = parts[ 0 ];
		link_text = parts[ 1 ];
		label_post = parts[ 2 ];
	} else {
		link_text = text;
	}
	className = className ? className : 'burst-link';

	return (
		<>
			{ label_pre }
			<a
				className={ className }
				target={ target }
				rel={ rel }
				href={ url }
			>
				{ link_text }
			</a>
			{ label_post }
		</>
	);
};
export default Hyperlink;
