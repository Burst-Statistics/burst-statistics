import {create} from 'zustand';
import {getPosts} from '../utils/api';
import {__} from '@wordpress/i18n';
const usePostsStore = create( ( set, get ) => ({
    postsLoaded: false,
    fetching: false,
    posts: [],
    search: '',
    maxPostCount: 100,
    filterPosts: ( posts, search ) => {
        return posts.filter( post => {
            return Object.values( post ).some( value =>
                value.toString().toLowerCase().includes( search.toLowerCase() )
            );
        });
    },
    fetchPosts: async( search = '' ) => {
        let previousSearch = get().search;
        let resetQuery = false;

        //if the list is below 100, we already have all posts available for this search.
        let retrievedAllPosts = get().posts.length < get().maxPostCount;

        //if there was a previous search, but now it's empty, we want to re-fetch
        if ( 0 < previousSearch.length && 0 === search.length ) {
            resetQuery = true;
        }

        if ( previousSearch.length > search.length ) {
            resetQuery = true;
        }

        let sameSearch = false;
        if ( 0 < previousSearch.length && 0 === search.indexOf( previousSearch ) ) {

            //same string, but longer. Check if the posts count is below 100. If so, we don't need to do another query
            sameSearch = true;
        }

        //if we already have fetched ALL posts, the search hasn't changed, we can return the posts we already have, because search will only start as of 3 chars.
        if ( ! resetQuery && get().postsLoaded && sameSearch && retrievedAllPosts ) {
            set({ fetching: false });
            return get().filterPosts( get().posts, search );
        }

        set({ search: search, fetching: true });

        if ( ! resetQuery && get().postsLoaded && search === previousSearch ) {
            set({ fetching: false });
            return get().filterPosts( get().posts, search );
        }

        if ( ! resetQuery && get().postsLoaded && 3 > search.length && sameSearch ) {
            set({ fetching: false });
            return get().filterPosts( get().posts, search );
        }

        const response = await getPosts( search );

        // Map the response to the expected format
        let posts =  ( response || []).map( post => ({
            value: post.page_url,
            label: post.page_url,
            page_id: post.page_id,
            post_title: 0 < post.post_title.length ? post.post_title : __( 'Untitled', 'burst-statistics' ),
            pageviews: post.pageviews
        }) );

        set({ posts: posts, postsLoaded: true, maxPostsCount: response.max_post_count, fetching: false });
        return get().filterPosts( posts, search );
    }
}) );

export default usePostsStore;
