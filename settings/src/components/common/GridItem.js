import ErrorBoundary from '../ErrorBoundary';

/**
 * GridItem
 * @param className
 * @param title
 * @param controls
 * @param children
 * @param footer
 * @return {JSX.Element}
 * @constructor
 */
const GridItem = ({ className, title, controls, children, footer }) => {
  return (
      <ErrorBoundary fallback={'Could not load page'}>
        <div className={'burst-grid-item ' + className}>
          <div className="burst-grid-item-header">
            <h3 className="burst-grid-title burst-h4">{title}</h3>
            <div className="burst-grid-item-controls">
              {controls}
            </div>
          </div>
          <div className="burst-grid-item-content">
            {children}
          </div>
          <div className="burst-grid-item-footer">
            {footer}
          </div>
        </div>
      </ErrorBoundary>
  );
};
export default GridItem;
