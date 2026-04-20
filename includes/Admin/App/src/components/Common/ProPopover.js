import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import Icon from '../../utils/Icon';
import { __ } from '@wordpress/i18n';

const ProPopover = ({
	children,
	className,
	title,
	subtitle,
	bulletPoints = [], // array of objects with text and icon for bullet points
	primaryButtonUrl,
	secondaryButtonUrl
}) => {
	const [ open, setOpen ] = useState( false );

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger
				className={`cursor-pointer ${className}`}
				onMouseEnter={() => setOpen( true )}
			>
				{children}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					className="z-9999 min-w-[320px] max-w-[400px] rounded-lg border border-gray-200 bg-white p-0 shadow-xl"
					align={'end'}
					sideOffset={10}
					arrowPadding={10}
				>
					<Popover.Arrow className="fill-white drop-shadow-sm" />
					<div className="relative border-b border-gray-100 px-6 py-4">
						<Popover.Close className="absolute right-3 top-3 rounded-full p-1 transition-colors hover:bg-gray-100">
							<Icon name={'times'} size={16} />
						</Popover.Close>
						<h5 className="mb-1 pr-8 text-lg font-semibold text-text-black">
							{title}
						</h5>
						<h6 className="m-0 text-sm text-text-gray">{subtitle}</h6>
					</div>
					<div className="px-6 py-4">
						<p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-gray">
							{__( 'Pro features include:', 'burst-statistics' )}
						</p>
						<div className="flex flex-col gap-2">
							{bulletPoints.map( ({ text, icon }) => (
								<div
									key={'bullet-' + text}
									className="flex items-center gap-3"
								>
									<div className="flex h-5 w-5 shrink-0 items-center justify-center">
										<Icon
											name={icon}
											size={16}
											color="var(--color-primary-700)"
										/>
									</div>
									<p className="m-0 text-sm text-text-gray">
										{text}
									</p>
								</div>
							) )}
						</div>
					</div>
					<div className="flex flex-col gap-2 rounded-b-lg border-t border-gray-100 bg-gray-50 px-6 py-4">
						<a
							href={primaryButtonUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="w-full rounded bg-primary px-4 py-1 text-center text-base font-normal text-text-white no-underline transition-all duration-200 hover:bg-primary hover:shadow-ringPrimary"
						>
							{__( 'Upgrade to Pro', 'burst-statistics' )}
						</a>
						<a
							href={secondaryButtonUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="w-full rounded border border-gray-400 bg-gray-100 px-4 py-1 text-center text-base font-normal text-text-gray no-underline transition-all duration-200 hover:bg-gray-200 hover:text-text-gray hover:shadow-ringNeutral"
						>
							{__( 'Learn More', 'burst-statistics' )}
						</a>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
};

export default ProPopover;
