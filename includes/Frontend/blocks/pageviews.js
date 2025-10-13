( function( blocks, element, i18n ) {
  let el = element.createElement;
  let __ = i18n.__;
  let sprintf = i18n.sprintf;
  const blockContent = () => {
      return el(
          'p',
          { className: 'burst-pageviews' },
          sprintf( __( 'This page has been viewed %d times.', 'burst-statistics' ), 0 )
      );
  };

  blocks.registerBlockType( 'burst/pageviews-block', {
    title: __( 'Pageviews Counter', 'burst-statistics' ),
    icon: 'analytics',
    category: 'widgets',
    edit: blockContent,
    save: blockContent
  });
}( window.wp.blocks, window.wp.element, window.wp.i18n ) );
