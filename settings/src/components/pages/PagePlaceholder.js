import {
  Fragment
} from '@wordpress/element';

const PagePlaceholder = ( props ) => {
    return (
        <>
          <div className="burst-content-area burst-grid burst-dashboard burst-page-placeholder">
            <div className="burst-grid-item  burst-column-2 burst-row-2 "></div>
            <div className="burst-grid-item burst-row-2"></div>
            <div className="burst-grid-item burst-row-2"></div>
            <div className="burst-grid-item  burst-column-2"></div>
          </div>
        </>
    );
};

export default PagePlaceholder;

