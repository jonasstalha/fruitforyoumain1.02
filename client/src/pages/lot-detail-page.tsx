import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ErrorBoundary from "@/components/ErrorBoundary";
import { 
  ArrowLeft, 
  Truck, 
  Package, 
  Box, 
  Ship, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MapPin,
  Thermometer,
  Droplets,
  Scale,
  Calendar,
  User,
  Building,
  FileText,
  Share2,
  Wifi,
  WifiOff
} from "lucide-react";
import { Link } from "wouter";
import { AvocadoTracking } from "@shared/schema";

// Extended interface for the actual data structure used by Firebase
interface ExtendedAvocadoTracking extends Omit<AvocadoTracking, 'sorting' | 'packaging' | 'storage' | 'export'> {
  sorting: {
    qualityGrade: string;
    rejectedCount: number;
    notes?: string;
    sortingDate?: string;
    lotNumber?: string;
  };
  packaging: {
    boxId: string;
    netWeight: number;
    avocadoCount: number;
    boxType: string;
    packagingDate?: string;
    lotNumber?: string;
    workerIds?: string[];
  };
  storage?: {
    boxId: string;
    entryDate: string;
    storageTemperature: number;
    storageRoomId: string;
    exitDate?: string;
  };
  export?: {
    boxId: string;
    loadingDate: string;
    containerId: string;
    driverName: string;
    vehicleId: string;
    destination: string;
  };
}

