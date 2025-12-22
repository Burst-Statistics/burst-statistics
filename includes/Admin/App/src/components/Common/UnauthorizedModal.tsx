import React from 'react';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';
import { __ } from '@wordpress/i18n';
import { useRouter } from '@tanstack/react-router';

interface UnauthorizedModalProps {
	header?: string;
	message?: string;
	actionLabel?: string;
}

const UnauthorizedModal: React.FC<UnauthorizedModalProps> = ({
	header = __( 'Access Restricted', 'burst-statistics' ),
	message = __(
		'You don’t have permission to view this page.',
		'burst-statistics'
	),
	actionLabel = __( 'Go Back', 'burst-statistics' )
}) => {
	const router = useRouter();

	return (
		<div className="burst-upsell-overlay absolute inset-0 z-50">
			<div className="relative flex justify-center pt-8 m-8 mt-24">
				<div className="mx-4 min-w-fit rounded-md border border-gray-300 bg-gray-100 px-8 py-12 shadow-sm">
					<div className="max-w-lg text-center px-4">
						<div className="flex justify-center mb-6">
							<div className="flex items-center justify-center h-14 w-14 rounded-full bg-red-100">
								<Icon
									name="warning"
									color="red"
									size={30}
									strokeWidth={1.5}
								/>
							</div>
						</div>

						<h2 className="text-2xl font-semibold text-gray-900 mb-3">
							{header}
						</h2>

						<p className="text-gray-600 text-base mb-8 whitespace-pre-line">
							{message}
						</p>

						<div className="flex flex-col sm:flex-row justify-center items-center gap-4">
							<ButtonInput
								btnVariant="primary"
								size="lg"
								onClick={() => {
									router.history.go( -1 );
								}}
							>
								{actionLabel}
							</ButtonInput>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default UnauthorizedModal;
