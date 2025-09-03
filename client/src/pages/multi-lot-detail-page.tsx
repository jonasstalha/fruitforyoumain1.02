import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Scale,
  Calendar,
  User,
  Building,
  FileText,
  Share2,
  Wifi,
  WifiOff,
  Globe,
  Users,
  Edit,
  Archive
} from "lucide-react";
import { Link } from "wouter";
import { AvocadoTracking } from "@shared/schema";
import { MultiLot } from "@/lib/multiLotService";
import { useMultiLots } from "@/hooks/useMultiLots";
import { getAvocadoTrackingData } from "@/lib/queryClient";

export default function LotDetailPage() {
  const { lotNumber: rawLotNumber } = useParams<{ lotNumber: string }>();
  const [lotData, setLotData] = useState<AvocadoTracking | MultiLot | null>(null);
  const [lotType, setLotType] = useState<'multi' | 'legacy' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { getLot: getMultiLot, archiveLot } = useMultiLots();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchLotData = async () => {
      if (!rawLotNumber) {
        setErrorMessage('Numéro de lot manquant');
        setIsLoading(false);
        return;
      }

      const decodedLotNumber = decodeURIComponent(rawLotNumber);
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // First, try to find in multi-lots
        const multiLot = getMultiLot(decodedLotNumber);
        if (multiLot) {
          setLotData(multiLot);
          setLotType('multi');
          setIsLoading(false);
          return;
        }

        // If not found in multi-lots, search in legacy lots
        const allLots = await getAvocadoTrackingData()();
        const foundLot = allLots.find(lot => 
          lot.harvest?.lotNumber === decodedLotNumber ||
          lot.harvest?.lotNumber?.toLowerCase() === decodedLotNumber.toLowerCase()
        );

        if (foundLot) {
          setLotData(foundLot);
          setLotType('legacy');
        } else {
          setErrorMessage(`Lot ${decodedLotNumber} non trouvé`);
        }
      } catch (error) {
        console.error('Error fetching lot data:', error);
        setErrorMessage('Erreur lors de la récupération des données du lot');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLotData();
  }, [rawLotNumber, getMultiLot]);

  const getProgressPercentage = (): number => {
    if (!lotData) return 0;

    if (lotType === 'multi') {
      const multiLot = lotData as MultiLot;
      return Math.min(((multiLot.completedSteps?.length || 0) / 7) * 100, 100);
    } else {
      const legacyLot = lotData as AvocadoTracking;
      const steps = [
        legacyLot.harvest.harvestDate,
        legacyLot.transport.arrivalDateTime,
        legacyLot.sorting.sortingDate,
        legacyLot.packaging.packagingDate,
        legacyLot.storage.entryDate,
        legacyLot.export.loadingDate,
        legacyLot.delivery.actualDeliveryDate
      ];
      const completedSteps = steps.filter(step => step && step.trim() !== '').length;
      return (completedSteps / steps.length) * 100;
    }
  };

  const getStatusBadge = () => {
    if (!lotData) return null;

    if (lotType === 'multi') {
      const multiLot = lotData as MultiLot;
      const statusConfig = {
        'draft': { color: 'bg-gray-100 text-gray-800', icon: '📝', text: 'Brouillon' },
        'in-progress': { color: 'bg-blue-100 text-blue-800', icon: '🔄', text: 'En cours' },
        'completed': { color: 'bg-green-100 text-green-800', icon: '✅', text: 'Terminé' },
        'archived': { color: 'bg-purple-100 text-purple-800', icon: '📦', text: 'Archivé' }
      };
      
      const config = statusConfig[multiLot.status] || statusConfig.draft;
      return (
        <Badge className={config.color}>
          <span className="mr-1">{config.icon}</span>
          {config.text}
        </Badge>
      );
    } else {
      const legacyLot = lotData as AvocadoTracking;
      if (legacyLot.delivery.actualDeliveryDate) {
        return <Badge className="bg-green-100 text-green-800">✅ Livré</Badge>;
      }
      if (legacyLot.export.loadingDate) {
        return <Badge className="bg-blue-100 text-blue-800">🚢 En Export</Badge>;
      }
      if (legacyLot.storage.entryDate) {
        return <Badge className="bg-purple-100 text-purple-800">🏪 En Stockage</Badge>;
      }
      if (legacyLot.packaging.packagingDate) {
        return <Badge className="bg-yellow-100 text-yellow-800">📦 Emballé</Badge>;
      }
      if (legacyLot.sorting.sortingDate) {
        return <Badge className="bg-orange-100 text-orange-800">🏭 Trié</Badge>;
      }
      if (legacyLot.transport.arrivalDateTime) {
        return <Badge className="bg-indigo-100 text-indigo-800">🚛 Transporté</Badge>;
      }
      return <Badge className="bg-gray-100 text-gray-800">🌱 Récolté</Badge>;
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString || dateString.trim() === '') return "En attente";
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Date invalide";
    }
  };

  const formatDateShort = (dateString: string | undefined): string => {
    if (!dateString || dateString.trim() === '') return "En attente";
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return "Date invalide";
    }
  };

  const getTimelineSteps = () => {
    if (!lotData) return [];

    if (lotType === 'multi') {
      const multiLot = lotData as MultiLot;
      return [
        {
          title: "Récolte",
          date: multiLot.harvest?.harvestDate,
          icon: <Clock className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(1) || false,
          details: `Ferme: ${multiLot.harvest?.farmLocation || 'N/A'} | Variété: ${multiLot.harvest?.variety || 'N/A'}`
        },
        {
          title: "Transport",
          date: multiLot.transport?.arrivalDateTime,
          icon: <Truck className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(2) || false,
          details: `Véhicule: ${multiLot.transport?.vehicleId || 'N/A'} | Chauffeur: ${multiLot.transport?.driverName || 'N/A'}`
        },
        {
          title: "Tri",
          date: multiLot.sorting?.sortingDate,
          icon: <Package className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(3) || false,
          details: `Grade: ${multiLot.sorting?.qualityGrade || 'N/A'} | Rejetés: ${multiLot.sorting?.rejectedCount || 0} kg`
        },
        {
          title: "Emballage",
          date: multiLot.packaging?.packagingDate,
          icon: <Box className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(4) || false,
          details: `Poids net: ${multiLot.packaging?.netWeight || 0} kg | Type: ${multiLot.packaging?.boxType || 'N/A'}`
        },
        {
          title: "Stockage",
          date: multiLot.storage?.entryDate,
          icon: <Building className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(5) || false,
          details: `Zone: ${multiLot.storage?.storageRoomId || 'N/A'} | Temp: ${multiLot.storage?.storageTemperature || 'N/A'}°C`
        },
        {
          title: "Export",
          date: multiLot.export?.loadingDate,
          icon: <Ship className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(6) || false,
          details: `Destination: ${multiLot.export?.destination || 'N/A'} | Container: ${multiLot.export?.containerId || 'N/A'}`
        },
        {
          title: "Livraison",
          date: multiLot.delivery?.actualDeliveryDate,
          icon: <CheckCircle2 className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(7) || false,
          details: `Client: ${multiLot.delivery?.clientName || 'N/A'}`
        }
      ];
    } else {
      const legacyLot = lotData as AvocadoTracking;
      return [
        {
          title: "Récolte",
          date: legacyLot.harvest.harvestDate,
          icon: <Clock className="h-5 w-5" />,
          completed: !!(legacyLot.harvest.harvestDate && legacyLot.harvest.harvestDate.trim() !== ''),
          details: `Ferme: ${legacyLot.harvest.farmLocation} | Variété: ${legacyLot.harvest.variety}`
        },
        {
          title: "Transport",
          date: legacyLot.transport.arrivalDateTime,
          icon: <Truck className="h-5 w-5" />,
          completed: !!(legacyLot.transport.arrivalDateTime && legacyLot.transport.arrivalDateTime.trim() !== ''),
          details: `Véhicule: ${legacyLot.transport.vehicleId || 'N/A'} | Chauffeur: ${legacyLot.transport.driverName || 'N/A'}`
        },
        {
          title: "Tri",
          date: legacyLot.sorting.sortingDate,
          icon: <Package className="h-5 w-5" />,
          completed: !!(legacyLot.sorting.sortingDate && legacyLot.sorting.sortingDate.trim() !== ''),
          details: `Grade: ${legacyLot.sorting.qualityGrade || 'N/A'} | Rejetés: ${legacyLot.sorting.rejectedCount || 0} kg`
        },
        {
          title: "Emballage",
          date: legacyLot.packaging.packagingDate,
          icon: <Box className="h-5 w-5" />,
          completed: !!(legacyLot.packaging.packagingDate && legacyLot.packaging.packagingDate.trim() !== ''),
          details: `Poids net: ${legacyLot.packaging.netWeight || 0} kg | Type: ${legacyLot.packaging.boxType || 'N/A'}`
        },
        {
          title: "Stockage",
          date: legacyLot.storage.entryDate,
          icon: <Building className="h-5 w-5" />,
          completed: !!(legacyLot.storage.entryDate && legacyLot.storage.entryDate.trim() !== ''),
          details: `Zone: ${legacyLot.storage.storageRoomId || 'N/A'} | Temp: ${legacyLot.storage.storageTemperature || 'N/A'}°C`
        },
        {
          title: "Export",
          date: legacyLot.export.loadingDate,
          icon: <Ship className="h-5 w-5" />,
          completed: !!(legacyLot.export.loadingDate && legacyLot.export.loadingDate.trim() !== ''),
          details: `Destination: ${legacyLot.export.destination || 'N/A'} | Container: ${legacyLot.export.containerId || 'N/A'}`
        },
        {
          title: "Livraison",
          date: legacyLot.delivery.actualDeliveryDate,
          icon: <CheckCircle2 className="h-5 w-5" />,
          completed: !!(legacyLot.delivery.actualDeliveryDate && legacyLot.delivery.actualDeliveryDate.trim() !== ''),
          details: `Client: ${legacyLot.delivery.clientName || 'N/A'}`
        }
      ];
    }
  };

  const handleShare = async () => {
    try {
      const lotNumber = lotType === 'multi' 
        ? (lotData as MultiLot).lotNumber 
        : (lotData as AvocadoTracking).harvest.lotNumber;
        
      const shareData = {
        title: `Lot d'Avocat ${lotNumber}`,
        text: `Informations de traçabilité pour le lot ${lotNumber}`,
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

  const handleArchive = async () => {
    if (lotType === 'multi' && lotData) {
      const multiLot = lotData as MultiLot;
      if (multiLot.status === 'completed') {
        try {
          await archiveLot(multiLot.id);
          alert('Lot archivé avec succès');
        } catch (error) {
          console.error('Error archiving lot:', error);
          alert('Erreur lors de l\'archivage du lot');
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium mb-2">Chargement des détails du lot...</p>
          <div className="flex items-center justify-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {isOnline ? 'Connecté' : 'Hors ligne'}
            </span>
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
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => window.location.reload()}>Réessayer</Button>
          <Button asChild variant="outline">
            <Link href="/lots">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux lots
            </Link>
          </Button>
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
          <AlertDescription>Le lot demandé n'existe pas.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const timelineSteps = getTimelineSteps();
  const lotNumber = lotType === 'multi' 
    ? (lotData as MultiLot).lotNumber 
    : (lotData as AvocadoTracking).harvest.lotNumber;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/lots">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              Lot {lotNumber}
              {lotType === 'multi' && (lotData as MultiLot).globallyAccessible && (
                <div className="flex items-center gap-1 text-green-600">
                  <Globe className="h-5 w-5" />
                  <span className="text-sm">Global</span>
                </div>
              )}
            </h1>
            <p className="text-neutral-500">
              Détails complets du suivi • Type: {lotType === 'multi' ? 'Multi-lot' : 'Lot ancien'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Partager
          </Button>
          {lotType === 'multi' && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/new-entry?lotId=${(lotData as MultiLot).id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Link>
              </Button>
              {(lotData as MultiLot).status === 'completed' && (
                <Button variant="outline" size="sm" onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </Button>
              )}
            </>
          )}
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
              <span className="text-2xl font-bold">{Math.round(getProgressPercentage())}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-3" />
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
                <p className="text-lg">
                  {lotType === 'multi' 
                    ? (lotData as MultiLot).harvest?.farmLocation || 'N/A'
                    : (lotData as AvocadoTracking).harvest.farmLocation
                  }
                </p>
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
                <p className="text-lg">
                  {lotType === 'multi' 
                    ? (lotData as MultiLot).harvest?.variety || 'N/A'
                    : (lotData as AvocadoTracking).harvest.variety
                  }
                </p>
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
                <p className="text-lg">
                  {lotType === 'multi' 
                    ? `${(lotData as MultiLot).packaging?.netWeight || 0} kg`
                    : `${(lotData as AvocadoTracking).packaging.netWeight || 0} kg`
                  }
                </p>
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
                <p className="text-lg">
                  {lotType === 'multi' 
                    ? (lotData as MultiLot).sorting?.qualityGrade || 'N/A'
                    : (lotData as AvocadoTracking).sorting.qualityGrade || 'N/A'
                  }
                </p>
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

      {/* Additional Info for Multi-lots */}
      {lotType === 'multi' && (
        <Card>
          <CardHeader>
            <CardTitle>Informations de Collaboration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Créé par</p>
                <p className="text-lg">{(lotData as MultiLot).createdBy}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Utilisateurs assignés</p>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{(lotData as MultiLot).assignedUsers?.length || 0} utilisateur(s)</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Créé le</p>
                <p className="text-lg">{formatDate((lotData as MultiLot).createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Dernière mise à jour</p>
                <p className="text-lg">{formatDate((lotData as MultiLot).updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