export default function LotDetailPage() {
  const { lotNumber: rawLotNumber } = useParams<{ lotNumber: string }>();
  const [lotData, setLotData] = useState<ExtendedAvocadoTracking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentLotNumber, setCurrentLotNumber] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (errorMessage?.includes('connexion')) {
        // Auto-retry if the error was connection-related
        window.location.reload();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [errorMessage]);

  // Function to clean lot number
  const cleanLotNumber = (lotNumber: string): string => {
    if (!lotNumber) return '';
    // Remove any non-alphanumeric characters except hyphens
    return lotNumber.replace(/[^a-zA-Z0-9-]/g, '');
  };

  // Function to share the lot URL
  const handleShare = async () => {
    try {
      const shareData = {
        title: `Lot d'Avocat ${lotData?.harvest.lotNumber}`,
        text: `Informations de traçabilité pour le lot ${lotData?.harvest.lotNumber}`,
        url: window.location.href
      };

      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Lien copié dans le presse-papiers');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  useEffect(() => {
    const fetchLotData = async () => {
      if (!rawLotNumber) {
        setErrorMessage('Numéro de lot manquant');
        setIsLoading(false);
        return;
      }

      // Decode the URL parameter in case it contains special characters
      const decodedLotNumber = decodeURIComponent(rawLotNumber);
      console.log('Raw lot number:', rawLotNumber);
      console.log('Decoded lot number:', decodedLotNumber);
      
      // Check if the parameter is a date format (8 digits like 20250610)
      const isDateFormat = /^\d{8}$/.test(decodedLotNumber);
      
      setCurrentLotNumber(decodedLotNumber);
      setIsLoading(true);
      setErrorMessage(null);

      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second

      const attemptFetch = async (): Promise<void> => {
        try {
          console.log(`Attempt ${retryCount + 1} to fetch lot data for:`, decodedLotNumber);
          
          // Use the same method as lots page - fetch all lots and find the specific one
          const { getAvocadoTrackingData } = await import('@/lib/queryClient');
          const lots = await getAvocadoTrackingData()();
          
          if (lots.length > 0) {
            let foundLot;
            
            if (isDateFormat) {
              // Search by harvest date format YYYYMMDD
              foundLot = lots.find((lot: any) => {
                const harvestDate = lot.harvest?.harvestDate;
                if (harvestDate) {
                  const dateOnly = harvestDate.replace(/[^0-9]/g, '').slice(0, 8);
                  return dateOnly === decodedLotNumber;
                }
                return false;
              });
            } else {
              // Search by lot number (legacy behavior)
              const lotNumber = cleanLotNumber(decodedLotNumber);
              foundLot = lots.find((lot: any) => 
                lot.harvest?.lotNumber?.toLowerCase() === lotNumber.toLowerCase() ||
                lot.harvest?.lotNumber?.toLowerCase() === decodedLotNumber.toLowerCase() ||
                lot.harvest?.lotNumber?.toLowerCase() === rawLotNumber.toLowerCase()
              );
            }
            
            if (foundLot) {
              console.log('Found lot data:', foundLot);
              setLotData(foundLot as ExtendedAvocadoTracking);
              setIsLoading(false);
              return;
            }
          }
          
          throw new Error(`Aucun lot trouvé avec ${isDateFormat ? 'la date' : 'le numéro'}: ${decodedLotNumber}`);
        } catch (error) {
          console.error(`Attempt ${retryCount + 1} failed:`, error);
          
          if (retryCount < maxRetries - 1) {
            retryCount++;
            setRetryAttempt(retryCount);
            console.log(`Retrying in ${retryDelay}ms...`);
            setTimeout(attemptFetch, retryDelay);
          } else {
            console.error('All retry attempts failed');
            
            let errorMsg = 'Une erreur est survenue lors de la récupération des données du lot.';
            
            if (error instanceof Error) {
              if (error.message.includes('trouvé')) {
                errorMsg = 'Le lot n\'existe pas ou n\'a pas pu être trouvé.';
              } else if (error.message.includes('network') || error.message.includes('fetch') || !navigator.onLine) {
                errorMsg = 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.';
              } else if (error.message.includes('timeout') || error.message.includes('expired')) {
                errorMsg = 'Le temps de chargement a expiré. Le serveur met du temps à répondre.';
              } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
                errorMsg = 'Accès non autorisé. Veuillez vous reconnecter.';
              }
            }
            
            setErrorMessage(errorMsg);
            setIsLoading(false);
          }
        }
      };

      attemptFetch();
    };

    fetchLotData();
  }, [rawLotNumber]);

  const getProgressPercentage = (lot: ExtendedAvocadoTracking | null): number => {
    if (!lot) return 0;
    const steps = [
      lot.harvest.harvestDate,
      lot.transport.arrivalDateTime,
      lot.sorting?.sortingDate,
      lot.packaging?.packagingDate,
      lot?.storage?.entryDate,
      lot?.export?.loadingDate,
      lot.delivery?.actualDeliveryDate
    ];
    const completedSteps = steps.filter(step => step).length;
    return (completedSteps / steps.length) * 100;
  };

  const getStatusBadge = (lot: ExtendedAvocadoTracking | null) => {
    if (!lot) return null;
    
    if (lot.delivery?.actualDeliveryDate) {
      return <Badge className="bg-green-100 text-green-800">Livré</Badge>;
    }
    if (lot?.export?.loadingDate) {
      return <Badge className="bg-blue-100 text-blue-800">En Export</Badge>;
    }
    if (lot?.storage?.entryDate) {
      return <Badge className="bg-purple-100 text-purple-800">En Stockage</Badge>;
    }
    if (lot?.packaging?.packagingDate) {
      return <Badge className="bg-yellow-100 text-yellow-800">Emballé</Badge>;
    }
    if (lot?.sorting?.sortingDate) {
      return <Badge className="bg-orange-100 text-orange-800">Trié</Badge>;
    }
    if (lot.transport.arrivalDateTime) {
      return <Badge className="bg-indigo-100 text-indigo-800">Transporté</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Récolté</Badge>;
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "En attente";
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString: string | undefined): string => {
    if (!dateString) return "En attente";
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium mb-2">Chargement des détails du lot...</p>
          <p className="text-sm text-gray-500 mb-4">
            Recherche du lot {currentLotNumber || rawLotNumber}
          </p>
          
          {retryAttempt > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-blue-700">
                Tentative {retryAttempt + 1}/3...
              </p>
            </div>
          )}
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Connecté' : 'Hors ligne'}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Si le chargement prend du temps, cela peut être dû à une connexion lente.
              Le système réessaiera automatiquement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>
        
        {!isOnline && (
          <Alert className="mt-4">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Connexion hors ligne</AlertTitle>
            <AlertDescription>
              Votre appareil n'est pas connecté à Internet. Vérifiez votre connexion réseau.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
            disabled={!isOnline}
          >
            <Clock className="h-4 w-4" />
            Réessayer
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Link>
          </Button>
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              Statut: {isOnline ? 'Connecté' : 'Hors ligne'}
            </span>
          </div>
          <p className="text-xs text-gray-600">
            Si le problème persiste, contactez l'administrateur du système.
          </p>
        </div>
      </div>
    );
  }

  if (!lotData) {
    return (
      <div className="p-4 md:p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Lot non trouvé</AlertTitle>
          <AlertDescription>
            Le lot {rawLotNumber} n'existe pas ou n'a pas pu être trouvé.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const timelineSteps = [
    {
      title: "Récolte",
      date: lotData.harvest.harvestDate,
      icon: <Clock className="h-5 w-5" />,
      completed: !!lotData.harvest.harvestDate,
      details: `Ferme: ${lotData.harvest.farmLocation} | Variété: ${lotData.harvest.variety}`
    },
    {
      title: "Transport",
      date: lotData.transport.arrivalDateTime,
      icon: <Truck className="h-5 w-5" />,
      completed: !!lotData.transport.arrivalDateTime,
      details: `Véhicule: ${lotData.transport.vehicleId || 'N/A'} | Chauffeur: ${lotData.transport.driverName || 'N/A'}`
    },
    {
      title: "Tri",
      date: lotData.sorting?.sortingDate,
      icon: <Package className="h-5 w-5" />,
      completed: !!lotData.sorting?.sortingDate,
      details: `Grade: ${lotData.sorting.qualityGrade || 'N/A'} | Rejetés: ${lotData.sorting.rejectedCount || 0} kg`
    },
    {
      title: "Emballage",
      date: lotData.packaging?.packagingDate,
      icon: <Box className="h-5 w-5" />,
      completed: !!lotData.packaging?.packagingDate,
      details: `Poids net: ${lotData.packaging.netWeight || 0} kg | Type: ${lotData.packaging.boxType || 'N/A'}`
    },
    {
      title: "Stockage",
      date: lotData.storage?.entryDate,
      icon: <Building className="h-5 w-5" />,
      completed: !!lotData.storage?.entryDate,
      details: `Zone: ${lotData.storage?.storageRoomId || 'N/A'} | Temp: ${lotData.storage?.storageTemperature || 'N/A'}°C`
    },
    {
      title: "Export",
      date: lotData.export?.loadingDate,
      icon: <Ship className="h-5 w-5" />,
      completed: !!lotData.export?.loadingDate,
      details: `Destination: ${lotData.export?.destination || 'N/A'} | Container: ${lotData.export?.containerId || 'N/A'}`
    },
    {
      title: "Livraison",
      date: lotData.delivery.actualDeliveryDate,
      icon: <CheckCircle2 className="h-5 w-5" />,
      completed: !!lotData.delivery.actualDeliveryDate,
      details: `Client: ${lotData.delivery.clientName || 'N/A'}`
    }
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Lot {lotData?.harvest?.lotNumber}</h1>
              <p className="text-neutral-500">Détails complets du suivi</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {lotData && getStatusBadge(lotData)}
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Partager
            </Button>
          </div>
        </div>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Progression Générale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progression totale</span>
                <span className="text-2xl font-bold">{Math.round(getProgressPercentage(lotData))}%</span>
              </div>
              <Progress value={getProgressPercentage(lotData)} className="h-3" />
              <p className="text-sm text-neutral-500">
                {timelineSteps.filter(step => step.completed).length} sur {timelineSteps.length} étapes complétées
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-sm font-medium">Ferme</p>
                  <p className="text-lg">{lotData.harvest.farmLocation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-sm font-medium">Variété</p>
                  <p className="text-lg">{lotData.harvest.variety}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Scale className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-sm font-medium">Poids Net</p>
                  <p className="text-lg">{lotData.packaging?.netWeight || 0} kg</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-sm font-medium">Grade</p>
                  <p className="text-lg">{lotData.sorting?.qualityGrade || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Chronologie du Lot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {timelineSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    step.completed 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-lg font-medium ${
                        step.completed ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </h3>
                      <span className={`text-sm ${
                        step.completed ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {formatDateShort(step.date)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{step.details}</p>
                    {step.completed && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(step.date)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}