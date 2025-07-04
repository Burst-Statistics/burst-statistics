import Icon from '../../utils/Icon';
import * as ReactPopover from '@radix-ui/react-popover';

const Popover = ({ title, children, footer, isOpen, setIsOpen }) => {
  return (
    <ReactPopover.Root open={isOpen} onOpenChange={setIsOpen}>
      <ReactPopover.Trigger
        id="burst-filter-button"
        className={`${isOpen ? 'bg-gray-400 shadow-lg' : 'bg-gray-300'} focus:ring-blue-500 cursor-pointer rounded-full p-3 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2`}
        onClick={() => setIsOpen( ! isOpen )}
      >
        <Icon name="filter" />
      </ReactPopover.Trigger>
      <ReactPopover.Portal container={document.querySelector( '.burst' )}>
        <ReactPopover.Content
          className="z-50 min-w-[280px] max-w-[400px] rounded-lg border border-gray-200 bg-white p-0 shadow-xl"
          align={'end'}
          sideOffset={10}
          arrowPadding={10}
        >
          <ReactPopover.Arrow className="fill-white drop-shadow-sm" />
          <div className="border-b border-gray-100 px-4 py-3">
            <h5 className="m-0 text-base font-semibold text-black">{title}</h5>
          </div>
          <div className="px-4 py-2">{children}</div>
          {footer && (
            <div className="flex gap-2 rounded-b-lg border-t border-gray-100 bg-gray-50 px-4 py-3">
              {footer}
            </div>
          )}
        </ReactPopover.Content>
      </ReactPopover.Portal>
    </ReactPopover.Root>
  );
};

export default Popover;
