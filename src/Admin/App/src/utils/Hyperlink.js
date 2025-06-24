const Hyperlink = ({className, text, target, url, rel}) => {
    let label_pre = '';
    let label_post = '';
    let link_text = '';
    if (text.indexOf('%s') !== -1) {
        let parts = text.split(/%s/);
        label_pre = parts[0];
        link_text = parts[1];
        label_post = parts[2];
    } else {
        link_text = text;
    }
    className = className ? className : 'burst-link';

    return (
        <>
            {label_pre}
            <a
                className={className}
                target={target}
                rel={rel}
                href={url}>
                {link_text}
            </a>
            {label_post}
        </>
    );
}
export default Hyperlink;
