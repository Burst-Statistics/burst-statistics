import { __ } from '@wordpress/i18n';
import useOnboardingStore from "@/store/useOnboardingStore";
import Hyperlink from "@/utils/Hyperlink.js";
import ButtonInput from "@/components/Inputs/ButtonInput";
import {get_website_url} from "@/utils/lib.js";

const Support = ({handleManualRetry, isRunning}) => {
    const {
        onboardingData,
        getCurrentStepDocumentation,
        getCurrentStepSolutions,
    } = useOnboardingStore();
    let documentation = getCurrentStepDocumentation();

    const articleUrl = get_website_url(documentation, {
        utm_source: onboardingData.prefix + '_onboarding',
        utm_content: 'documentation'
    });
    const supportUrl = get_website_url(onboardingData.support, {
        utm_source: onboardingData.prefix + '_onboarding',
        utm_content: 'support'
    });
    const solutions = getCurrentStepSolutions();
    return (
        <div className="mt-4 max-w-md mx-auto bg-gray-200 border border-gray-300 rounded-lg p-4">
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                {solutions.map((text, index) => (
                    <li key={index}>{text}</li>
                ))}
                <li>
                    <Hyperlink
                        className={'text-blue-600 hover:text-blue-800 underline'}
                        url={articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        text={__('For more information, please see our %stroubleshooting article%s.', 'burst-statistics')}
                    />
                </li>
                <li>
                    {onboardingData.is_pro ? (
                        <>
                            <Hyperlink
                                className={'text-blue-600 hover:text-blue-800 underline'}
                                url={articleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                text={__('If you are still having issues, please %scontact support%s.', 'burst-statistics')}
                            />
                        </>
                    ) : (
                        <>
                            <Hyperlink
                                className={'text-blue-600 hover:text-blue-800 underline'}
                                url={supportUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                text={__('If you are still having issues, please %sopen a ticket%s on the WordPress.org support forum.', 'burst-statistics')}
                            />
                        </>
                    )}
                </li>
            </ul>
            <div className="mt-4 max-w-md mx-auto flex justify-center">
                <ButtonInput
                    className="w-full"
                    btnVariant="tertiary"
                    size="sm"
                    onClick={() => handleManualRetry()}
                    disabled={isRunning}
                >
                    {__("Retry test", "burst-statistics")}
                </ButtonInput>
            </div>
        </div>
    );
};

export default Support;