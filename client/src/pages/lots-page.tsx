import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Truck, Package, Box, Ship, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { api, getAvocadoTrackingData } from "@/lib/queryClient";
import { AvocadoTracking } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

export default function LotsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Use React Query to fetch and cache the data
  const { data: lots = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['avocadoTracking'],
    queryFn: getAvocadoTrackingData()
  });

  const filteredLots = lots.filter(
    (lot) =>
      lot.harvest.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.harvest.farmLocation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProgressPercentage = (lot: AvocadoTracking) => {
    const steps = [
      lot.harvest.harvestDate,
      lot.transport.arrivalDateTime,
      lot.sorting.sortingDate,
      lot.packaging.packagingDate,
      lot.storage.entryDate,
      lot.export.loadingDate,
      lot.delivery.actualDeliveryDate
    ];
    const completedSteps = steps.filter(step => step).length;
    return (completedSteps / steps.length) * 100;
  };

  const getStatusBadge = (lot: AvocadoTracking) => {
    if (lot.delivery.actualDeliveryDate) {
      return <Badge variant="success">Livré</Badge>;
    }
    if (lot.export.loadingDate) {
      return <Badge className="bg-blue-100 text-blue-800">En Export</Badge>;
    }
    if (lot.storage.entryDate) {
      return <Badge className="bg-purple-100 text-purple-800">En Stockage</Badge>;
    }
    if (lot.packaging.packagingDate) {
      return <Badge className="bg-yellow-100 text-yellow-800">Emballé</Badge>;
    }
    if (lot.sorting.sortingDate) {
      return <Badge className="bg-orange-100 text-orange-800">Trié</Badge>;
    }
    if (lot.transport.arrivalDateTime) {
      return <Badge className="bg-indigo-100 text-indigo-800">Transporté</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Récolté</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-500">Chargement des lots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Impossible de charger les lots. Veuillez réessayer plus tard."}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => refetch()}>Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Lots</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Rechercher un lot..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button asChild>
            <Link href="/new-entry">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Lot
            </Link>
          </Button>
        </div>
      </div>

      {filteredLots.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500 mb-4">Aucun lot trouvé</p>
          {searchTerm && (
            <p className="text-sm text-neutral-400">
              Essayez de modifier vos critères de recherche
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLots.map((lot, index) => (
            <Card key={`${lot.harvest.lotNumber}-${index}`} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{lot.harvest.lotNumber}</CardTitle>
                  {getStatusBadge(lot)}
                </div>
                <div className="flex items-center text-sm text-neutral-500">
                  <span className="font-medium">Ferme:</span> {lot.harvest.farmLocation}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Progression</span>
                    <span className="font-medium">{Math.round(getProgressPercentage(lot))}%</span>
                  </div>
                  <Progress value={getProgressPercentage(lot)} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1 text-neutral-500" />
                      <span>Récolte: {new Date(lot.harvest.harvestDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <Truck className="h-4 w-4 mr-1 text-neutral-500" />
                      <span>Transport: {lot.transport.arrivalDateTime ? new Date(lot.transport.arrivalDateTime).toLocaleDateString() : 'En attente'}</span>
                    </div>
                    <div className="flex items-center">
                      <Package className="h-4 w-4 mr-1 text-neutral-500" />
                      <span>Tri: {lot.sorting.sortingDate ? new Date(lot.sorting.sortingDate).toLocaleDateString() : 'En attente'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Box className="h-4 w-4 mr-1 text-neutral-500" />
                      <span>Emballage: {lot.packaging.packagingDate ? new Date(lot.packaging.packagingDate).toLocaleDateString() : 'En attente'}</span>
                    </div>
                    <div className="flex items-center">
                      <Ship className="h-4 w-4 mr-1 text-neutral-500" />
                      <span>Export: {lot.export.loadingDate ? new Date(lot.export.loadingDate).toLocaleDateString() : 'En attente'}</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-1 text-neutral-500" />
                      <span>Livraison: {lot.delivery.actualDeliveryDate ? new Date(lot.delivery.actualDeliveryDate).toLocaleDateString() : 'En attente'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Variété:</span>
                    <span className="font-medium">{lot.harvest.variety}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Grade:</span>
                    <span className="font-medium">{lot.sorting.qualityGrade}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Poids net:</span>
                    <span className="font-medium">{lot.packaging.netWeight} kg</span>
                  </div>
                </div>
              </CardContent>
      <CardFooter className="flex justify-end space-x-2">
  <Button variant="outline" size="sm" asChild>
    <Link href={`/lots/${lot.harvest.lotNumber}`}>
      Détails
    </Link>
  </Button>
</CardFooter>

            </Card>
          ))}
        </div>
      )}
    </div>
  );
}