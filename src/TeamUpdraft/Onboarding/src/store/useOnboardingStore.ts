import {create} from 'zustand';
import {updateAction} from '../utils/api';
import {__} from "@wordpress/i18n";


export interface Step {
    id: string;
    documentation?: string;
    title: string;
    subtitle: string;
    fields?: Array<{
        id: string;
        type?: string;
        label?: string;
        default?: string | boolean;
        options?: Array<{
            id: string;
            value: string;
            label: string;
        }>;
    }>;
    bullets?: string[];
    conditional_bullets?: Array<Record<string, string>>;
    button: {
        id: string;
        label: string;
    };
    visible?: boolean;
}

const getActionNiceName = (action: string, plugin: string ) => {
    let actionNiceName = '';
    switch (action) {
        case 'download':
            actionNiceName = __('...installing %s', 'burst-statistics').replace('%s', plugin);
            break;
        case 'activate':
            actionNiceName = __('...activating %s', 'burst-statistics').replace('%s', plugin);;
            break;
        case 'upgrade-to-pro':
        case 'installed':
        default:
            actionNiceName = '';
    }
    return actionNiceName;
}

export interface OnboardingState {
    isUpdating: boolean;
    isInstalling: boolean;
    responseMessage: string,
    footerMessage: string,
    responseSuccess: boolean,
    setResponseSuccess: (success: boolean) => void;
    setFooterMessage: (message: string) => void;
    onboardingData: Record<string, any>;
    isOpen: boolean;
    currentStepIndex: number;
    completedSteps: string[];
    steps: Step[];
    settings: Array<any>;
    trackingTestRunning: boolean;
    trackingTestCompleted: boolean;
    trackingTestSuccess: boolean;
    setOpen: (isOpen: boolean) => void;
    setCurrentStepIndex: (index: number) => void;
    getCurrentStep: () => Step;
    getCurrentStepDocumentation: () => string;
    getCurrentStepSolutions: () => [];
    setResponseMessage: (message: string) => void;
    addSuccessStep: (stepId: string) => void;
    getValue: (id: string) => string|boolean|any;
    isEdited: (id: string) => boolean;
    setValue: (id: string, value:string|boolean) => void;
    setSteps: (steps: Step[]) => void;
    updateEmail: () => Promise<void>;
    getSettings: () => Array<any>;
    updateStepSettings: (settings: Array<any> ) => Promise<void>;
    installPlugins: () => Promise<void>;
    validateLicense: () => Promise<boolean>;
    isLastStep: () => boolean;
    setTrackingTestRunning: (running: boolean) => void;
    setTrackingTestCompleted: (completed: boolean) => void;
    setTrackingTestSuccess: (success: boolean) => void;
}

