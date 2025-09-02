import { useState } from "react";
import { Link } from "wouter";
import FilterBar from "@/components/dashboard/filter-bar";
import LotTable from "@/components/dashboard/lot-table";
import { Plus, QrCode, Archive, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsData, Farm, Lot, FilterState, AvocadoTracking } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { api, getFarms } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";

// Constants
const DEFAULT_FILTERS: FilterState = {
  search: "",
  farmId: "all",
  status: "all",
  date: "",
};

export default function DashboardPage() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Fetch farms data
  const { data: farms = [], isLoading: isLoadingFarms } = useQuery({
    queryKey: ['farms'],
    queryFn: () => api.get<Farm[]>('/api/farms')
  });
  
  // Fetch avocado tracking data (instead of lots)
  const { data: avocadoTrackingData = [], isLoading: isLoadingAvocadoTracking, refetch: refetchAvocadoTracking } = useQuery({
    queryKey: ['avocadoTracking'],
    queryFn: () => api.get<AvocadoTracking[]>('/api/avocado-tracking'),
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
  
  // Ensure all required variables are defined
  const lots: Lot[] = avocadoTrackingData.map((tracking, index) => ({
    id: (index + 1).toString(),
    name: `Lot ${tracking.harvest.lotNumber || index + 1}`,
    description: `Lot from ${tracking.harvest.farmLocation}, variety: ${tracking.harvest.variety}`,
    lotNumber: tracking.harvest.lotNumber,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  
  // Fetch stats data
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<StatsData>('/api/stats')
  });
  
  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev: FilterState) => ({ ...prev, ...newFilters }));
  };
  
  // Complete the code block for filtering lots
  const filteredLots = lots.filter(lot => {
    // Filter by search term
    if (filters.search && !(lot.lotNumber || '').toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    // No farmId, status, or harvestDate in Lot type, so skip those filters
    return true;
  });
  
  // Check if user can create entries (admin or operator)
  const canCreateEntries = true; // TODO: Replace with actual user role check
  
  // Determine if any data is loading
  const isLoading = isLoadingFarms || isLoadingAvocadoTracking || isLoadingStats;
  
  return (
    <div>
      {/* Filter Bar Section */}
      <section>
        <FilterBar 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          farms={farms} 
          isLoading={isLoadingFarms} 
        />
      </section>

      {/* Lots Table Section */}
      <section>
        <LotTable 
          lots={filteredLots} 
          isLoading={isLoadingAvocadoTracking} 
          farms={farms} 
        />
      </section>

      {/* Action Buttons */}
      {canCreateEntries && (
        <div className="fixed bottom-6 right-6 flex flex-col space-y-3">
          <Button 
            asChild 
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary-600"
            title={t('dashboard.scanBarcode')}
          >
            <Link href="/scan">
              <QrCode className="h-6 w-6" />
            </Link>
          </Button>
          <Button 
            asChild 
            className="h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700"
            title={t('dashboard.shipmentHistory')}
          >
            <Link href="/logistique/history">
              <History className="h-6 w-6" />
            </Link>
          </Button>
          <Button 
            asChild 
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary-600"
            title={t('dashboard.addNewEntry')}
          >
            <Link href="/new-entry">
              <Plus className="h-6 w-6" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}