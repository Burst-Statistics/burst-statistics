import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import Modal from '@/components/Common/Modal';
import { toast } from 'react-toastify';
import * as burstApi from '@/utils/api'; // Adjust the import path as needed
import ButtonInput from '@/components/Inputs/ButtonInput'; // New import

interface ButtonControlInputProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The label to display on the button */
  label: string;
  /** An action string to execute via API call */
  action?: string;
  /** Optional text to override the label */
  buttonText?: string;
  /** Optional title for the confirmation modal */
  warnTitle?: string;
  /** Optional content for the confirmation modal */
  warnContent?: string;
  /** Determines the style variant when warning (danger or primary) */
  warnType?: 'danger' | 'secondary';
  /** When provided and no action is defined, renders as a hyperlink */
  url?: string;
}

const ButtonControlInput: React.FC<ButtonControlInputProps> = ({
  label,
  action,
  buttonText,
  warnTitle,
  warnContent,
  warnType,
  url,
  disabled,
  onClick,
  ...props
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const text = buttonText || label;

  const executeAction = async () => {
    if (!action) return;
    
    setIsExecuting(true);
    try {
      const response = await burstApi.doAction(action, {});
      if (response.success) {
        toast.success(response.message || __('Action completed successfully', 'burst-statistics'));
      } else {
        toast.error(response.message || __('Action failed', 'burst-statistics'));
      }
    } catch (error) {
      toast.error(__('An error occurred while executing the action', 'burst-statistics'));
      console.error('Action execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const clickHandler = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (warnTitle) {
      setIsOpen(true);
    } else {
      if (action) {
        await executeAction();
      }
      if (onClick) {
        onClick(e);
      }
    }
  };

  const handleConfirm = async () => {
    setIsOpen(false);
    if (action) {
      await executeAction();
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  // If an action is provided, render the button with action and optional modal
  if (action) {
    return (
      <>
        <ButtonInput
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => clickHandler(e)}
          disabled={disabled || isExecuting}
          btnVariant={warnType === 'danger' ? 'danger' : 'secondary'}
          {...props}
        >
          {isExecuting ? __('Processing...', 'burst-statistics') : text}
        </ButtonInput>
        {warnTitle && (
          <Modal
            title={warnTitle}
            content={warnContent || ''}
            isOpen={isOpen}
            onClose={handleCancel}
            triggerClassName=""
            children={null}
            footer={
              <>
                <ButtonInput onClick={handleCancel} btnVariant="tertiary">
                  {__('Cancel', 'burst-statistics')}
                </ButtonInput>
                <ButtonInput
                  onClick={handleConfirm}
                  btnVariant={warnType === 'danger' ? 'danger' : 'secondary'}
                  disabled={isExecuting}
                >
                  {isExecuting ? __('Processing...', 'burst-statistics') : __('Confirm', 'burst-statistics')}
                </ButtonInput>
              </>
            }
          />
        )}
      </>
    );
  }
  // If a URL is provided (and no action), render as a hyperlink.
  else if (url) {
    return (
      <ButtonInput link={{ to: url, from: '/' }} disabled={disabled} {...props} btnVariant="tertiary">
        {text}
      </ButtonInput>
    );
  }
  // Fallback rendering as a simple button.
  return (
    <ButtonInput onClick={onClick} disabled={disabled} {...props} btnVariant="tertiary">
      {text}
    </ButtonInput>
  );
};

export default ButtonControlInput; 