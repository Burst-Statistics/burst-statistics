import React, { useState, useRef, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import FilterCard from './FilterCard';
import { useFiltersStore } from '@/store/useFiltersStore';
import Icon from '@/utils/Icon';

interface FilterConfig {
    label: string;
    icon: string;
    type: string;
    pro?: boolean;
    category?: string;
    coming_soon?: boolean;
}

interface FiltersConf {
    [key: string]: FilterConfig;
}

interface FilterSelectionViewProps {
    onSelectFilter: (filterKey: string, config: FilterConfig) => void;
}

const FilterSelectionView: React.FC<FilterSelectionViewProps> = ({ onSelectFilter }) => {
    const filtersConf = useFiltersStore(state => state.filtersConf) as FiltersConf;
    const filterCategories = useFiltersStore(state => state.filterCategories);
    const getActiveFilters = useFiltersStore(state => state.getActiveFilters);
    const getFiltersByCategory = useFiltersStore(state => state.getFiltersByCategory);
    const getFavoriteFilters = useFiltersStore(state => state.getFavoriteFilters);
    
    const [activeTab, setActiveTab] = useState<string>('favorites');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    const activeFilters = getActiveFilters();
    const categorizedFilters = getFiltersByCategory();
    const favoriteFilters = getFavoriteFilters();

    // Auto-focus search input on render
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // Create tabs array with favorites first, then all, then categories
    const tabs = [
        { key: 'favorites', label: __('Favorites', 'burst-statistics'), icon: 'star-outline' },
        { key: 'all', label: __('All', 'burst-statistics'), icon: 'grid' },
        ...Object.entries(filterCategories)
            .sort(([, a], [, b]) => (a as any).order - (b as any).order)
            .map(([key, category]) => ({
                key,
                label: (category as any).label,
                icon: (category as any).icon
            }))
    ];

    // Search functionality
    const searchFilters = (query: string) => {
        if (!query.trim()) return null;
        
        const searchTerm = query.toLowerCase();
        const allFilters = Object.entries(filtersConf)
            .filter(([_, config]) => config.type)
            .map(([key, config]) => ({ key, ...config }));
        
        // Function to check if a filter matches the search
        const matchesSearch = (filter: any) => 
            filter.label.toLowerCase().includes(searchTerm) ||
            filter.key.toLowerCase().includes(searchTerm);
        
        // First, search in current tab
        let currentTabFilters: any[] = [];
        if (activeTab === 'favorites') {
            currentTabFilters = favoriteFilters;
        } else if (activeTab === 'all') {
            currentTabFilters = allFilters;
        } else {
            currentTabFilters = categorizedFilters[activeTab] || [];
        }
        
        const currentTabResults = currentTabFilters.filter(matchesSearch);
        
        // If we have results in current tab, return them
        if (currentTabResults.length > 0) {
            return {
                results: currentTabResults,
                source: activeTab,
                isFromCurrentTab: true
            };
        }
        
        // If no results in current tab, search all filters
        const allResults = allFilters.filter(matchesSearch);
        return {
            results: allResults,
            source: 'all',
            isFromCurrentTab: false
        };
    };

    const searchResults = searchFilters(searchQuery);

    const renderFilters = (filters: Array<{ key: string; label: string; icon: string; type: string; pro?: boolean; category?: string }>, searchInfo?: { source: string; isFromCurrentTab: boolean }) => {
        if (filters.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Icon name="empty" size={48} color="gray"/>
                    <p className="mt-2">
                        {searchQuery.trim() ? (
                            __('No filters match your search.', 'burst-statistics')
                        ) : (
                            activeTab === 'favorites' 
                                ? __('No favorite filters yet. Pin filters to add them here.', 'burst-statistics')
                                : activeTab === 'all'
                                ? __('No filters available.', 'burst-statistics')
                                : __('No filters in this category.', 'burst-statistics')
                        )}
                    </p>
                </div>
            );
        }

        return (
            <div>
                {/* Search info message */}
                {searchInfo && !searchInfo.isFromCurrentTab && (
                    <div className="mb-4 p-3 bg-blue-light border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Icon name="help" size={16} color="blue" />
                            <span className="text-sm text-blue-700">
                                {__('No results found in current tab. Showing results from all filters.', 'burst-statistics')}
                            </span>
                        </div>
                    </div>
                )}

                <div 
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center"
                    role="grid"
                    aria-label={__('Available filters', 'burst-statistics')}
                >
                    {filters.map((filter, index) => (
                        <FilterCard
                            key={filter.key}
                            filterKey={filter.key}
                            config={filter}
                            isActive={activeFilters.hasOwnProperty(filter.key)}
                            onClick={() => onSelectFilter(filter.key, filter)}
                            gridPosition={{ position: index + 1, total: filters.length }}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col">
            {/* Search Input */}
            <div className="mb-6">
                <label htmlFor="filter-search" className="sr-only">
                    {__('Search filters', 'burst-statistics')}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon name="search" size={16} className="text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        id="filter-search"
                        type="text"
                        placeholder={__('Search filters...', 'burst-statistics')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary text-sm"
                        aria-describedby={searchResults ? "search-results-info" : undefined}
                        ref={searchInputRef}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-900"
                            aria-label={__('Clear search', 'burst-statistics')}
                            type="button"
                        >
                            <Icon name="times" size={16} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav 
                        className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide"
                        role="tablist"
                        aria-label={__('Filter categories', 'burst-statistics')}
                    >
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                id={`tab-${tab.key}`}
                                onClick={() => setActiveTab(tab.key)}
                                role="tab"
                                aria-selected={activeTab === tab.key}
                                aria-controls={`tabpanel-${tab.key}`}
                                className={clsx(
                                    'flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex-shrink-0',
                                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                                    {
                                        'border-primary text-primary': activeTab === tab.key,
                                        'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300': activeTab !== tab.key
                                    }
                                )}
                            >
                                <span 
                                    className={clsx(
                                        'flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200',
                                        {
                                            'bg-primary-light text-white shadow-sm border-primary border-0.5': activeTab === tab.key,
                                            'bg-transparent': activeTab !== tab.key
                                        }
                                    )}
                                    aria-hidden="true"
                                >
                                    <Icon name={tab.icon} size={16} />
                                </span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
                {searchResults ? (
                    <div>
                        {searchResults.results.length > 0 && (
                            <div id="search-results-info" className="sr-only">
                                {__('Showing %d search results', 'burst-statistics').replace('%d', searchResults.results.length.toString())}
                            </div>
                        )}
                        {renderFilters(searchResults.results, searchResults)}
                    </div>
                ) : activeTab === 'favorites' ? (
                    renderFilters(favoriteFilters)
                ) : activeTab === 'all' ? (
                    renderFilters(Object.entries(filtersConf)
                        .filter(([_, config]) => config.type)
                        .map(([key, config]) => ({ key, ...config })))
                ) : (
                    renderFilters(categorizedFilters[activeTab] || [])
                )}
            </div>
        </div>
    );
};

export default FilterSelectionView; 