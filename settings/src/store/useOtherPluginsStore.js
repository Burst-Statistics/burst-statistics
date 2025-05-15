import {create} from 'zustand';

const useOtherPlugins = create( ( set ) => ({
  dataLoaded: false,
  setDataLoaded: ( dataLoaded ) => {
    set( state => ({ dataLoaded }) );
  },
  pluginData: false,
  setPluginData: ( pluginData ) => {
    set( state => ({ pluginData }) );
  }
}) );
export default useOtherPlugins;
