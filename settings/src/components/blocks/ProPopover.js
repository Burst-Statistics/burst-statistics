import { useState } from '@wordpress/element';
import * as Popover from '@radix-ui/react-popover';
import Icon from '../../utils/Icon';
import { __ } from '@wordpress/i18n';

const ProPopover = ({
  children,
  className,
  onClick,
  show = false,
  title,
  subtitle,
  bulletPoints = [], // array of objects with text and icon for bullet points
  primaryButtonUrl,
  secondaryButtonUrl
}) => {
  const [ open, setOpen ] = useState( false );

  return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className={'burst-pro-popover-trigger ' + className} onMouseEnter={() => setOpen( true )}>
          {children}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
              className={'burst burst-pro-popover'}
              align={'start'}
              sideOffset={10}
              arrowPadding={10}
              style={{ zIndex: 9999 }}
          >
            <span className={'burst-pro-popover__arrow'}></span>
            <div className={'burst-pro-popover__header'}>
              <Popover.Close className={'burst-pro-popover__close'}><Icon name={'times'} /></Popover.Close>
              <h5>{title}</h5>
              <h6>{subtitle}</h6>
            </div>
            <div className={'burst-pro-popover__bullet-list'} >
              <p className={'burst-small-text'}>{__( 'Pro features include:', 'burst-statistics' )}</p>
              {bulletPoints.map( ({ text, icon }) => (
                  <span key={text}><Icon name={icon} /><p>{text}</p></span>
              ) )}
            </div>
            <div className={'burst-pro-popover__footer'}>
              <a href={primaryButtonUrl} target="_blank" className={'burst-button burst-button--pro'} rel="noreferrer">{__( 'Upgrade to Pro', 'burst-statistics' )}</a>
              <a href={secondaryButtonUrl} target="_blank" className={'burst-button burst-button--secondary'} rel="noreferrer">{__( 'Learn more', 'burst-statistics' )}</a>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
  );
};

export default ProPopover;
