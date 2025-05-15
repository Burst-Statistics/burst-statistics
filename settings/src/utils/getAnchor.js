/*
 * helper function to delay after a promise
 * @param ms
 * @returns {function(*): Promise<unknown>}
 */
const getAnchor = ( level ) => {
        let url = window.location.href;
        if ( -1 === url.indexOf( '#' ) ) {
            return false;
        }

       let queryString = url.split( '#' );
        if ( 1 === queryString.length ) {
            return false;
        }

        let urlPart = queryString[1];

        //for submenu, we have to get the string after the slash.
        if ( 'menu' === level ) {

            //if there is no slash, there is no menu level
            if ( -1 === urlPart.indexOf( '/' ) ) {
                return false;
            } else {
                let urlParts = urlPart.split( '/' );
                if ( 1 >= urlParts.length ) {
                    return false;
                } else {
                    return urlParts[1];
                }
            }
        } else {

            //main, just get the first.
            if ( -1 === urlPart.indexOf( '/' ) ) {
                return urlPart;
            } else {
                let urlParts = urlPart.split( '/' );
               return urlParts[0];
            }
        }
        return false;
};
export default getAnchor;
