import * as Dialog from '@radix-ui/react-dialog';
import Icon from '../../utils/Icon';

const Modal = ({ title, content, footer, triggerClassName, children, isOpen, onClose }) => (
    <Dialog.Root open={isOpen} onClose={onClose}>
        {triggerClassName && <Dialog.Trigger className={triggerClassName}>
        {children}
      </Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="burst-modal-backdrop" />
        <Dialog.Content className="burst burst-modal">
          <div className="burst-modal-header">
            <Dialog.Title className="burst-modal-title">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="burst-modal-close" aria-label="Close">
                <Icon name={'times'} size={18} color={'grey'} onClick={onClose}/>
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="burst-modal-content">
            {content}
          </Dialog.Description>
          <div className="burst-modal-footer">
          {footer}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
);

export default Modal;

