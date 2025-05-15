import Modal from '../../common/Modal';
import {formatUnixToDate} from '../../../utils/formatting';
import {__} from '@wordpress/i18n';
import Icon from '../../../utils/Icon';
import {Close} from '@radix-ui/react-dialog';
import {useState} from 'react';

const Content = ({goal}) => (
    <>
      {__( 'Are you sure you want to delete this goal?', 'burst-statistics' ) +
          ' ' + __( 'This action cannot be undone.', 'burst-statistics' )}
      <br/>
      <br/>
        <strong>{__( 'Goal name', 'burst-statistics' )}:</strong> {goal.name}
        <br/>
        <strong>{__( 'Status', 'burst-statistics' )}:</strong> {goal.status}
        <br/>
        <strong>{__( 'Date created',
            'burst-statistics' )}:</strong> {formatUnixToDate( goal.dateCreated )}
    </>
);

const Footer = ({deleteGoal, onClose, isDisabled}) => {

  return (
      <>
      <Close asChild aria-label="Close">
        <button className={'burst-button burst-button--secondary'} onClick={onClose}>
          {__( 'Cancel', 'burst-statistics' )}
        </button>
      </Close>
        <button disabled={isDisabled} className={'burst-button burst-button--tertiary'} onClick={() => deleteGoal()}>
          {__( 'Delete goal', 'burst-statistics' )}
        </button>
      </>
  );
};

const DeleteGoalModal = ({goal, deleteGoal}) => {
    const [ isOpen, setOpen ] = useState( false );
    const [ isDisabled, setDisabled ] = useState( false );
    const handleClose = () => {
        setOpen( false );
    };
    const handleOpen = ( e ) => {
        e.preventDefault();
        setOpen( true );
    };

    const handleDelete = async() => {
        setDisabled( true );
        await deleteGoal();
        setDisabled( false );
        setOpen( false );
    };

  return (
      <>
      <Modal
          isOpen={isOpen}
          onClose={handleClose}
          title={__( 'Delete goal', 'burst-statistics' )}
          content={<Content goal={goal}/>}
          footer={<Footer deleteGoal={handleDelete} onClose={handleClose} isDisabled={isDisabled}/>}
      >
      </Modal>
        <button className="burst-button-icon burst-button-icon--delete" onClick={( e ) => handleOpen( e )}>
            <Icon name={'trash'} size={18}/>
        </button>
          </>
)
    ;
};

export default DeleteGoalModal;
