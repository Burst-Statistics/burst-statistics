import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

const Modal = ({
                   logo,
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
            <Dialog.Portal container={document.getElementById( 'onboarding-modal-root' )}>
                <Dialog.Overlay className="bg-black/50 fixed inset-0 z-[10001]" />
                <Dialog.Content
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    className="fixed px-6 py-3 left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-md z-[10002] bg-gray-100 p-2 shadow-md focus:outline-none data-[state=open]:animate-contentShow">
                    <div className="flex flex-row justify-between items-center">
                        {logo && (
                            <div className="flex items-center">
                                <img src={logo} alt="Logo" className="h-8 w-auto" />
                            </div>
                        )}
                        <Dialog.Title className="text-lg font-semibold text-black">
                            <VisuallyHidden.Root>Onboarding</VisuallyHidden.Root>
                        </Dialog.Title>
                    </div>
                    <Dialog.Description className="sr-only">
                        {title} - {typeof content === 'string' ? content : 'Onboarding step content'}
                    </Dialog.Description>
                    <div className="text-base text-black mb-6 mt-4">{content}</div>
                    <div className="flex flex-row justify-end gap-2">{footer}</div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default Modal;
