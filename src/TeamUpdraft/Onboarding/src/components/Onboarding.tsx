import {useEffect, memo, useMemo, useState} from "@wordpress/element";
import type { FC } from '@wordpress/element';
import Modal from "./Modal/Modal";
import ProgressBar from "./ProgressBar";
import ButtonInput from "./Inputs/ButtonInput";
import { ErrorBoundary } from './ErrorBoundary';
import useOnboardingStore from "../store/useOnboardingStore";
import ModalContent from "./Modal/ModalContent";
import { sprintf, __ } from '@wordpress/i18n';
import Icon from "../utils/Icon";

/**
 * Onboarding component that guides users through a series of steps
 * @returns {JSX.Element} The Onboarding component
 */
const Onboarding: FC = () => {
    const [ConfettiExplosion, setConfettiExplosion] = useState(null);
    const [isExploding, setIsExploding] = useState(false);

    const {
        isOpen,
        isUpdating,
        currentStepIndex,
        steps,
        setOpen,
        setCurrentStepIndex,
        addSuccessStep,
        setSteps,
        onboardingData,
        setResponseMessage,
        setResponseSuccess,
        responseMessage,
        responseSuccess,
        updateEmail,
        updateStepSettings,
        installPlugins,
        validateLicense,
        footerMessage,
        settings,
        setValue,
        getSettings,
        isLastStep,
        trackingTestRunning,
        isInstalling,
    } = useOnboardingStore();

    useEffect(() => {
        if ( !!isLastStep() ) {
            import ( "react-confetti-explosion").then(
                ({default: ConfettiExplosion}) => {
                    setConfettiExplosion(() => ConfettiExplosion);
                });
            setIsExploding(true);
        }
    }, [isLastStep()]);

    // Memoize the settings and visible steps to prevent unnecessary recalculations
    const visibleSteps = useMemo(() => onboardingData.steps?.filter(step => step.visible !== false) || [], [onboardingData.steps]);
    const currentStep = visibleSteps[currentStepIndex];

    // Initialize steps only once when the component mounts
    useEffect(() => {

        if (visibleSteps.length > 0 && steps.length === 0) {
            setSteps(visibleSteps);
        }
    }, [visibleSteps, steps.length, setSteps]);

    useEffect(() => {
        if ( settings.length === 0 ) {
            getSettings();
        }
    }, [settings]);


    const handleClose = () => {
        setOpen(false);
    };

    const handlePrevious = () => {
        setCurrentStepIndex(currentStepIndex - 1);
    };

    const validateAndContinue = async (e) => {
        let success = true;
        if ( currentStep.type === 'license' ) {
            success = await validateLicense();
        }

        //save the current values
        if ( currentStep.type === 'settings' ) {
            await updateStepSettings(settings);
        }

        if ( currentStep.type === 'email' ) {
            await updateEmail();
        }

        if (currentStep.type === 'plugins'){
            //we don't wait for the plugins to be installed, so the user can continue.
            installPlugins();
        }

        if ( !success ) {
            return;
        }
        await handleContinue(e);
    }

    const changeFieldValue = async (fieldId: string, value: string | boolean) => {
        setValue(fieldId, value);
    };

    // Function to determine if the continue button should be disabled.
    const isContinueDisabled = () => {
        // For tracking test step, only disable continue button while test is running.
        if (currentStep?.id === 'tracking') {
            return trackingTestRunning;
        }

        // we don't want to close the modal during installation. Otherwise it might not complete.
        if ( isLastStep() && isInstalling ) {
            return true;
        }

        return false;
    };

    const handleContinue = async (e) => {

        // make sure the response message is cleared
        setResponseMessage('');
        setResponseSuccess(true);

        if (settings && currentStep.fields) {
            const atLeastOneFieldIsTrue = currentStep.fields.some((field: { id: string }) => {
                const value = settings[field.id];
                return value === true || (typeof value === 'string' && value.trim() !== '');
            });
            if (atLeastOneFieldIsTrue) {
                addSuccessStep(currentStep.id);
            }
        }

        setCurrentStepIndex(currentStepIndex + 1);
    };

    //open the modal when the component mounts
    useEffect(() => {
        setOpen(true);
    }, []);

    if (!currentStep) {
        return null;
    }

    return (
        <ErrorBoundary>
            <div id="onboarding-modal-root"></div>

            <Modal
                logo={onboardingData.logo}
                title={__('Onboarding', 'burst-statistics')}
                content={
                    <div className="flex flex-col gap-2 my-6 mx-10">
                        <div className="flex flex-col gap-2 my-6 justify-center items-center">
                            <div className="text-sm text-gray-600">
                                {sprintf(__('Step %1$d of %2$d', 'burst-statistics'), currentStepIndex + 1, steps.length)}
                            </div>

                            <ProgressBar
                                currentStep={currentStepIndex}
                                totalSteps={steps.length}
                            />

                            <div className="text-2xl font-bold text-gray-800 text-center mt-4">
                                {currentStep.title}
                            </div>

                            <ModalContent
                                step={currentStep}
                                settings={settings}
                                onFieldChange={changeFieldValue}
                            />
                            {responseMessage && (
                                <div className={"text-red-600 text-sm text-center mt-4 "+ (responseSuccess ? "text-green-600" : "text-red-600")}>
                                    {responseMessage}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-4 justify-center items-center mb-6 min-w-[32ch] mx-auto">
                            { ( !!isLastStep() && !onboardingData.is_pro ) && (
                                <ButtonInput
                                    className="w-full"
                                    btnVariant="secondary"
                                    size="lg"
                                    link={onboardingData.upgrade}
                                    key="upgrade-to-pro"
                                >
                                    {__('Check out Burst Pro', 'burst-statistics')}
                                </ButtonInput>
                            )}

                            <ButtonInput
                                className="w-full burst-continue flex justify-center items-center"
                                btnVariant={isLastStep() ? "tertiary" : "secondary"}
                                size={isLastStep() ? "md" : "lg"}
                                disabled={isContinueDisabled()}
                                onClick={(e) =>validateAndContinue(e)}
                                key={currentStep.id + "continue"}
                            >
                                { (isUpdating || isInstalling) && <Icon name="loading-circle" size={18} color={isLastStep() ? "black" : "white"} className="mr-[10px]" />}{currentStep.button.label}
                            </ButtonInput>

                            {( currentStepIndex > 0 && !isLastStep() ) && (
                                <>
                                    <ButtonInput
                                        className="w-full burst-skip"
                                        btnVariant="tertiary"
                                        size="sm"
                                        onClick={(e) => handleContinue(e)}
                                        key={currentStep.id + "skip"}
                                    >
                                        {__('Skip', 'burst-statistics')}
                                    </ButtonInput>

                                    <ButtonInput
                                        className="w-full"
                                        btnVariant="tertiary"
                                        size="sm"
                                        onClick={(e) => handlePrevious() }
                                        key={currentStep.id + "previous"}
                                    >
                                        {__('Previous', 'burst-statistics')}
                                    </ButtonInput>
                                </>

                            )}

                            {currentStepIndex === 0 && (
                                <ButtonInput
                                    className="w-full burst-skip"
                                    btnVariant="tertiary"
                                    size="sm"
                                    onClick={handleClose}
                                    key="skip-onboarding"
                                >
                                    {__('Skip onboarding', 'burst-statistics')}
                                </ButtonInput>
                            )}
                        </div>
                        {footerMessage && (
                            <div className="text-sm text-gray-600 text-center">
                                {footerMessage}
                            </div>
                        )}
                    </div>
                }
                isOpen={isOpen}
                onClose={handleClose}
                footer={null}
                triggerClassName=""
                children={null}
            />
            {isExploding && ConfettiExplosion && <div className="absolute top-1/4 left-1/2 -translate-x-1/2"><ConfettiExplosion duration={4000} width={1400} particleCount={200} force={0.7} zIndex={999999}/></div>}
        </ErrorBoundary>
    );
};

export default memo(Onboarding); 