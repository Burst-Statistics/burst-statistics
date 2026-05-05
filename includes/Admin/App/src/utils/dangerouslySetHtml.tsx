import DOMPurify from 'isomorphic-dompurify';

export const isLikelyHtml = ( s: string ) => /<[^>]+>/.test( s );

/**
 * Sanitizes HTML string using DOMPurify unless a custom sanitizer is provided.
 */
const sanitizeHtml = (
    dirty: string,
    custom?: ( dirty: string ) => string
) => {
    if ( custom ) {
        return custom( dirty );
    }

    return DOMPurify.sanitize( dirty, {
        ADD_ATTR: [ 'target', 'rel', 'class', 'style' ]
    });
};

/**
 * SAFE COMPONENT:
 * This component ONLY receives sanitized HTML.
 * DO NOT pass user-generated input directly into this component.
 */
const HtmlBlock = ({ html }: { html: string }) => {
    return (
        <>
            <span dangerouslySetInnerHTML={{ __html: html }} /> { /* nosemgrep */ }
        </>
    );
};

/**
 * Render either sanitized HTML or plain text.
 */
export const renderPossiblyHtml = ({
    value,
    sanitize
}: {
    value: string;
    sanitize?: ( dirty: string ) => string;
}) => {
    if ( isLikelyHtml( value ) ) {
        const clean = sanitizeHtml( value, sanitize );
        return <HtmlBlock html={clean} />;
    }

    // Return normal text safely
    return <>{value}</>;
};
