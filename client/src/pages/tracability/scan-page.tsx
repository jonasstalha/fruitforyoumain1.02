import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import BarcodeScanner from "@/components/scan/barcode-scanner";
import PDFViewer from "@/components/pdf/pdf-viewer";
import { AvocadoTracking } from "@shared/schema";
import { Loader2, QrCode, Search, Camera, X, FileText, ExternalLink, Download, Share2, Copy, Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from '../../lib/queryClient';
import { QrScanner } from '@yudiel/react-qr-scanner';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Simple QR code component that doesn't rely on Firebase
interface SimpleQRCodeProps {
  value: string;
  size?: number;
}

const SimpleQRCode = ({ value, size = 200 }: SimpleQRCodeProps) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `url(https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}) center/cover`,
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}
    />
  );
};

// Analytics tracking function
const trackQRScan = async (lotNumber: string, scanType: 'view' | 'download') => {
  try {
    await apiRequest('POST', '/api/analytics/track-scan', {
      lotNumber,
      scanType,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Failed to track QR scan:', error);
  }
};

export default function ScanPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [lotNumber, setLotNumber] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scannedLot, setScannedLot] = useState<AvocadoTracking | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lotId, setLotId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  // New states for QR code functionality
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [generatedQRData, setGeneratedQRData] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrType, setQrType] = useState<'download' | 'view'>('download');
  const [scanCount, setScanCount] = useState<number>(0);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);

  // Enhanced manual lookup with better error handling and logging
  const handleLookupLot = async (manualLotNumber?: string) => {
    const lotToLookup = getTrimmedLotNumber(manualLotNumber);
    console.log('Looking up lot:', lotToLookup);

    if (!lotToLookup) {
      toast({
        title: "Numéro de lot requis",
        description: "Veuillez entrer un numéro de lot pour la recherche",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update lotNumber state if using manual input
      if (manualLotNumber) {
        setLotNumber(manualLotNumber);
      }

      console.log('Fetching lot data from API...');
      // Make direct API request to find the lot
      const result = await apiRequest<AvocadoTracking>('GET', `/api/avocado-tracking/${lotToLookup}`);
      console.log('API Response:', result);

      if (result) {
        setScannedLot(result);
        setLotId(result.harvest.lotNumber);

        // Initialize scan statistics with default values
        setScanCount(0);
        setLastScanDate(null);

        toast({
          title: "Lot trouvé",
          description: `Lot ${result.harvest.lotNumber} trouvé avec succès`,
        });
      } else {
        throw new Error("Lot non trouvé");
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setScannedLot(null);
      setLotId(null);
      setScanCount(0);
      setLastScanDate(null);

      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      console.error('Error details:', errorMessage);

      toast({
        title: "Erreur de recherche",
        description: `Impossible de trouver le lot ${lotToLookup}. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to safely get trimmed lot number
  const getTrimmedLotNumber = (lot?: string) => {
    const trimmed = (lot || lotNumber || "").toString().trim();
    console.log('Trimmed lot number:', trimmed); // Debug log
    return trimmed;
  };

  // Safe check for lot number validity
  const isValidLotNumber = () => {
    const trimmed = getTrimmedLotNumber();
    const isValid = trimmed.length > 0;
    console.log('Lot number valid:', isValid); // Debug log
    return isValid;
  };

  // Enhanced QR code generation with better error handling
  const handleGenerateQR = async (type: 'download' | 'view') => {
    if (!scannedLot) return;

    try {
      const baseUrl = window.location.origin;
      const url = type === 'download' 
        ? `${baseUrl}/api/avocado-tracking/${scannedLot.harvest.lotNumber}/pdf`
        : `${baseUrl}/tracability/lot/${scannedLot.harvest.lotNumber}`;

      const qrData = {
        url,
        type,
        lotNumber: scannedLot.harvest.lotNumber
      };

      setGeneratedQRData(JSON.stringify(qrData));
      setQrType(type);
      setShowQRModal(true);

      toast({
        title: "QR Code généré",
        description: `QR Code ${type === 'download' ? 'de téléchargement' : 'de consultation'} créé pour le lot ${scannedLot.harvest.lotNumber}`,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le QR code. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  // Enhanced barcode detection with automatic navigation
  const handleBarcodeDetected = async (result: any) => {
    try {
      console.log('Barcode detected:', result);
      
      // Extract lot number from the QR code
      let lotNumber = result.text;
      
      // If the QR code contains a URL, extract the lot number from it
      if (lotNumber.includes('/')) {
        const urlParts = lotNumber.split('/');
        lotNumber = urlParts[urlParts.length - 1];
      }

      if (!lotNumber) {
        toast({
          title: "Format de QR code invalide",
          description: "Le QR code ne contient pas de numéro de lot valide",
          variant: "destructive"
        });
        return;
      }

      console.log('Extracted lot number:', lotNumber);
      
      // Clean the lot number before navigation
      const cleanLotNumber = lotNumber.replace(/[^a-zA-Z0-9-]/g, '');
      console.log('Cleaned lot number:', cleanLotNumber);
      
      // Navigate to the lot detail page
      setLocation(`/tracability/lot/${cleanLotNumber}`);

    } catch (error) {
      console.error('Error handling barcode:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du traitement du QR code",
        variant: "destructive"
      });
    }
  };

  // Enhanced PDF download with report generation
  const handleDownloadPDF = async () => {
    if (!scannedLot) return;

    setIsDownloading(true);
    try {
      // Generate PDF report
      const response = await apiRequest<{ pdfUrl: string }>('POST', `/api/avocado-tracking/${scannedLot.harvest.lotNumber}/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scannedLot)
      });

      if (response && response.pdfUrl) {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = response.pdfUrl;
        link.download = `rapport_tracabilite_${scannedLot.harvest.lotNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Rapport téléchargé",
          description: `Le rapport de traçabilité du lot ${scannedLot.harvest.lotNumber} a été téléchargé avec succès`,
        });
      } else {
        throw new Error("URL du rapport non disponible");
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le rapport. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
      setShowDownloadConfirm(false);
    }
  };

  // Handle direct download from URL or hash
  useEffect(() => {
    const handleDirectDownload = async () => {
      // Check URL hash for direct download instructions
      const hash = window.location.hash;
      const currentPath = window.location.pathname;
      let lotIdFromUrl = null;
      
      // Check for direct-download in hash (for compatibility with QR scanners that modify URLs)
      if (hash && hash.includes('direct-download:')) {
        lotIdFromUrl = hash.split('direct-download:')[1];
      } 
      // Check URL path for direct-download format
      else if (currentPath.includes('/direct-download:')) {
        lotIdFromUrl = currentPath.split('/direct-download:')[1];
      }
      
      if (lotIdFromUrl) {
        try {
          setIsDownloading(true);
          toast({
            title: "Téléchargement automatique",
            description: `Téléchargement du PDF pour le lot ${lotIdFromUrl}`,
          });

          // Direct PDF download
          const pdfBlob = await apiRequest<Blob>('GET', `/pdf/${lotIdFromUrl}`);
          if (pdfBlob) {
            downloadPDFBlob(pdfBlob, lotIdFromUrl);
            // Redirect to home or lots page after download to clean up URL
            setTimeout(() => {
              setLocation('/scan');
            }, 1000);
          }
        } catch (error) {
          console.error("Error auto-downloading PDF:", error);
          toast({
            title: "Erreur de téléchargement",
            description: "Impossible de télécharger le PDF automatiquement.",
            variant: "destructive",
          });
        } finally {
          setIsDownloading(false);
        }
      }
    };

    handleDirectDownload();
    
    // Also listen for hash changes (some QR scanners modify the hash instead of the path)
    const handleHashChange = () => handleDirectDownload();
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Helper function to download PDF blob
  const downloadPDFBlob = (blob: Blob, lotNumber: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lot-${lotNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Handle QR code sharing
  const handleShareQR = async () => {
    if (!scannedLot) return;

    const shareData = {
      title: `Lot d'Avocat ${scannedLot.harvest.lotNumber}`,
      text: `Informations de traçabilité pour le lot ${scannedLot.harvest.lotNumber}`,
      url: generatedQRData || `${window.location.origin}/lots/${scannedLot.harvest.lotNumber}`
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast({
          title: "Partagé avec succès",
          description: "Le lien du lot a été partagé",
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: "Lien copié",
          description: "Le lien du lot a été copié dans le presse-papiers",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        title: "Erreur de partage",
        description: "Impossible de partager le lien",
        variant: "destructive",
      });
    }
  };

  // Copy QR data to clipboard
  const handleCopyQRData = async () => {
    try {
      await navigator.clipboard.writeText(generatedQRData);
      toast({
        title: "Lien copié",
        description: "Le lien du QR code a été copié dans le presse-papiers",
      });
    } catch (error) {
      toast({
        title: "Erreur de copie",
        description: "Impossible de copier le lien",
        variant: "destructive",
      });
    }
  };

  // View details of scanned lot
  const viewLotDetails = () => {
    if (scannedLot) {
      setLocation(`/lots/${scannedLot.harvest.lotNumber}`);
    }
  };

  // Generate PDF for scanned lot
  const showPDF = () => {
    if (scannedLot) {
      setShowPdfPreview(true);
    }
  };

  // Handle download confirmation
  const handleDownloadClick = () => {
    setShowDownloadConfirm(true);
  };

  // Add New Order from scanned lot with manual kg entry (multi-item support)
  const [orderItems, setOrderItems] = useState([
    {
      caliber: scannedLot?.packaging.size || '',
      quantity: scannedLot?.packaging.netWeight || 0,
      type: scannedLot?.harvest.variety || '',
      processingTime: 0
    }
  ]);

  // Update orderItems when scannedLot changes
  useEffect(() => {
    if (scannedLot) {
      setOrderItems([
        {
          caliber: scannedLot.packaging.size || '',
          quantity: scannedLot.packaging.netWeight || 0,
          type: scannedLot.harvest.variety || '',
          processingTime: 0
        }
      ]);
    }
  }, [scannedLot]);

  const handleItemChange = (idx: number, field: string, value: any) => {
    setOrderItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        caliber: scannedLot?.packaging.size || '',
        quantity: 0,
        type: scannedLot?.harvest.variety || '',
        processingTime: 0
      }
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddOrder = async () => {
    if (!scannedLot) return;
    try {
      const order = {
        clientName: scannedLot.harvest.farmer || 'Client inconnu',
        orderDate: new Date(),
        requestedDeliveryDate: new Date(),
        status: 'pending',
        items: orderItems,
        priority: 'medium',
        totalProcessingTime: 0,
        notes: `Ajouté depuis Scan: Lot ${scannedLot.harvest.lotNumber}`
      };
      await addDoc(collection(db, 'avocado_orders'), order);
      toast({
        title: 'Commande ajoutée',
        description: `Commande pour le lot ${scannedLot.harvest.lotNumber} ajoutée avec succès !`,
      });
    } catch (e) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter la commande',
        variant: 'destructive',
      });
    }
  };

  // Enhanced QR code modal
  const QRCodeModal = () => {
    if (!showQRModal || !scannedLot || !generatedQRData) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <CardHeader className="bg-muted/50">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code - Lot {scannedLot.harvest.lotNumber}
            </CardTitle>
            <CardDescription>
              {qrType === 'download'
                ? 'QR Code de téléchargement PDF pour ce lot'
                : 'QR Code de consultation pour ce lot'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-4 rounded-lg border">
                <SimpleQRCode
                  value={generatedQRData}
                  size={200}
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {qrType === 'download'
                    ? 'Scannez ce code pour télécharger automatiquement le PDF'
                    : 'Scannez ce code pour accéder aux informations du lot'
                  }
                </p>
                <p className="text-xs text-muted-foreground break-all px-2">
                  {generatedQRData}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyQRData}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copier Lien
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleShareQR}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Partager
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 bg-muted/50">
            <Button variant="outline" onClick={() => setShowQRModal(false)}>
              Fermer
            </Button>
            {qrType === 'download' && (
              <Button onClick={handleDownloadClick} disabled={isDownloading}>
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger PDF
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-4xl mx-auto">
        {/* Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Recherche de Lot
            </CardTitle>
            <CardDescription>
              Entrez le numéro de lot pour voir les détails et accéder au PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (isValidLotNumber()) {
                  handleLookupLot();
                }
              }}
              className="flex gap-2"
            >
              <Input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Entrez le numéro de lot"
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading || !isValidLotNumber()}
                className="min-w-[100px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Recherche
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Rechercher
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Section */}
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : scannedLot ? (
          <div className="space-y-6">
            {/* Lot Information */}
            <Card>
              <CardHeader className="bg-muted/50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informations du Lot {scannedLot.harvest.lotNumber}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Numéro de Lot</div>
                    <div className="text-lg font-semibold mt-1">{scannedLot.harvest.lotNumber}</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Date de Récolte</div>
                    <div className="text-lg font-semibold mt-1">
                      {new Date(scannedLot.harvest.harvestDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Quantité</div>
                    <div className="text-lg font-semibold mt-1">{scannedLot.packaging.netWeight} kg</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground">Statut</div>
                    <div className="text-lg font-semibold mt-1 capitalize">
                      {scannedLot.delivery.actualDeliveryDate ? 'Livré' : 'En cours'}
                    </div>
                  </div>
                </div>

                {/* Scan Statistics */}
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4">Statistiques de Scan</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">Nombre de Scans</div>
                      <div className="text-lg font-semibold mt-1 flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        {scanCount}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">Dernier Scan</div>
                      <div className="text-lg font-semibold mt-1">
                        {lastScanDate ? new Date(lastScanDate).toLocaleString() : 'Jamais'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Quantity Section */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité à commander (kg) par item</label>
                  <div className="space-y-2">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">{item.type} (Caliber {item.caliber})</span>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => handleOrderItemKgChange(idx, Number(e.target.value))}
                          className="w-32"
                          disabled={!scannedLot}
                        />
                        <span className="text-xs">kg</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Multi-item order form */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-2">Ajouter des articles à la commande</h3>
                  <div className="space-y-4">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">Calibre</div>
                          <Input
                            value={item.caliber}
                            onChange={e => handleItemChange(idx, 'caliber', e.target.value)}
                            className="mb-1"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">Type</div>
                          <Input
                            value={item.type}
                            onChange={e => handleItemChange(idx, 'type', e.target.value)}
                            className="mb-1"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">Kg</div>
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                            className="mb-1"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={orderItems.length === 1}
                          title="Supprimer l'article"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={handleAddItem} className="mt-2">
                      + Ajouter un article
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 p-6 pt-0 bg-muted/50">
                <Button variant="default" onClick={handleAddOrder} disabled={!scannedLot}>
                  Ajouter Commande
                </Button>
                <Button variant="outline" onClick={showPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Voir PDF
                </Button>
                <Button onClick={viewLotDetails}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Voir Détails
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center h-[200px] text-center text-muted-foreground bg-muted/30 rounded-lg">
                <Search className="h-12 w-12 mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium">Entrez un numéro de lot</p>
                <p className="text-sm mt-2">pour voir les informations et accéder au PDF</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code Modal */}
        <QRCodeModal />

        {/* Download Confirmation Dialog */}
        {showDownloadConfirm && scannedLot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Télécharger le PDF</CardTitle>
                <CardDescription>
                  Voulez-vous télécharger le rapport PDF pour le lot {scannedLot.harvest.lotNumber} ?
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDownloadConfirm(false)}>
                  Annuler
                </Button>
                <Button onClick={handleDownloadPDF} disabled={isDownloading}>
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Téléchargement...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* PDF Preview Modal */}
        {showPdfPreview && scannedLot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-4xl h-[80vh]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Aperçu PDF - Lot {scannedLot.harvest.lotNumber}</span>
                  <Button variant="outline" size="sm" onClick={() => setShowPdfPreview(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full overflow-auto">
                <PDFViewer
                  lotId={scannedLot.harvest.lotNumber}
                  lotData={scannedLot}
                  onClose={() => setShowPdfPreview(false)}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Global Loading Overlay */}
        {isDownloading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-lg font-medium">Génération du PDF...</span>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}