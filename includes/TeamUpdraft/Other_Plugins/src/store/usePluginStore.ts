import { create } from 'zustand';
import { updateAction } from '../utils/api';
export interface pluginState {
    plugins: Array<any>;
    getPlugins: () => void;
    data: any;
    updatePluginAction: (plugin: string, action:string) => void;
    installPlugin: (plugin: string, action: string ) => Promise<void>;
}

// Zustand store
const usePluginStore = create<pluginState>((set) => ({
    plugins:[],
    getPlugins: async () => {
        const state = usePluginStore.getState();
        const plugins = Object.values(state.data.plugins || {});
        set({ plugins: plugins});
    },
    updatePluginAction: ( plugin, action ) => {
        const state = usePluginStore.getState();
        const plugins = state.plugins;
        const updatedPlugins = plugins.map(p =>
            p.id === plugin ? { ...p, action: action } : p
        );
        set({ plugins: updatedPlugins});
    },
    data: window[`teamupdraft_otherplugins`] || {},
    installPlugin: async (plugin, action) => {
        let next_action = action;
        let previous_action = null;
        const state = usePluginStore.getState();
        while (true) {
            if (
                next_action === 'installed' ||
                next_action === 'upgrade-to-pro' ||
                next_action === undefined ||
                next_action === previous_action
            ) {
                break;
            }
            let data = {
                plugin: plugin
            }
            let waitingAction = 'downloading';
            if (next_action === 'activate') {
                waitingAction = 'activating';
            }
            state.updatePluginAction(plugin, waitingAction);
            let response = await updateAction(data, next_action);
            previous_action = next_action;
            next_action = response?.data?.next_action;
            state.updatePluginAction(plugin, next_action);
        }

    },
}));

export default usePluginStore;