import React from 'react';
import { useRouter } from '@tanstack/react-router';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';

interface AccessStateModalProps {
	header: string;
	message: string;
	actionLabel: string;
	iconName: string;
	iconColor: string;
	iconBgClassName: string;
	headingClassName: string;
	messageClassName: string;
}

const AccessStateModal: React.FC<AccessStateModalProps> = ({
	header,
	message,
	actionLabel,
	iconName,
	iconColor,
	iconBgClassName,
	headingClassName,
	messageClassName
}) => {
	const router = useRouter();

	return (
		<div className="burst-upsell-overlay absolute inset-0 z-50">
			<div className="relative flex justify-center pt-8 m-8 mt-24">
				<div className="mx-4 min-w-fit rounded-md border border-gray-300 bg-gray-100 px-8 py-12 shadow-sm">
					<div className="max-w-lg text-center px-4">
						<div className="flex justify-center mb-6">
							<div className={`flex items-center justify-center h-14 w-14 rounded-full ${iconBgClassName}`}>
								<Icon
									name={iconName}
									color={iconColor}
									size={30}
									strokeWidth={1.5}
								/>
							</div>
						</div>

						<h2 className={`text-2xl font-semibold mb-3 ${headingClassName}`}>
							{header}
						</h2>

						<p className={`text-base mb-8 whitespace-pre-line ${messageClassName}`}>
							{message}
						</p>

						<div className="flex flex-col @sm:flex-row justify-center items-center gap-4">
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

export default AccessStateModal;
