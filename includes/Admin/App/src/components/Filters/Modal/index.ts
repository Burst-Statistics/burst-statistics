/**
 * Barrel exports for Filter Modal components
 * 
 * This file provides clean imports for all filter modal components:
 * import { FilterModal, FilterCard, FilterSelectionView, FilterSetupView } from '@/components/Filters/Modal';
 * 
 * For setup components, you can also import directly:
 * import { StringFilterSetup, BooleanFilterSetup, IntFilterSetup, DeviceFilterSetup } from '@/components/Filters/Modal/Setup';
 */

export { default as FilterModal } from './FilterModal';
export { default as FilterCard } from './FilterCard';
export { default as FilterSelectionView } from './FilterSelectionView';
export { default as FilterSetupView } from './FilterSetupView';

// Re-export Setup components for convenience
export { 
    StringFilterSetup, 
    BooleanFilterSetup, 
    IntFilterSetup, 
    DeviceFilterSetup 
} from './Setup'; 