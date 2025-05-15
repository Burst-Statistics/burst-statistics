
var rsp_ajax = {};

rsp_ajax.x = function() {
    if ( 'undefined' !== typeof XMLHttpRequest ) {
        return new XMLHttpRequest();
    }
    var versions = [
        'MSXML2.XmlHttp.6.0',
        'MSXML2.XmlHttp.5.0',
        'MSXML2.XmlHttp.4.0',
        'MSXML2.XmlHttp.3.0',
        'MSXML2.XmlHttp.2.0',
        'Microsoft.XmlHttp'
    ];

    var xhr;
    for ( var i = 0; i < versions.length; i++ ) {
        try {
            xhr = new ActiveXObject( versions[i]);
            break;
        } catch ( e ) {
        }
    }
    return xhr;
};

rsp_ajax.send = function( url, callback, method, data, async ) {
    if ( async === undefined ) {
        async = true;
    }
    var x = rsp_ajax.x();
    x.open( method, url, async );
    x.onreadystatechange = function() {
        if ( 4 == x.readyState ) {
            callback( x.responseText );
        }
    };
    if ( 'POST' == method ) {
        x.setRequestHeader( 'Content-type', 'application/x-www-form-urlencoded' );
    }
    x.send( data );
};

rsp_ajax.get = function( url, data, callback, async ) {
    var query = [];
    for ( var key in data ) {
        query.push( encodeURIComponent( key ) + '=' + encodeURIComponent( data[key]) );
    }
    rsp_ajax.send( url + ( query.length ? '?' + query.join( '&' ) : '' ), callback, 'GET', null, async );
};
