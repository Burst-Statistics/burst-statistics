import {__} from '@wordpress/i18n';
import * as burst_api from '@//utils/api';
import {Block} from '@/components/Blocks/Block';
import {BlockHeading} from '@/components/Blocks/BlockHeading';
import {BlockContent} from '@/components/Blocks/BlockContent';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import Icon from "@/utils/Icon";
import UpdraftPlusLogo from "@/utils/UpdraftPlusLogo";
const OtherPluginsBlock = () => {
  const queryClient = useQueryClient();

  // Define pluginActionNice first, before it's used in the useQuery hook
  const pluginActionNice = ( action ) => {
    const statuses = {
      download: __( 'Install', 'burst-statistics' ),
      activate: __( 'Activate', 'burst-statistics' ),
      activating: __( 'Activating...', 'burst-statistics' ),
      downloading: __( 'Downloading...', 'burst-statistics' ),
      'upgrade-to-pro': __( 'Downloading...', 'burst-statistics' )
    };
    return statuses[action];
  };

  // Use TanStack Query for data fetching and state management
  // This replaces both the useEffect and the Zustand store
  const {
    data: pluginData = [],
    isLoading
  } = useQuery({
    queryKey: [ 'otherPluginsData' ],
    queryFn: async() => {
      let response = await burst_api.doAction( 'otherpluginsdata' );
      response = Object.values(response);
      // Process the plugin data
      return response.map(pluginItem => ({
         ...pluginItem,
         pluginActionNice: pluginActionNice(pluginItem.action)
       }));
    },

    // Only fetch once when component mounts
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  // Use useMutation for plugin actions with proper cache updates
  const pluginActionMutation = useMutation({
    mutationFn: async( data ) => {
      return await burst_api.doAction( 'plugin_actions', data );
    },
    onSuccess: ( response, variables ) => {
      const { slug } = variables;
      // Update the queryClient cache directly instead of using state
      queryClient.setQueryData([ 'otherPluginsData' ], ( oldData ) => {
        return oldData.map(plugin => {
          if (plugin.slug === slug) {
            return {
              ...response,
              pluginActionNice: pluginActionNice(response.action)
            };
          }
          return plugin;
        });
      });

      // If response has a next action, trigger it
      if ( response.action &&
          'installed' !== response.action &&
          'upgrade-to-pro' !== response.action ) {
        handlePluginAction( slug, response.action );
      }
    }
  });

  const getPluginData = ( slug ) => {
    return pluginData.find( plugin => plugin.slug === slug );
  };

  const handlePluginAction = ( slug, action, e ) => {
    if ( e ) {
      e.preventDefault();
    }

    if ( 'installed' === action || 'upgrade-to-pro' === action ) {
      return;
    }

    const plugin = getPluginData( slug );
    if ( ! plugin ) {
      return;
    }

    queryClient.setQueryData([ 'otherPluginsData' ], ( oldData ) => {
      return oldData.map( item => {
        if ( item.slug === slug ) {
          const updatedAction = 'download' === action ? 'downloading' :
                              'activate' === action ? 'activating' :
                                  action;

          return {
            ...item,
            action: updatedAction,
            pluginActionNice: pluginActionNice( updatedAction )
          };
        }
        return item;
      });
    });

    // Call the API
    pluginActionMutation.mutate({
      slug,
      action
    });
  };

  const otherPluginElement = ( plugin ) => {
    let iconName, iconColor;
    
    if (['installed', 'upgrade-to-pro'].includes(plugin.action)) {
      iconName = 'check';
      iconColor = 'white';
    } else if (['activate'].includes(plugin.action)) {
      iconName = 'check';
      iconColor = 'gray';
    } else {
      iconName = 'circle-open';
      iconColor = 'gray';
    }

    let defaultColorClass = 'gray-400';

    switch ( plugin.slug ) {
      case 'really-simple-ssl':
        defaultColorClass = 'yellow';
        break;
      case 'burst-statistics':
        defaultColorClass = 'green';
        break;
      case 'complianz-gdpr':
        defaultColorClass = 'blue';
        break;
      case 'complianz-terms-conditions':
        defaultColorClass = 'black';
        break;
    }
    
    return (
      <div
        className={`
        burst-other-plugins-element burst-${plugin.slug}
        w-full
        flex
        content-between
        justify-between
        gap-[10px]
        [&_a]:w-max
        [&_a]:text-gray
        [&_a]:transition-colors
        [&_a]:duration-300
        [&_a]:ease-in-out
        [&_a]:flex
        [&_a]:items-center
        [&_a]:min-w-0
        [&_a]:gap-2.5
        [&_a]:no-underline
        [&_a:hover]:underline
        [&_a:hover]:text-${defaultColorClass}
    	[&_a>.burst-bullet:hover]:bg-${defaultColorClass}`}
      >
        <a
          href={plugin.wordpress_url}
          target="_blank"
          title={plugin.title}
        >
          
          <div className={['installed', 'upgrade-to-pro'].includes(plugin.action) ? 'bg-green rounded-full' : ''}>
            <Icon strokeWidth={3} name={iconName} color={iconColor} size={14} /></div>
          <div className="truncate">{plugin.title}</div>
        </a>
        <div className="min-w-fit burst-other-plugin-status">
          {'upgrade-to-pro' === plugin.action && (
              <a target="_blank" href={plugin.upgrade_url}>
                {__( 'Upgrade', 'burst-statistics' )}
              </a>
          )}
          {'upgrade-to-pro' !== plugin.action &&
            'installed' !== plugin.action && (
                <a
                  href="#"
                  onClick={( e ) =>
                    handlePluginAction( plugin.slug, plugin.action, e )
                  }
                >
                  {plugin.pluginActionNice}
                </a>
            )}
          {'installed' === plugin.action && (
            <>{__( 'Installed', 'burst-statistics' )}</>
          )}
        </div>
      </div>
    );
  };

  if ( isLoading ) {
    const n = 3;
    return (
      <Block className="bg-wp-gray row-span-1 shadow-transparent border-wp-gray lg:col-span-6">
        <BlockHeading
          className={'burst-column-2 no-border no-background'}
          title={__( 'Other plugins', 'burst-statistics' )}
          controls={<UpdraftPlusLogo size={24} color="gray"/> }
        />
        <BlockContent className={'px-6 py-0'}>
          <div className="!flex flex-row flex-wrap mb-[10px] text-base gap-1.5 max-[992px]:flex-row max-[992px]:overflow-hidden">
            {[ ...Array( n ) ].map( ( e, i ) => (
              <div key={i}>
                <a>
                  <div className={`bg-gray-400 transition-colors duration-300 ease-in-out`}></div>
                  <div className="truncate">
                    {__( 'Loading..', 'burst-statistics' )}
                  </div>
                </a>
                <div className="min-w-fit burst-other-plugin-status">
                  {__( 'Activate', 'burst-statistics' )}
                </div>
              </div>
            ) )}
          </div>
        </BlockContent>
      </Block>
    );
  }
  return (
    <Block className="bg-wp-gray row-span-1 shadow-transparent border-wp-gray lg:col-span-6">
      <BlockHeading title={__( 'Other plugins', 'burst-statistics' )}
                    controls={<UpdraftPlusLogo size={24} color="gray"/>}
      />
      <BlockContent className={'px-6 py-0'}>
        <div className="!flex flex-row flex-wrap mb-[10px] text-base gap-1.5 max-[992px]:flex-row max-[992px]:overflow-hidden">
          {pluginData.map( ( plugin ) => otherPluginElement( plugin ) )}
        </div>
      </BlockContent>
    </Block>
  );
};

export default OtherPluginsBlock;
