/**
 * Copy text to clipboard with fallback for older browsers.
 *
 * @param {string} text - The text to copy.
 * @return {Promise<void>}
 */
export const copyToClipboard = async( text: string ) => {
    try {
        if ( navigator.clipboard && navigator.clipboard.writeText ) {
            await navigator.clipboard.writeText( text );
            return;
        }
    } catch ( err ) {
        console.warn( 'Clipboard API failed, trying fallback', err );
    }

    // Fallback for older browsers or non-HTTPS.
    const textArea = document.createElement( 'textarea' );
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild( textArea );
    textArea.select();
    textArea.focus();
    document.execCommand( 'copy' );
    document.body.removeChild( textArea );

};
