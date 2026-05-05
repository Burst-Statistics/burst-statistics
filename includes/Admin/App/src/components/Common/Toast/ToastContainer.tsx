import { useToastStore } from '@/utils/toast';
import { Toast } from './Toast';

/**
 * Renders all active toasts in the app tree so styles inherit from #burst-statistics.
 */
export const BurstToastContainer: React.FC = () => {
	const toasts = useToastStore( ( state ) => state.toasts );

	return (
		<div
			className="fixed bottom-4 right-4 z-[100000] flex flex-col gap-2 pointer-events-none"
			aria-label="Notifications"
		>
			{ toasts.map( ( item ) => (
				<div key={ item.id } className="pointer-events-auto">
					<Toast toast={ item } />
				</div>
			) ) }
		</div>
	);
};