// Zustand store
const useOnboardingStore = create<OnboardingState>((set) => ({
    isOpen: false,
    isUpdating: false,
    isInstalling: false,
    currentStepIndex: 0,
    responseMessage: '',
    footerMessage:'',
    trackingTestRunning: false,
    trackingTestCompleted: false,
    trackingTestSuccess: false,
    setFooterMessage: (message) => set({ footerMessage: message }),
    setResponseMessage: (message) => set({ responseMessage: message }),
    setTrackingTestRunning: (running) => set({ trackingTestRunning: running }),
    setTrackingTestCompleted: (completed) => set({ trackingTestCompleted: completed }),
    setTrackingTestSuccess: (success) => set({ trackingTestSuccess: success }),
    getCurrentStep: () => {
        const state = useOnboardingStore.getState();
        return state.steps[state.currentStepIndex];
    },
    getCurrentStepDocumentation: () => {
        const state = useOnboardingStore.getState();
        let stepDocumentation = state.steps[state.currentStepIndex]?.documentation;
        return stepDocumentation || state.onboardingData.documentation;
    },
    getCurrentStepSolutions: () => {
        const state = useOnboardingStore.getState();
        let stepSolutions = state.steps[state.currentStepIndex]?.solutions;
        return stepSolutions || [];
    },
    responseSuccess: true,
    setResponseSuccess: (success) => set({ responseSuccess: success }),
    completedSteps: [],
    onboardingData: window[`teamupdraft_onboarding`] || {},
    steps: [],
    setOpen: (isOpen) => set({ isOpen }),
    setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
    addSuccessStep: (stepId) => set((state) => ({ 
        completedSteps: [...state.completedSteps, stepId]
    })),
    isLastStep: () => {
        const state = useOnboardingStore.getState();
        return state.currentStepIndex === state.steps.length - 1;
    },
    settings: [],
    getSettings: () => {
        const state = useOnboardingStore.getState();
        if (state.settings.length > 0) {
            return state.settings;
        }
        const settings = state.onboardingData.fields;
        set({ settings: settings });
        return settings;
    },
    getValue: (id: string) => {
        const state = useOnboardingStore.getState();
        return state.settings.find((field) => field.id === id)?.value;
    },
    isEdited: (id: string) => {
        const state = useOnboardingStore.getState();
        return state.settings.find((field) => field.id === id)?.edited;
    },
    setValue: async (id: string, value: string | boolean) => {
        const state = useOnboardingStore.getState();
        let settings = await state.getSettings();

        const updated = settings.map((field) =>
            field.id === id ? { ...field, value, edited: true } : field
        );
        set({ settings: updated });
    },
    updateStepSettings: async (settings) => {
        set({ isUpdating: true });
        const currentStep = useOnboardingStore.getState().getCurrentStep();
        let data = {
            step:currentStep.id,
            settings:settings,
        }

        await updateAction( data, 'update_settings' );
        set({ isUpdating: false, settings: settings });
    },
    updateEmail: async () => {
        set({ isUpdating: true });
        const currentStep = useOnboardingStore.getState().getCurrentStep();
        const email = currentStep?.fields?.find(f => f.type === 'email')?.value ?? null;
        const tipsTricks = currentStep?.fields?.find(f => f.type === 'checkbox')?.value ?? null;
        let data = {
                step:currentStep.id,
                email:email,
                tips_tricks:tipsTricks,
            }

        await updateAction( data, 'update_email' );
        set({ isUpdating: false });
    },
    validateLicense: async ( ) => {
        set({ isUpdating: true });
        const license = useOnboardingStore.getState().getValue('license');
        const currentStep = useOnboardingStore.getState().getCurrentStep();
        const email = currentStep?.fields?.find(f => f.type === 'email')?.value ?? null;
        const password = currentStep?.fields?.find(f => f.type === 'password')?.value ?? null;

        let data = {
            license:license,
            email:email,
            password:password,
        }
        let response = await updateAction(data, 'activate_license');
        set({ isUpdating: false });

        if ( response?.success ){
            set({ responseSuccess: true, responseMessage:'' });
        } else {
            set({ responseSuccess: false, responseMessage:response?.message });
        }
        return response?.success;

    },

    installPlugins: async () => {
        const plugins = useOnboardingStore.getState().getValue('plugins')
        const currentStep = useOnboardingStore.getState().getCurrentStep();
        set({isInstalling: true} );
        const pluginData = currentStep.fields;
        // Loop through the plugins and install each one
        for (const plugin of plugins) {
            //from pluginData, get the field with the same id as the plugin, and retrieve the action
            const field = pluginData.find((field) => field.id === plugin);
            let next_action = field?.action || 'download';
            let previous_action = null;
            while (true) {
                if (
                    next_action === 'installed' ||
                    next_action === 'upgrade-to-pro' ||
                    next_action === undefined ||
                    next_action === previous_action
                ) {
                    set({ footerMessage: "" });
                    break;
                }
                set({ footerMessage: getActionNiceName(next_action, plugin) });
                let data = {
                    plugin: plugin
                }

                let response = await updateAction(data, next_action);
                previous_action = next_action;
                next_action = response?.data?.next_action;
            }
        }
        set({isInstalling: false} );
    },

    setSteps: (steps) => set({ steps }),
}));

export default useOnboardingStore; 