import Modal from '@/components/Common/Modal';
import { formatUnixToDate } from '../../utils/formatting';
import { __ } from '@wordpress/i18n';
import { Close } from '@radix-ui/react-dialog';
import { useState } from 'react';
import ButtonInput from '../Inputs/ButtonInput';
import IconButton from '../Inputs/IconButton';

const Content = ({ goal }) => (
	<>
		{__( 'Are you sure you want to delete this goal?', 'burst-statistics' ) +
			' ' +
			__( 'This action cannot be undone.', 'burst-statistics' )}
		<br />
		<br />
		<strong>{__( 'Goal name', 'burst-statistics' )}:</strong> {goal.name}
		<br />
		<strong>{__( 'Status', 'burst-statistics' )}:</strong> {goal.status}
		<br />
		<strong>{__( 'Date created', 'burst-statistics' )}:</strong>{' '}
		{formatUnixToDate( goal.dateCreated )}
	</>
);

const Footer = ({ deleteGoal, onClose, isDisabled }) => {
	return (
		<>
			<Close asChild aria-label="Close">
			<ButtonInput btnVariant={'tertiary'} onClick={onClose}>
				{__( 'Cancel', 'burst-statistics' )}
			</ButtonInput>

			</Close>
			<ButtonInput btnVariant={'secondary'} onClick={deleteGoal} disabled={isDisabled}>
				{__( 'Delete goal', 'burst-statistics' )}
			</ButtonInput>
		</>
	);
};

const DeleteGoalModal = ({ goal, deleteGoal }) => {
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
				content={<Content goal={goal} />}
				footer={
					<Footer
						deleteGoal={handleDelete}
						onClose={handleClose}
						isDisabled={isDisabled}
					/>
				}
			></Modal>
			<IconButton
				icon={'trash'}
				size={'md'}
				onClick={( e ) => handleOpen( e )}
				ariaLabel={__( 'Delete goal', 'burst-statistics' )}
				variant={'solid'}
				disabled={isDisabled}
			/>
		</>
	);
};

export default DeleteGoalModal;
