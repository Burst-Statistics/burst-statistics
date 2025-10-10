import SettingsScrollProgressLine from './SettingsScrollProgressLine';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { __ } from '@wordpress/i18n';
import { useFormState } from 'react-hook-form';

function SettingsFooter({ onSubmit, control }) {
  const { isDirty, isSubmitting, isValidating } = useFormState({
    control
  });

  const formStates = [
    {
      condition: isSubmitting,
      message: __( 'Saving...', 'burst-statistics' ),
      color: 'black'
    },
    {
      condition: isValidating,
      message: __( 'Validating...', 'burst-statistics' ),
      color: 'black'
    },
    {
      condition: isDirty,
      message: __( 'You have unsaved changes', 'burst-statistics' ),
      color: 'black'
    }
  ];

  const currentState = formStates.find( ( state ) => state.condition );

  return (
    <div className="sticky bottom-0 start-0 z-10 rounded-b-md border-b border-r border-l border-gray-300 bg-gray-100 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.05)]">
      <SettingsScrollProgressLine />
      <div className="flex flex-row items-center justify-end gap-2 p-5">
        {currentState?.message && <div className={'flex gap-2 items-center py-1 px-2 rounded-md transition-opacity duration-150' + ( currentState?.message ? ' opacity-100' : ' opacity-0' ) + ( 'red' === currentState?.color ? ' bg-red-light border border-red' : '' )}>
          <span className={'text-sm' + ( 'red' === currentState?.color ? ' font-semibold text-red' : ' italic text-gray-900' )}>{currentState?.message}</span>
        </div>}
        <ButtonInput className="burst-save" onClick={onSubmit}>
          {__( 'Save', 'burst-statistics' )} 
        </ButtonInput>
      </div>
    </div>
  );
}

SettingsFooter.displayName = 'FormFooter';
export default SettingsFooter;
