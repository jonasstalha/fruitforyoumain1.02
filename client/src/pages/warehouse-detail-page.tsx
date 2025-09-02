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
  Trash
} from "lucide-react";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { firestore as db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

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

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchWarehouse = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const warehouseRef = doc(db, "entrepots", id);
        const warehouseSnap = await getDoc(warehouseRef);

        if (warehouseSnap.exists()) {
          const data = warehouseSnap.data();
          setWarehouse({
            id: warehouseSnap.id,
            name: data.name,
            location: data.location,
            capacity: data.capacity,
            description: data.description || "",
            code: data.code || "",
            active: data.active,
            createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
          });
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

    fetchWarehouse();
  }, [id]);

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

        {/* Statistics Card (Placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClipboardList className="mr-2 h-5 w-5" />
              Statistiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-500 text-sm italic">Les statistiques détaillées de l'entrepôt seront bientôt disponibles.</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="border rounded-md p-3">
                <p className="font-medium text-sm text-neutral-500">Lots stockés</p>
                <p className="text-2xl font-bold text-neutral-700">--</p>
              </div>
              <div className="border rounded-md p-3">
                <p className="font-medium text-sm text-neutral-500">Utilisation</p>
                <p className="text-2xl font-bold text-neutral-700">--%</p>
              </div>
            </div>
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