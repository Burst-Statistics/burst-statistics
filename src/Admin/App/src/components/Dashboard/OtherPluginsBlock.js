import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import * as burst_api from '@//utils/api';
import Block from '@/components/Blocks/Block';
import BlockHeading from '@/components/Blocks/BlockHeading';
import BlockContent from '@/components/Blocks/BlockContent';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const OtherPluginsBlock = () => {
  const queryClient = useQueryClient();

  // Define pluginActionNice first, before it's used in the useQuery hook
  const pluginActionNice = ( pluginAction ) => {
    const statuses = {
      download: __( 'Install', 'burst-statistics' ),
      activate: __( 'Activate', 'burst-statistics' ),
      activating: __( 'Activating...', 'burst-statistics' ),
      downloading: __( 'Downloading...', 'burst-statistics' ),
      'upgrade-to-pro': __( 'Downloading...', 'burst-statistics' )
    };
    return statuses[pluginAction];
  };

  // Use TanStack Query for data fetching and state management
  // This replaces both the useEffect and the Zustand store
  const {
    data: pluginData = [],
    isLoading
  } = useQuery({
    queryKey: [ 'otherPluginsData' ],
    queryFn: async() => {
      const response = await burst_api.doAction( 'otherpluginsdata' );

      // Process the plugin data
      return response.map( pluginItem => ({
        ...pluginItem,
        pluginActionNice: pluginActionNice( pluginItem.pluginAction )
      }) );
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
        return oldData.map( plugin => {
          if ( plugin.slug === slug ) {
            return {
              ...response,
              pluginActionNice: pluginActionNice( response.pluginAction )
            };
          }
          return plugin;
        });
      });

      // If response has a next action, trigger it
      if ( response.pluginAction &&
          'installed' !== response.pluginAction &&
          'upgrade-to-pro' !== response.pluginAction ) {
        handlePluginAction( slug, response.pluginAction );
      }
    }
  });

  const getPluginData = ( slug ) => {
    return pluginData.find( plugin => plugin.slug === slug );
  };

  const handlePluginAction = ( slug, pluginAction, e ) => {
    if ( e ) {
      e.preventDefault();
    }

    if ( 'installed' === pluginAction || 'upgrade-to-pro' === pluginAction ) {
      return;
    }

    const plugin = getPluginData( slug );
    if ( ! plugin ) {
return;
}

    // Update UI immediately for better UX
    queryClient.setQueryData([ 'otherPluginsData' ], ( oldData ) => {
      return oldData.map( item => {
        if ( item.slug === slug ) {
          const updatedAction = 'download' === pluginAction ? 'downloading' :
                              'activate' === pluginAction ? 'activating' :
                              pluginAction;

          return {
            ...item,
            pluginAction: updatedAction,
            pluginActionNice: pluginActionNice( updatedAction )
          };
        }
        return item;
      });
    });

    // Call the API
    pluginActionMutation.mutate({
      slug,
      pluginAction
    });
  };

  const otherPluginElement = ( plugin, i ) => {
    return (
      <div
        key={i}
        className={'burst-other-plugins-element burst-' + plugin.slug}
      >
        <a
          href={plugin.wordpress_url}
          target="_blank"
          title={plugin.title}
        >
          <div className="burst-bullet"></div>
          <div className="burst-other-plugins-content">{plugin.title}</div>
        </a>
        <div className="burst-other-plugin-status">
          {'upgrade-to-pro' === plugin.pluginAction && (
            <>
              <a target="_blank" href={plugin.upgrade_url}>
                {__( 'Upgrade', 'burst-statistics' )}
              </a>
            </>
          )}
          {'upgrade-to-pro' !== plugin.pluginAction &&
            'installed' !== plugin.pluginAction && (
              <>
                <a
                  href="#"
                  onClick={( e ) =>
                    handlePluginAction( plugin.slug, plugin.pluginAction, e )
                  }
                >
                  {plugin.pluginActionNice}
                </a>
              </>
            )}
          {'installed' === plugin.pluginAction && (
            <>{__( 'Installed', 'burst-statistics' )}</>
          )}
        </div>
      </div>
    );
  };

  if ( isLoading ) {
    const n = 3;
    return (
      <Block className="bg-wp-gray row-span-1 shadow-none lg:col-span-6">
        <BlockHeading
          className={'burst-column-2 no-border no-background'}
          title={__( 'Other plugins', 'burst-statistics' )}
        />
        <BlockContent className={'px-6 py-0'}>
          <div className="burst-other-plugins-container">
            {[ ...Array( n ) ].map( ( e, i ) => (
              <div key={i} className={'burst-other-plugins-element'}>
                <a>
                  <div className="burst-bullet"></div>
                  <div className="burst-other-plugins-content">
                    {__( 'Loading..', 'burst-statistics' )}
                  </div>
                </a>
                <div className="burst-other-plugin-status">
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
    <Block className="bg-wp-gray row-span-1 shadow-none lg:col-span-6">
      <BlockHeading title={__( 'Other plugins', 'burst-statistics' )} />
      <BlockContent className={'px-6 py-0'}>
        <div className="burst-other-plugins-container">
          {pluginData.map( ( plugin, i ) => otherPluginElement( plugin, i ) )}
        </div>
      </BlockContent>
    </Block>
  );
};

export default OtherPluginsBlock;
