import { useQuery } from "@tanstack/react-query";
import getGeoData from "@/api/getGeoData";
import { useFiltersStore } from "@/store/useFiltersStore";
import { useDate } from "@/store/useDateStore";
import { useGeoStore } from "@/store/useGeoStore";

export const useGeoAnalytics = () => {
  const { startDate, endDate, range } = useDate((state) => state);
  const filters = useFiltersStore((state) => state.filters);
  const metrics = useGeoStore((state) => state.selectedMetric);
  const currentView = useGeoStore((state) => state.currentView);
  
  // Create args object with all necessary parameters
  const args = { 
    filters, 
    metrics,
    currentView: {
      level: currentView.level,
      id: currentView.id
    }
  };



  return useQuery({
    queryKey: ["geo_analytics", startDate, endDate, currentView.level, currentView.id, metrics, filters],
    queryFn: () => getGeoData({ startDate, endDate, range, args }),
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Structure placeholder data similar to expected response
    placeholderData: []
  });
}; 