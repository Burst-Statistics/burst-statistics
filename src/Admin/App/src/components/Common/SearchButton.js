import { __ } from '@wordpress/i18n';
import { useCallback, useMemo, useRef, useState } from 'react';
import Icon from '@/utils/Icon';

/**
 * SearchButton component that displays as a button and expands to a search input.
 * Styled to match the filter button appearance.
 * 
 * @param {string} value - The current search value
 * @param {function} onChange - Callback function when search value changes
 * @param {string} placeholder - Placeholder text for the search input
 * @param {string} className - Additional CSS classes
 * @return {JSX.Element}
 */
const SearchButton = ({ 
  value = '', 
  onChange, 
  placeholder = __( 'Search', 'burst-statistics' ), 
  className = '' 
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Search button toggle handler
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      const newState = !prev;
      if (newState) {
        // Focus the input after state update
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 0);
      } else {
        // Clear search when closing
        onChange?.('');
      }
      return newState;
    });
  }, [onChange]);

  // Handle search input blur
  const handleSearchBlur = useCallback(() => {
    // Only close if there's no search text
    if (value.trim() === '') {
      setIsSearchOpen(false);
    }
  }, [value]);

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    onChange?.(e.target.value);
  }, [onChange]);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    onChange?.('');
    searchInputRef.current?.focus();
  }, [onChange]);

  // Keep search open if there's a value
  const shouldBeOpen = isSearchOpen || value.trim() !== '';

  return (
    <div className={`relative ${className}`}>
      {!shouldBeOpen ? (
        <div
          className="bg-gray-300 focus:ring-blue-500 cursor-pointer rounded-full p-3 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
          onClick={toggleSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSearch();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={placeholder}
        >
          <Icon name="search" />
        </div>
      ) : (
        <div className="relative">
          <input
            ref={searchInputRef}
            className="bg-white border border-gray-300 rounded-full px-4 py-2 pr-10 min-w-48 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={handleSearchChange}
            onBlur={handleSearchBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onChange?.('');
                setIsSearchOpen(false);
              }
            }}
          />
          {value && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              onClick={handleClearSearch}
              onMouseDown={(e) => e.preventDefault()} // Prevent input blur
              tabIndex={-1}
              aria-label={__('Clear search', 'burst-statistics')}
            >
              <Icon name="times" size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchButton; 