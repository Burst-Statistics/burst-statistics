import Icon from '../../utils/Icon';
import * as ReactPopover from '@radix-ui/react-popover';
import {useState} from 'react';

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
            className={`burst-filter-button${isOpen ? ' active' : ''}`}
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
