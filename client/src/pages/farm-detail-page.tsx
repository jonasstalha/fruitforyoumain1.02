import { useParams, Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Building,
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

// Using shared Firebase instance from lib/firebase.ts

// Define Farm type
type Farm = {
  id: string;
  name: string;
  location: string;
  description: string;
  code: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function FarmDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchFarm = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const farmRef = doc(db, "farms", id);
        const farmSnap = await getDoc(farmRef);

        if (farmSnap.exists()) {
          const data = farmSnap.data();
          setFarm({
            id: farmSnap.id,
            name: data.name,
            location: data.location,
            description: data.description || "",
            code: data.code || "",
            active: data.active,
            createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
          });
        } else {
          setError("Ferme non trouvée");
        }
      } catch (err) {
        console.error("Error fetching farm:", err);
        setError("Erreur lors de la récupération des données de la ferme");
      } finally {
        setLoading(false);
      }
    };

    fetchFarm();
  }, [id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDelete = async () => {
    if (!farm) return;

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la ferme ${farm.name}?`)) {
      try {
        await deleteDoc(doc(db, "farms", farm.id));
        toast({
          title: "Ferme supprimée",
          description: `La ferme ${farm.name} a été supprimée avec succès.`,
        });
        setLocation("/farms");
      } catch (err) {
        console.error("Error deleting farm:", err);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Une erreur est survenue lors de la suppression de la ferme.",
        });
      }
    }
  };

  const handleEdit = () => {
    // Redirect to farms page with edit dialog open
    // This would require state management across pages
    // For now, just redirect to farms page
    setLocation("/farms");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erreur</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/farms">Retour aux fermes</Link>
        </Button>
      </Alert>
    );
  }

  if (!farm) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Ferme non trouvée</AlertTitle>
        <AlertDescription>La ferme demandée n'existe pas ou a été supprimée.</AlertDescription>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/farms">Retour aux fermes</Link>
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/farms">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{farm.name}</h2>
          <Badge variant={farm.active ? "success" : "destructive"}>
            {farm.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" onClick={handleDelete}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">État:</span>
                <Badge variant={farm.active ? "success" : "destructive"}>
                  {farm.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Code:</span>
                <span className="font-mono">{farm.code}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <ClipboardList className="h-5 w-5 mr-2" />
              Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Localisation:</span>
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1 text-neutral-500" />
                  <span>{farm.location}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Description:</span>
                <span className="text-right">{farm.description || "Non spécifiée"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Créé le:</span>
                <span>{formatDate(farm.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Dernière mise à jour:</span>
                <span>{formatDate(farm.updatedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Statistiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-neutral-500 py-4">
              Les statistiques de production seront disponibles prochainement.
            </div>
          </CardContent>
        </Card>

        {/* Personnel assigné */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Personnel assigné
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-neutral-500 py-4">
              Aucun personnel assigné pour le moment.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}