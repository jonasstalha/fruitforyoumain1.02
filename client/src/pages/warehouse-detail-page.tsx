import { useParams, Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Warehouse,
  MapPin,
  Calendar,
  Package,
  Users,
  ClipboardList,
  AlertCircle,
  Edit,
  Trash,
  TrendingUp,
  BarChart3,
  Activity,
  RefreshCw
} from "lucide-react";
import { doc, getDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import { firestore as db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Cell
} from "recharts";

// Warehouse type definition
type Warehouse = {
  id: string;
  name: string;
  location: string;
  capacity: string;
  description: string;
  code: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// Statistics type
type WarehouseStats = {
  totalLots: number;
  currentStock: number;
  utilizationRate: number;
  monthlyIncoming: number;
  monthlyOutgoing: number;
  avgStorageTime: number;
  storageHistory: Array<{
    month: string;
    incoming: number;
    outgoing: number;
    utilization: number;
  }>;
  lotsByStatus: Array<{
    status: string;
    count: number;
    color: string;
  }>;
};

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        
        // Fetch warehouse details
        const warehouseRef = doc(db, "entrepots", id);
        const warehouseSnap = await getDoc(warehouseRef);

        if (warehouseSnap.exists()) {
          const data = warehouseSnap.data();
          const warehouseData = {
            id: warehouseSnap.id,
            name: data.name,
            location: data.location,
            capacity: data.capacity,
            description: data.description || "",
            code: data.code || "",
            active: data.active,
            createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
          };
          setWarehouse(warehouseData);
          
          // Fetch warehouse statistics
          await fetchWarehouseStats(warehouseData);
        } else {
          setError("Entrepôt non trouvé");
        }
      } catch (err) {
        console.error("Error fetching warehouse:", err);
        setError("Erreur lors du chargement des détails de l'entrepôt");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const fetchWarehouseStats = async (warehouseData: Warehouse) => {
    try {
      setStatsLoading(true);
      
      // Get all lots from the API
      const { getAvocadoTrackingData } = await import('@/lib/queryClient');
      const allLots = await getAvocadoTrackingData()();
      
      // Filter lots that are stored in this warehouse
      const warehouseLots = allLots.filter((lot: any) => 
        lot.storage?.storageRoomId?.toLowerCase().includes(warehouseData.name.toLowerCase()) ||
        lot.storage?.storageRoomId?.toLowerCase().includes(warehouseData.location.toLowerCase()) ||
        lot.storage?.storageRoomId?.includes(warehouseData.code)
      );

      // Calculate capacity from string (e.g., "1000 kg" -> 1000)
      const maxCapacity = parseFloat(warehouseData.capacity.replace(/[^0-9.]/g, '')) || 1000;
      
      // Calculate current stock (lots that are in storage but not yet exported)
      const currentLots = warehouseLots.filter((lot: any) => 
        lot.storage?.entryDate && !lot.storage?.exitDate && !lot.export?.loadingDate
      );
      
      const currentStock = currentLots.reduce((sum: number, lot: any) => 
        sum + (lot.packaging?.netWeight || 0), 0
      );
      
      const utilizationRate = (currentStock / maxCapacity) * 100;
      
      // Calculate monthly statistics
      const now = new Date();
      const monthlyData = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const monthLots = warehouseLots.filter((lot: any) => {
          const entryDate = lot.storage?.entryDate ? new Date(lot.storage.entryDate) : null;
          return entryDate && entryDate >= date && entryDate < nextMonth;
        });
        
        const outgoingLots = warehouseLots.filter((lot: any) => {
          const exitDate = lot.storage?.exitDate ? new Date(lot.storage.exitDate) : null;
          return exitDate && exitDate >= date && exitDate < nextMonth;
        });
        
        monthlyData.push({
          month: date.toLocaleDateString('fr-FR', { month: 'short' }),
          incoming: monthLots.length,
          outgoing: outgoingLots.length,
          utilization: Math.min(Math.random() * 100, 95) // Simulated for demo
        });
      }
      
      // Calculate average storage time
      const completedStorageLots = warehouseLots.filter((lot: any) => 
        lot.storage?.entryDate && lot.storage?.exitDate
      );
      
      const avgStorageTime = completedStorageLots.length > 0 
        ? completedStorageLots.reduce((sum: number, lot: any) => {
            const entryDate = new Date(lot.storage.entryDate);
            const exitDate = new Date(lot.storage.exitDate);
            return sum + ((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / completedStorageLots.length
        : 0;
      
      // Lots by status
      const statusCounts = {
        'En stockage': currentLots.length,
        'Expédiés': warehouseLots.filter((lot: any) => lot.export?.loadingDate).length,
        'Livrés': warehouseLots.filter((lot: any) => lot.delivery?.actualDeliveryDate).length,
      };
      
      const lotsByStatus = [
        { status: 'En stockage', count: statusCounts['En stockage'], color: '#3B82F6' },
        { status: 'Expédiés', count: statusCounts['Expédiés'], color: '#10B981' },
        { status: 'Livrés', count: statusCounts['Livrés'], color: '#8B5CF6' },
      ].filter(item => item.count > 0);
      
      const currentMonth = monthlyData[monthlyData.length - 1];
      
      setStats({
        totalLots: warehouseLots.length,
        currentStock: Math.round(currentStock),
        utilizationRate: Math.round(utilizationRate),
        monthlyIncoming: currentMonth?.incoming || 0,
        monthlyOutgoing: currentMonth?.outgoing || 0,
        avgStorageTime: Math.round(avgStorageTime),
        storageHistory: monthlyData,
        lotsByStatus
      });
      
    } catch (error) {
      console.error("Error fetching warehouse stats:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques de l'entrepôt",
        variant: "destructive",
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleEdit = () => {
    // Redirect to edit page or open edit dialog
    toast({
      title: "Fonctionnalité à venir",
      description: "L'édition directe depuis la page de détails sera bientôt disponible.",
    });
  };

  const handleDelete = async () => {
    if (!warehouse) return;

    if (confirm("Êtes-vous sûr de vouloir supprimer cet entrepôt ?")) {
      try {
        await deleteDoc(doc(db, "entrepots", warehouse.id));
        toast({
          title: "Entrepôt supprimé",
          description: "L'entrepôt a été supprimé avec succès.",
        });
        setLocation("/warehouses");
      } catch (error) {
        console.error("Error deleting warehouse:", error);
        toast({
          title: "Erreur",
          description: "Une erreur est survenue lors de la suppression de l'entrepôt.",
          variant: "destructive",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-500">Chargement des détails de l'entrepôt...</p>
        </div>
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {error || "Entrepôt non trouvé. Veuillez réessayer plus tard."}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/warehouses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux entrepôts
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/warehouses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{warehouse.name}</h1>
            <p className="text-neutral-500">Code: {warehouse.code}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </Button>
          <Button variant="outline" size="sm" className="text-red-500" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex justify-end">
        <Badge className={warehouse.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {warehouse.active ? "Actif" : "Inactif"}
        </Badge>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Warehouse className="mr-2 h-5 w-5" />
            Informations Générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-neutral-500 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-neutral-500">Localisation</p>
                  <p className="text-lg">{warehouse.location}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start">
                <Package className="h-5 w-5 text-neutral-500 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-neutral-500">Capacité</p>
                  <p className="text-lg">{warehouse.capacity}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="font-medium text-sm text-neutral-500 mb-2">Description</p>
            <p className="text-neutral-700">{warehouse.description || "Aucune description disponible."}</p>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-sm text-neutral-500">Date de création</p>
                <p>{formatDate(warehouse.createdAt)}</p>
              </div>
              <div>
                <p className="font-medium text-sm text-neutral-500">Dernière modification</p>
                <p>{formatDate(warehouse.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <ClipboardList className="mr-2 h-5 w-5" />
                Statistiques Détaillées
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchWarehouseStats(warehouse!)}
                disabled={statsLoading}
              >
                {statsLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Chargement des statistiques...</span>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalLots}</div>
                    <div className="text-sm text-blue-700">Total Lots</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.currentStock}kg</div>
                    <div className="text-sm text-green-700">Stock Actuel</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.utilizationRate}%</div>
                    <div className="text-sm text-purple-700">Utilisation</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.avgStorageTime}</div>
                    <div className="text-sm text-orange-700">Jours Moy. Stockage</div>
                  </div>
                </div>

                {/* Monthly Activity Chart */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Activité Mensuelle
                  </h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.storageHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          name === 'utilization' ? `${value.toFixed(1)}%` : `${value} lots`,
                          name === 'incoming' ? 'Entrées' :
                          name === 'outgoing' ? 'Sorties' : 'Utilisation'
                        ]}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="incoming" fill="#3b82f6" name="Entrées" />
                      <Bar yAxisId="left" dataKey="outgoing" fill="#10b981" name="Sorties" />
                      <Line yAxisId="right" type="monotone" dataKey="utilization" stroke="#8b5cf6" name="Utilisation %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Status Distribution */}
                {stats.lotsByStatus.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Répartition par Statut
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={stats.lotsByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ status, count }) => `${status}: ${count}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {stats.lotsByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Performance Insights */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
                  <h5 className="font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Insights de Performance
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Capacité Restante:</span>
                      <span className="text-blue-600 ml-2">
                        {Math.max(0, parseFloat(warehouse.capacity.replace(/[^0-9.]/g, '')) - stats.currentStock).toFixed(0)}kg
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Rotation Stock:</span>
                      <span className="text-green-600 ml-2">
                        {stats.avgStorageTime > 0 ? (365 / stats.avgStorageTime).toFixed(1) : 'N/A'}x/an
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Activité Ce Mois:</span>
                      <span className="text-purple-600 ml-2">
                        {stats.monthlyIncoming} entrées, {stats.monthlyOutgoing} sorties
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Efficacité:</span>
                      <span className={`ml-2 ${
                        stats.utilizationRate > 80 ? 'text-red-600' :
                        stats.utilizationRate > 60 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {stats.utilizationRate > 80 ? 'Surchargé' :
                         stats.utilizationRate > 60 ? 'Optimal' : 'Sous-utilisé'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-center py-8">
                Aucune donnée disponible. Cliquez sur actualiser pour charger les statistiques.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personnel Section (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Personnel Assigné
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-500 text-sm italic mb-4">La gestion du personnel assigné à cet entrepôt sera bientôt disponible.</p>
          <Button variant="outline">
            Assigner du personnel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}