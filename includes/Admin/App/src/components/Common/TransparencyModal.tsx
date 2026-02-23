import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import Modal from './Modal';
import Icon from '@/utils/Icon';
import { burst_get_website_url } from '@/utils/lib';
import ButtonInput from '@/components/Inputs/ButtonInput';

/**
 * TransparencyModal component. Displays transparency information about data collection.
 *
 * @return {JSX.Element} The rendered TransparencyModal component.
 */
const TransparencyModal = () => {
	const [ isOpen, setIsOpen ] = useState( false );

	const handleOpen = () => {
		setIsOpen( true );
	};

	const handleClose = () => {
		setIsOpen( false );
	};

	const modalContent = (
		<div className="flex flex-col gap-6">
			{/* Section A: What is tracked */}
			<div>
                <p className="text-gray-700 mb-3">
                    {__( 'At Burst we don\'t believe in selling your data. We believe in privacy and transparency. That\'s why we\'re open about what data is tracked and how it\'s used.', 'burst-statistics' )}
                </p>
				<h3 className="text-lg font-semibold text-gray-900 mb-3">
					{__( 'What data is tracked on this website?', 'burst-statistics' )}
				</h3>
				<ul className="space-y-2">
					<li className="flex items-start gap-2">
						<Icon
							name="check"
							color="green"
							size={20}
							className="flex-shrink-0 mt-0.5"
						/>
						<span className="text-gray-700">
							{__( 'Device & browser', 'burst-statistics' )}
						</span>
					</li>
					<li className="flex items-start gap-2">
						<Icon
							name="check"
							color="green"
							size={20}
							className="flex-shrink-0 mt-0.5"
						/>
						<span className="text-gray-700">
							{__( 'Time of visit', 'burst-statistics' )}
						</span>
					</li>
					<li className="flex items-start gap-2">
						<Icon
							name="check"
							color="green"
							size={20}
							className="flex-shrink-0 mt-0.5"
						/>
						<span className="text-gray-700">
							{__( 'Page behavior & clicks', 'burst-statistics' )}
						</span>
					</li>
				</ul>
			</div>

			{/* Section B: Data Storage */}
			<div>
				<h3 className="text-lg font-semibold text-gray-900 mb-3">
					{__( 'Where is this data stored?', 'burst-statistics' )}
				</h3>
				<ul className="space-y-2">
					<li className="flex items-start gap-2 opacity-50">
						<Icon
							name="times"
							color="red"
							size={20}
							className="flex-shrink-0 mt-0.5"
						/>
						<span className="text-gray-700">
							{__( 'Third party servers: No.', 'burst-statistics' )}
						</span>
					</li>
					<li className="flex items-start gap-2 opacity-50">
						<Icon
							name="times"
							color="red"
							size={20}
							className="flex-shrink-0 mt-0.5"
						/>
						<span className="text-gray-700">
							{__( 'Burst Statistics servers: No.', 'burst-statistics' )}
						</span>
					</li>
					<li className="flex items-start gap-2">
						<Icon
							name="check"
							color="green"
							size={20}
							className="flex-shrink-0 mt-0.5"
						/>
						<div className="flex flex-col">
							<span className="text-gray-900 font-semibold">
								{__( 'Stored locally: Yes.', 'burst-statistics' )}
							</span>
							<span className="text-sm text-gray-600 mt-1">
								{__( 'Only the owner of this website can see, manage and share this data. No third parties have access to the data.', 'burst-statistics' )}
							</span>
						</div>
					</li>
				</ul>
			</div>

			{/* Section C: Footer / CTA */}
			<div className="bg-primary-light border border-primary/20 rounded-lg p-4">
				<p className="text-gray-800 mb-3">
					{__( 'Most analytics tools sell your data or store it on their cloud. Burst Statistics keeps it right here.', 'burst-statistics' )} <b>{__( 'We sell the tools for data collection, not the data itself.', 'burst-statistics' )}</b>
				</p>
				<a
					href={burst_get_website_url( '', {
						utm_source: 'transparency-modal',
						utm_medium: 'cta',
						utm_campaign: 'privacy-friendly-analytics'
					})}
					target="_blank"
					rel="noopener noreferrer"
					className="block w-full"
				>
					<ButtonInput
						btnVariant="primary"
						size="md"
						className="w-full"
					>
						{__( 'Discover Burst Statistics', 'burst-statistics' )}
					</ButtonInput>
				</a>
			</div>
		</div>
	);

	return (
		<>
			<button
				onClick={handleOpen}
				className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
			>
				<Icon name="help" color="gray" size={16} />
				<span className="font-medium">
					{__( 'See data collection details', 'burst-statistics' )}
				</span>
			</button>

			<Modal
				title={__( 'Transparency report', 'burst-statistics' )}
				content={modalContent}
				isOpen={isOpen}
				onClose={handleClose}
			/>
		</>
	);
};

TransparencyModal.displayName = 'TransparencyModal';

export default TransparencyModal;
