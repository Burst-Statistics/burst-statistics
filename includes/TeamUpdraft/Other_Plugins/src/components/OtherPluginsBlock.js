import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import usePluginStore from "@/store/usePluginStore";
import OtherPluginElement from "./OtherPluginElement";

const OtherPluginsBlock = () => {
  const {
    plugins,
    getPlugins,
  } = usePluginStore();

  useEffect(() => {
    if (plugins.length === 0) {
      getPlugins();
    }
  }, []);

console.log("plugins", plugins);
  return (
      <Block className="bg-wp-gray shadow-none row-span-1 lg:col-span-6">
        <BlockHeading title={__('Other plugins', 'burst-statistics')} />
        <BlockContent className="px-6 py-0">
          <div className="flex flex-wrap gap-2 mb-4 text-sm leading-relaxed">
              {plugins.map((plugin) => (
                  <OtherPluginElement key={plugin.slug} {...plugin} />
              ))}
          </div>
        </BlockContent>
      </Block>
  );
};

export default OtherPluginsBlock;
