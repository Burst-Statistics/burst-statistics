import * as Dialog from '@radix-ui/react-dialog';
import Icon from '../../utils/Icon';

const Modal = ({
  title,
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
      onOpenChange={( open ) => {
        if ( ! open ) {
onClose?.();
}
      }}
    >
      {triggerClassName && (
        <Dialog.Trigger className={triggerClassName}>{children}</Dialog.Trigger>
      )}
      <Dialog.Portal container={document.getElementById( 'modal-root' )}>
        <Dialog.Overlay className="bg-black/50 fixed inset-0 z-50" />
        <Dialog.Content className="fixed px-4 py-3 left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-md z-50 bg-gray-100 p-2 shadow-md focus:outline-none data-[state=open]:animate-contentShow">
          <div className="flex flex-row justify-between items-center">
            <Dialog.Title className="text-lg font-semibold text-black">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" onClick={onClose} className="bg-gray-200 rounded-full p-2 w-8 h-8 cursor-pointer hover:bg-gray-300 transition-colors duration-150">
                <Icon name={'times'} size={18} color={'gray'} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-base text-black mb-6 mt-4">{content}</Dialog.Description>
          <div className="flex flex-row justify-end gap-2">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
