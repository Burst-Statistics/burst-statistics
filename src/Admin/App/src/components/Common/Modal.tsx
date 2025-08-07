import * as Dialog from '@radix-ui/react-dialog';
import Icon from '../../utils/Icon';
import React from 'react';

interface ModalProps {
  title?: string;
  subtitle?: string;
  customHeader?: React.ReactNode;
  content: React.ReactNode;
  footer?: React.ReactNode;
  triggerClassName?: string;
  children?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({
  title,
  subtitle = '',
  customHeader = null,
  content,
  footer,
  triggerClassName,
  children,
  isOpen,
  onClose
}) => {

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      {triggerClassName && (
        <Dialog.Trigger className={triggerClassName}>{children}</Dialog.Trigger>
      )}
      <Dialog.Portal container={document.getElementById('modal-root')}>
        <Dialog.Overlay className="bg-black/50 fixed inset-0 z-50" />
        <Dialog.Content
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] max-h-[90vh] m-3 px-4 py-3 rounded-md z-50 bg-gray-100 shadow-md focus:outline-none data-[state=open]:animate-contentShow flex flex-col overflow-x-visible"
        >
          <div className="flex flex-row justify-between items-center flex-shrink-0">
            {customHeader ? (
              <>
                <div className="flex-1">
                  {customHeader}
                </div>
                <Dialog.Close asChild>
                  <button aria-label="Close" onClick={onClose} className="bg-gray-200 rounded-full p-2 w-8 h-8 cursor-pointer hover:bg-gray-300 transition-colors duration-150 ml-4">
                    <Icon name={'times'} size={18} color={'gray'} />
                  </button>
                </Dialog.Close>
              </>
            ) : (
              <>
                <div>
                  <Dialog.Title className="text-lg font-semibold text-black">{title}</Dialog.Title>
                  {subtitle && <p className="text-sm text-gray-600">
                    {subtitle}
                    </p>}
                </div>
                <Dialog.Close asChild>
                  <button aria-label="Close" onClick={onClose} className="bg-gray-200 rounded-full p-2 w-8 h-8 cursor-pointer hover:bg-gray-300 transition-colors duration-150">
                    <Icon name={'times'} size={18} color={'gray'} />
                  </button>
                </Dialog.Close>
              </>
            )}
          </div>
          <Dialog.Description className="text-base text-black mb-6 mt-4 flex-1 overflow-y-auto overflow-x-visible min-h-0">{content}</Dialog.Description>
          {footer && <div className="flex flex-row justify-end gap-2 flex-shrink-0 bottom-0 bg-gray-100 pt-4 border-t border-gray-200 -mx-4 px-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal; 