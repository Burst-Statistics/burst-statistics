import Icon from '../../utils/Icon';
import * as ReactPopover from '@radix-ui/react-popover';

const Popover = ({ title, children, footer, isOpen, setIsOpen, showFilterIcon=true, size='large' }) => {
  return (
    <ReactPopover.Root open={isOpen} onOpenChange={setIsOpen}>
            <ReactPopover.Trigger
                id="burst-filter-button"
                onClick={() => setIsOpen( ! isOpen )}
              >
                {showFilterIcon &&
                <div className={`${isOpen ? 'bg-gray-300 shadow-lg' : 'bg-gray-200 shadow-sm'} border border-gray-300 focus:ring-blue-500 cursor-pointer rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2`}>
                    <Icon name="filter" />
                </div>}
            </ReactPopover.Trigger>
      <ReactPopover.Portal container={document.querySelector( '.burst' )}>
        <ReactPopover.Content
          className="z-50 min-w-[280px] max-w-[600px] rounded-lg border border-gray-200 bg-white p-0 shadow-xl"
          align={'start'}
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
