import Icon from '../../utils/Icon';
import * as ReactPopover from '@radix-ui/react-popover';

const Popover = ({
  title,
  children,
  footer,
  isOpen,
  setIsOpen
}) => {
  return (
      <ReactPopover.Root open={isOpen} onOpenChange={setIsOpen}>
        <ReactPopover.Trigger
            id="burst-filter-button"
            className={`burst-filter-button${isOpen ? ' active' : ''} bg-gray-300 rounded-full p-3 cursor-pointer transition-all duration-200 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.1)]`}
            onClick={() => setIsOpen( ! isOpen )}
        >
          <Icon name="filter"/>
        </ReactPopover.Trigger>
        <ReactPopover.Portal>
          <ReactPopover.Content
              className={'burst burst-popover'}
              align={'end'}
              sideOffset={10}
              arrowPadding={10}
          >
            <span className={'burst-popover__arrow'}></span>
            <div className={'burst-popover__header'}>
              <h5>{title}</h5>
            </div>
            <div className={'burst-popover__content'}>
              {children}
            </div>
            <div className={'burst-popover__footer'}>
              {footer}
            </div>
          </ReactPopover.Content>
        </ReactPopover.Portal>
      </ReactPopover.Root>
  );
};

export default Popover;
