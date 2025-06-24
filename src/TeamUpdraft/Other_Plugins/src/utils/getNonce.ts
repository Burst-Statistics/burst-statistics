/**
 * Get nonce for burst api. Add random string so requests don't get cached
 * @returns {string}
 */
export const getNonce = (nonce: string): string => {
    return (
        'nonce=' +
        nonce +
        '&token=' +
        Math.random() // nosemgrep
            .toString( 36 )
            .replace( /[^a-z]+/g, '' )
            .substr( 0, 5 )
    );
};