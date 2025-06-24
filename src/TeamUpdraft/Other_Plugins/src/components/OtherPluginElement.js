import {__} from "@wordpress/i18n";
import usePluginStore from "../store/usePluginStore";
import Icon from "@/utils/Icon";

const OtherPluginElement = ({ wordpress_url, action, title, upgrade_url, slug }) => {
    const { installPlugin } = usePluginStore();

    const handlePluginAction = async (slug, action, e) => {
        e.preventDefault();
        await installPlugin(slug, action);
    };

    const pluginActionNice = (action) => {
        const statuses = {
            download: __('Install', 'burst-statistics'),
            activate: __('Activate', 'burst-statistics'),
            activating: __('Activating...', 'burst-statistics'),
            downloading: __('Downloading...', 'burst-statistics'),
            'upgrade-to-pro': __('Downloading...', 'burst-statistics'),
        };
        return statuses[action];
    };

    const iconProps = {
        name: ['installed', 'upgrade-to-pro', 'activate'].includes(action) ? 'circle-check' : 'circle-open',
        color: ['installed', 'upgrade-to-pro'].includes(action) ? 'green' : 'gray',
    };
    return (
        <div className="w-full flex justify-between items-center gap-2 rounded-md">
            <a
                href={wordpress_url}
                target="_blank"
                title={title}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-600 hover:underline"
            >
                <Icon {...iconProps} size={14} />
                <div className="whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
                    {title}
                </div>
            </a>
            <div className="min-w-fit text-sm text-gray-600">
                {action === 'upgrade-to-pro' && (
                    <a
                        target="_blank"
                        href={upgrade_url}
                        className="text-blue-600 hover:underline"
                    >
                        {__('Upgrade', 'burst-statistics')}
                    </a>
                )}
                {action !== 'upgrade-to-pro' && action !== 'installed' && (
                    <a
                        href="#"
                        onClick={(e) => handlePluginAction(slug, action, e)}
                        className="text-blue-600 hover:underline"
                    >
                        {pluginActionNice(action)}
                    </a>
                )}
                {action === 'installed' && (
                    <span className="text-green-700">
                        {__('Installed', 'burst-statistics')}
                    </span>
                )}
            </div>
        </div>
    );
};

export default OtherPluginElement;
