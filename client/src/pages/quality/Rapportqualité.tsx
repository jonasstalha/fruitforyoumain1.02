import React, { useState, useRef, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Camera, 
  Save, 
  Eye,
  X,
  Plus,
  FileText,
  Scale,
  Target,
  Download,
  Archive,
  Loader2
} from 'lucide-react';
import { 
  saveQualityRapport, 
  updateQualityRapport, 
  getQualityRapports, 
  uploadCalibreImages,
  uploadQualityControlImage,
  QualityRapport,
  getQualityControlLotsForRapport,
  QualityRapportLot
} from '../../lib/qualityControlService';
import { 
  generateQualityRapportPDF, 
  generateVisualRapportPDF, 
  uploadPDFToStorage, 
  downloadPDF 
} from '../../lib/qualityRapportPDF';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';

const Rapportqualité = () => {
  const [submittedLots, setSubmittedLots] = useState<QualityRapportLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<QualityRapportLot | null>(null);
  const [selectedCalibre, setSelectedCalibre] = useState<string | number | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    calibre: '',
    lotId: ''
  });
  const [uploadedImages, setUploadedImages] = useState<Record<string | number, File[]>>({});
  const [savedImageUrls, setSavedImageUrls] = useState<Record<string | number, string[]>>({});
  const [testResults, setTestResults] = useState<Record<string | number, any>>({});
  const [inputMode, setInputMode] = useState<'manual' | 'image'>('manual');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent, calibre: string | number | null) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!calibre) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(calibre, files);
    }
  };

  useEffect(() => {
    loadRapportsFromFirestore();
  }, []);

  // Load saved rapport data when a lot is selected
  useEffect(() => {
    if (selectedLot) {
      loadSavedRapportData(selectedLot);
    }
  }, [selectedLot]);

  // Handle selection mode effects for calibre view
  useEffect(() => {
    if (selectedCalibre) {
      setIsSelectionMode(false);
      setSelectedImages([]);
      
      // Add keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedImages([]);
        }
        if (e.key === 'Delete' && selectedImages.length > 0) {
          deleteSelectedImages(selectedCalibre);
        }
        if (e.ctrlKey && e.key === 'a' && isSelectionMode) {
          e.preventDefault();
          selectAllImages(selectedCalibre);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedCalibre, isSelectionMode, selectedImages.length]);

  const loadRapportsFromFirestore = async () => {
    try {
      setIsLoading(true);
      
      // Load real quality control lots from Firebase
      const realLots = await getQualityControlLotsForRapport();
      
      console.log('Loaded real lots from Firebase:', realLots);
      
      // Also load existing rapports for comparison
      const existingRapports = await getQualityRapports();
      console.log('Existing rapports:', existingRapports);
      
      // Format the real lots for display
      const formattedLots = realLots.map(lot => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        date: lot.date,
        controller: lot.controller,
        palletNumber: lot.palletNumber,
        calibres: lot.calibres,
        status: lot.status,
        formData: lot.formData,
        images: lot.images,
        submittedAt: lot.submittedAt
      }));
      
      console.log('Formatted lots for display:', formattedLots);
      setSubmittedLots(formattedLots);
      
      if (formattedLots.length === 0) {
        toast({
          title: "Aucun lot trouvé",
          description: "Aucun lot complété n'a été trouvé dans Firebase. Assurez-vous que des lots ont été sauvegardés depuis la page de contrôle qualité.",
          variant: "default",
        });
      } else {
        toast({
          title: "Lots chargés avec succès",
          description: `${formattedLots.length} lot(s) chargé(s) depuis Firebase`,
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error('Error loading lots from Firebase:', error);
      toast({
        title: "Erreur",
        description: `Impossible de charger les lots depuis Firebase: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedRapportData = async (lot: QualityRapportLot) => {
    try {
      // Try to find existing rapport data for this lot
      const existingRapports = await getQualityRapports();
      const existingRapport = existingRapports.find(r => 
        r.id === lot.id || 
        r.lotNumber === lot.lotNumber ||
        r.id.startsWith(lot.id) ||
        lot.id.startsWith(r.id)
      );
      
      if (existingRapport && existingRapport.images) {
        console.log('Found existing rapport data:', existingRapport);
        setSavedImageUrls(existingRapport.images);
        
        if (existingRapport.testResults) {
          setTestResults(existingRapport.testResults);
        }
        
        toast({
          title: "Données chargées",
          description: "Données de rapport existantes chargées depuis Firebase",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error loading saved rapport data:', error);
      // Don't show error toast as this is optional data loading
    }
  };

  const filteredLots = submittedLots.filter((lot) => {
    const matchesDateFrom = !filters.dateFrom || lot.date >= filters.dateFrom;
    const matchesDateTo = !filters.dateTo || lot.date <= filters.dateTo;
    const matchesCalibre = !filters.calibre || (lot.calibres && Array.isArray(lot.calibres) && lot.calibres.some(cal => 
      String(cal).toLowerCase().includes(filters.calibre.toLowerCase())
    ));
    const matchesLotId = !filters.lotId || 
      (lot.id && lot.id.toLowerCase().includes(filters.lotId.toLowerCase())) ||
      (lot.lotNumber && lot.lotNumber.toLowerCase().includes(filters.lotId.toLowerCase())) ||
      (lot.palletNumber && lot.palletNumber.toLowerCase().includes(filters.lotId.toLowerCase())) ||
      (lot.formData?.clientLot && lot.formData.clientLot.toLowerCase().includes(filters.lotId.toLowerCase()));
    return matchesDateFrom && matchesDateTo && matchesCalibre && matchesLotId;
  });

  const handleImageUpload = (calibre: string | number | null, files: FileList | null) => {
    if (!calibre || !files) return;
    
    const fileArray = Array.from(files);
    const currentImages = uploadedImages[calibre] || [];
    const savedImages = savedImageUrls[calibre] || [];
    const totalCurrentImages = currentImages.length + savedImages.length;
    const totalImagesAfterUpload = totalCurrentImages + fileArray.length;
    
    // Enforce 12 image limit
    if (totalImagesAfterUpload > 12) {
      const allowedCount = 12 - totalCurrentImages;
      toast({
        title: "Limite d'images atteinte",
        description: `Vous ne pouvez ajouter que ${allowedCount} images supplémentaires. Actuellement vous avez ${totalCurrentImages}/12 images.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = fileArray.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Format d'image invalide",
        description: "Seuls les formats JPEG, PNG et WebP sont acceptés.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file sizes (max 5MB per image)
    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = fileArray.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast({
        title: "Taille d'image trop importante",
        description: "Chaque image doit faire moins de 5MB.",
        variant: "destructive",
      });
      return;
    }
    
    setUploadedImages(prev => ({
      ...prev,
      [calibre]: [...currentImages, ...fileArray]
    }));

    toast({
      title: "Images ajoutées",
      description: `${fileArray.length} image(s) ajoutée(s) pour le calibre ${calibre}`,
      variant: "default",
    });
  };

  const removeImage = (calibre: string | number | null, index: number) => {
    if (!calibre) return;
    
    setUploadedImages(prev => ({
      ...prev,
      [calibre]: prev[calibre]?.filter((_, i) => i !== index) || []
    }));
  };

  const toggleImageSelection = (index: number) => {
    setSelectedImages(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectAllImages = (calibre: string | number | null) => {
    if (!calibre) return;
    const images = uploadedImages[calibre] || [];
    const allIndices = images.map((_, index) => index);
    setSelectedImages(allIndices);
  };

  const deselectAllImages = () => {
    setSelectedImages([]);
  };

  const deleteSelectedImages = (calibre: string | number | null) => {
    if (!calibre || selectedImages.length === 0) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedImages.length} selected image(s)?`);
    if (!confirmDelete) return;
    
    setUploadedImages(prev => ({
      ...prev,
      [calibre]: prev[calibre]?.filter((_, index) => !selectedImages.includes(index)) || []
    }));
    
    setSelectedImages([]);
    setIsSelectionMode(false);
  };

  const rearrangeImages = (calibre: string | number | null, fromIndex: number, toIndex: number) => {
    if (!calibre) return;
    
    const images = uploadedImages[calibre] || [];
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    
    setUploadedImages(prev => ({
      ...prev,
      [calibre]: newImages
    }));
  };

  const addSingleImage = (calibre: string | number | null) => {
    if (!calibre) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const currentImages = uploadedImages[calibre] || [];
        const savedImages = savedImageUrls[calibre] || [];
        const totalImages = currentImages.length + savedImages.length;
        
        if (totalImages >= 12) {
          toast({
            title: "Limite atteinte",
            description: "Maximum 12 images autorisées par calibre",
            variant: "destructive",
          });
          return;
        }
        
        setUploadedImages(prev => ({
          ...prev,
          [calibre]: [...currentImages, file]
        }));
      }
    };
    input.click();
  };

  const downloadRapportPDF = async (lotId: string) => {
    try {
      setIsGeneratingPDF(true);
      
      // Find the rapport associated with this lot
      const rapports = await getQualityRapports();
      const rapport = rapports.find(r => 
        r.id === lotId || 
        r.lotNumber === lotId ||
        r.id.startsWith(lotId) ||
        lotId.startsWith(r.id)
      );
      
      if (!rapport) {
        toast({
          title: "Erreur",
          description: "Aucun rapport trouvé pour ce lot. Assurez-vous que le rapport a été finalisé.",
          variant: "destructive",
        });
        return;
      }
      
      // Generate PDF
      const pdfBlob = await generateQualityRapportPDF(rapport);
      
      // Download PDF
      const fileName = `rapport_${rapport.lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(pdfBlob, fileName);
      
      toast({
        title: "Téléchargement réussi",
        description: "Le PDF a été téléchargé",
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors du téléchargement du PDF: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const downloadVisualReport = async (lotId: string) => {
    try {
      setIsGeneratingPDF(true);
      
      // Find the rapport associated with this lot
      const rapports = await getQualityRapports();
      const rapport = rapports.find(r => 
        r.id === lotId || 
        r.lotNumber === lotId ||
        r.id.startsWith(lotId) ||
        lotId.startsWith(r.id)
      );
      
      if (!rapport) {
        toast({
          title: "Erreur",
          description: "Aucun rapport trouvé pour ce lot. Assurez-vous que le rapport a été finalisé.",
          variant: "destructive",
        });
        return;
      }
      
      // Generate visual PDF
      const pdfBlob = await generateVisualRapportPDF(rapport);
      
      // Download PDF
      const fileName = `rapport_visuel_${rapport.lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(pdfBlob, fileName);
      
      toast({
        title: "Téléchargement réussi",
        description: "Le rapport visuel a été téléchargé",
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error downloading visual report:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors du téléchargement du rapport visuel: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleTestResultChange = (calibre: string | number | null, field: string, value: any) => {
    if (!calibre) return;
    
    setTestResults(prev => ({
      ...prev,
      [calibre]: {
        ...prev[calibre],
        [field]: value
      }
    }));
  };

  const handleTestImageUpload = (calibre: string | number | null, testType: string, file: File | null) => {
    if (!calibre || !file) return;
    
    setTestResults(prev => ({
      ...prev,
      [calibre]: {
        ...prev[calibre],
        [`${testType}_image`]: file
      }
    }));
  };

  const saveCaliberData = async (calibre: string | number | null) => {
    if (!calibre || !selectedLot || !user) return;
    
    const images = uploadedImages[calibre] || [];
    const savedImages = savedImageUrls[calibre] || [];
    const totalImages = images.length + savedImages.length;
    const results = testResults[calibre] || {};
    
    // Validate that exactly 12 images are uploaded (combining new uploads and saved images)
    if (totalImages !== 12) {
      toast({
        title: "Images manquantes",
        description: `Veuillez télécharger exactement 12 images pour ce calibre (actuellement: ${totalImages}/12)`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate test results based on input mode
    if (inputMode === 'manual') {
      if (!results.poids || !results.firmness || !results.puree_image) {
        toast({
          title: "Données incomplètes",
          description: "Veuillez compléter tous les résultats des tests",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!results.poids_image || !results.firmness_image || !results.puree_image) {
        toast({
          title: "Images manquantes",
          description: "Veuillez télécharger toutes les images de résultats de tests",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsSaving(true);
      
      // Test Firebase connection and authentication first
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      console.log('User authenticated:', { email: user.email, uid: user.uid });
      
      toast({
        title: "Sauvegarde en cours...",
        description: `Upload des images et données pour le calibre ${calibre}`,
        variant: "default",
      });
      
      // Upload unit images to Firebase Storage (only new images)
      let newImageUrls: string[] = [];
      if (images.length > 0) {
        console.log(`Uploading ${images.length} new images for calibre ${calibre}...`);
        console.log('Image details:', images.map(img => ({
          name: img.name,
          size: `${(img.size / 1024 / 1024).toFixed(2)}MB`,
          type: img.type
        })));
        
        // Test upload of first image only if there are upload issues
        if (images.length === 1) {
          console.log('Testing single image upload...');
          try {
            const testUrl = await uploadQualityControlImage(images[0], selectedLot.id, 'calibre', String(calibre));
            console.log('Single image upload successful:', testUrl);
            newImageUrls = [testUrl];
          } catch (error) {
            console.error('Single image upload failed:', error);
            throw error;
          }
        } else {
          // Upload all images with timeout
          const uploadPromise = uploadCalibreImages(images, selectedLot.id, String(calibre));
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Upload timeout after 5 minutes')), 5 * 60 * 1000);
          });
          
          try {
            newImageUrls = await Promise.race([uploadPromise, timeoutPromise]);
            console.log(`Successfully uploaded images. URLs:`, newImageUrls);
          } catch (error) {
            console.error('Batch upload failed:', error);
            throw new Error(`Failed to upload images: ${(error as Error).message}`);
          }
        }
      }
      
      // Combine existing saved URLs with new ones
      const allImageUrls = [...savedImages, ...newImageUrls];
      
      // Upload test result images if any
      const testImageUrls: Record<string, string> = {};
      for (const [key, file] of Object.entries(results)) {
        if (key.endsWith('_image') && file instanceof File) {
          console.log(`Uploading test image for ${key}...`);
          const testImageUrl = await uploadCalibreImages([file], selectedLot.id, `${calibre}_${key.replace('_image', '')}`);
          testImageUrls[key] = testImageUrl[0];
          console.log(`Test image uploaded: ${key} -> ${testImageUrl[0]}`);
        }
      }
      
      // Keep the original File objects for display, and store URLs separately for saving
      const savedImageData = {
        files: images, // Keep original files for display
        urls: allImageUrls // Store combined URLs for database
      };
      
      // Update saved URLs state with combined URLs
      setSavedImageUrls(prev => ({
        ...prev,
        [calibre]: allImageUrls
      }));
      
      // Clear local uploaded images for this calibre since they're now saved
      setUploadedImages(prev => ({
        ...prev,
        [calibre]: []
      }));
      
      // Update test results with image URLs
      setTestResults(prev => ({
        ...prev,
        [calibre]: {
          ...prev[calibre],
          ...testImageUrls
        }
      }));
      
      // Save individual calibre data to Firebase for partial progress
      const calibreData = {
        lotId: selectedLot.id,
        lotNumber: selectedLot.lotNumber,
        calibre: calibre,
        unitImages: allImageUrls, // Use the combined URLs
        testResults: {
          ...results,
          ...testImageUrls
        },
        inputMode: inputMode,
        savedAt: new Date().toISOString(),
        savedBy: user.email || user.uid,
        status: 'calibre_completed'
      };
      
      console.log('Saving calibre data to Firebase:', calibreData);
      
      await saveQualityRapport({
        ...calibreData,
        id: `${selectedLot.id}_${calibre}`,
        date: selectedLot.date,
        controller: selectedLot.controller,
        palletNumber: selectedLot.palletNumber,
        calibres: [calibre],
        images: { [calibre]: allImageUrls }, // Use the combined URLs
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString()
      });
      
      console.log('Successfully saved to Firebase');
      
      toast({
        title: "Succès",
        description: `Données sauvegardées pour le calibre ${calibre}. ${allImageUrls.length} images au total (${newImageUrls.length} nouvelles).`,
        variant: "default",
      });

      // Check if all calibres for the selected lot are complete
      const allComplete = await checkAllCalibresComplete(selectedLot);
      
      if (allComplete) {
        await saveCompleteRapport(selectedLot);
      } else {
        toast({
          title: "Progression sauvegardée",
          description: `Calibre ${calibre} terminé. ${selectedLot.calibres.length - 1} calibre(s) restant(s).`,
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error('Error saving calibre data:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors de la sauvegarde: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const checkAllCalibresComplete = async (lot: QualityRapportLot): Promise<boolean> => {
    return lot.calibres.every((cal) => {
      const imgs = uploadedImages[cal] || [];
      const res = testResults[cal] || {};
      
      if (imgs.length !== 12) return false;
      
      if (inputMode === 'manual') {
        return res.poids && res.firmness && res.puree_image;
      } else {
        return res.poids_image && res.firmness_image && res.puree_image;
      }
    });
  };

  const saveCompleteRapport = async (lot: QualityRapportLot) => {
    try {
      toast({
        title: "Finalisation du rapport...",
        description: "Sauvegarde du rapport complet et génération du PDF",
        variant: "default",
      });
      
      // Convert uploaded images to URLs (they should be URLs at this point)
      const imageUrls: Record<string | number, string[]> = {};
      const testResultsWithUrls: Record<string | number, any> = {};
      
      for (const calibre of lot.calibres) {
        const calibreImages = uploadedImages[calibre];
        const calibreResults = testResults[calibre] || {};
        
        if (calibreImages && calibreImages.length > 0) {
          // If they're File objects, they need to be uploaded first
          if (calibreImages[0] instanceof File) {
            const urls = await uploadCalibreImages(calibreImages as File[], lot.id, String(calibre));
            imageUrls[calibre] = urls;
          } else {
            // They're already URLs
            imageUrls[calibre] = calibreImages as unknown as string[];
          }
        }
        
        // Process test result images
        const processedResults = { ...calibreResults };
        for (const [key, value] of Object.entries(calibreResults)) {
          if (key.endsWith('_image') && value instanceof File) {
            const testImageUrls = await uploadCalibreImages([value], lot.id, `${calibre}_${key.replace('_image', '')}`);
            processedResults[key] = testImageUrls[0];
          }
        }
        testResultsWithUrls[calibre] = processedResults;
      }

      const rapportData: Omit<QualityRapport, 'id'> = {
        lotNumber: lot.lotNumber,
        date: lot.date,
        controller: lot.controller,
        palletNumber: lot.palletNumber,
        calibres: lot.calibres,
        images: imageUrls,
        testResults: testResultsWithUrls,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        // Additional metadata for better organization
        metadata: {
          totalCalibresTested: lot.calibres.length,
          totalImagesUploaded: Object.values(imageUrls).reduce((sum, imgs) => sum + imgs.length, 0),
          inputMode: inputMode,
          completedBy: user?.email || user?.uid || 'unknown',
          processingTime: new Date().toISOString(),
          qualityScore: calculateQualityScore(testResultsWithUrls),
          formData: lot.formData
        }
      };

      const rapportId = await saveQualityRapport(rapportData);
      
      // Generate and save both PDF reports
      await generateAndSavePDF(rapportId, { ...rapportData, id: rapportId });
      
      toast({
        title: "Rapport terminé avec succès!",
        description: `Rapport ID: ${rapportId.substring(0, 8)}... - ${lot.calibres.length} calibres traités`,
        variant: "default",
      });
      
      // Refresh the list to show the new completed rapport
      await loadRapportsFromFirestore();
      
      // Optionally navigate back to the main list
      setSelectedLot(null);
      setSelectedCalibre(null);
      
    } catch (error) {
      console.error('Error saving complete rapport:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors de la sauvegarde du rapport complet: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  // Helper function to calculate quality score based on test results
  const calculateQualityScore = (testResults: Record<string | number, any>): number => {
    const calibres = Object.keys(testResults);
    if (calibres.length === 0) return 0;
    
    let totalScore = 0;
    let calibreCount = 0;
    
    for (const calibre of calibres) {
      const results = testResults[calibre];
      if (results) {
        let calibreScore = 100; // Start with perfect score
        
        // Deduct points based on test results
        if (results.poids && parseFloat(results.poids) < 200) calibreScore -= 10;
        if (results.firmness && parseFloat(results.firmness) < 0.5) calibreScore -= 15;
        
        totalScore += Math.max(0, calibreScore);
        calibreCount++;
      }
    }
    
    return calibreCount > 0 ? Math.round(totalScore / calibreCount) : 0;
  };

  const generateAndSavePDF = async (rapportId: string, rapport: QualityRapport) => {
    try {
      setIsGeneratingPDF(true);
      
      toast({
        title: "Génération des rapports PDF...",
        description: "Création du rapport standard et du rapport visuel",
        variant: "default",
      });
      
      // Generate standard PDF report
      const pdfBlob = await generateQualityRapportPDF(rapport);
      const pdfFileName = `rapport_${rapport.lotNumber}_${Date.now()}.pdf`;
      const pdfUrl = await uploadPDFToStorage(pdfBlob, pdfFileName);
      
      // Generate visual PDF report with images
      const visualPdfBlob = await generateVisualRapportPDF(rapport);
      const visualPdfFileName = `rapport_visuel_${rapport.lotNumber}_${Date.now()}.pdf`;
      const visualPdfUrl = await uploadPDFToStorage(visualPdfBlob, visualPdfFileName);
      
      // Update rapport with PDF URLs and download information
      await updateQualityRapport(rapportId, { 
        pdfUrl,
        visualPdfUrl,
        downloadInfo: {
          standardPdf: {
            url: pdfUrl,
            fileName: pdfFileName,
            size: pdfBlob.size,
            generatedAt: new Date().toISOString()
          },
          visualPdf: {
            url: visualPdfUrl,
            fileName: visualPdfFileName,
            size: visualPdfBlob.size,
            generatedAt: new Date().toISOString()
          }
        }
      });
      
      toast({
        title: "PDFs générés avec succès!",
        description: "Rapport standard et rapport visuel disponibles au téléchargement",
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erreur PDF",
        description: `Erreur lors de la génération du PDF: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const updateLotStatus = (status: string) => {
    if (!selectedLot) return;
    // Here you would update the lot status in your backend
    console.log('Updating lot status:', selectedLot.id, status);
    setSelectedLot(prev => prev ? { ...prev, status } : prev);
    alert(`Lot ${selectedLot.id} marked as ${status}`);
  };

  const archiveRapport = async (lotId: string) => {
    try {
      const confirmArchive = window.confirm("Êtes-vous sûr de vouloir archiver ce rapport? Il sera marqué comme archivé mais restera accessible.");
      if (!confirmArchive) return;

      console.log('Attempting to archive lot/rapport with ID:', lotId);

      // Find the rapport associated with this lot
      const existingRapports = await getQualityRapports();
      console.log('Available rapports:', existingRapports.map(r => ({ id: r.id, lotNumber: r.lotNumber })));
      
      const rapportToArchive = existingRapports.find(rapport => 
        rapport.id === lotId || 
        rapport.lotNumber === lotId ||
        rapport.id.startsWith(lotId) ||
        lotId.startsWith(rapport.id)
      );

      if (!rapportToArchive) {
        // If no rapport exists, update the quality control lot status instead
        console.log('No rapport found for lot ID:', lotId);
        toast({
          title: "Information",
          description: "Ce lot n'a pas encore de rapport finalisé. Le statut du lot sera mis à jour localement.",
          variant: "default",
        });
        
        // Update the local state for now
        setSubmittedLots(prev => 
          prev.map(lot => 
            lot.id === lotId ? { ...lot, status: 'archived' } : lot
          )
        );
        
        toast({
          title: "Lot marqué comme archivé",
          description: "Le lot a été marqué comme archivé dans la liste locale",
          variant: "default",
        });
        return;
      }

      console.log('Found rapport to archive:', rapportToArchive.id);

      // Archive the actual rapport
      await updateQualityRapport(rapportToArchive.id, { 
        status: 'archived',
        archivedAt: new Date().toISOString(),
        archivedBy: user?.email || user?.uid || 'unknown'
      });
      
      toast({
        title: "Rapport archivé avec succès",
        description: `Le rapport ${rapportToArchive.lotNumber} a été archivé dans Firebase`,
        variant: "default",
      });
      
      // Refresh the list
      await loadRapportsFromFirestore();
      
    } catch (error) {
      console.error('Error archiving rapport:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors de l'archivage: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'archived':
        return 'text-gray-600 bg-gray-100';
      case 'submitted':
        return 'text-blue-600 bg-blue-100';
      case 'draft':
        return 'text-yellow-600 bg-yellow-100';
      case 'needs_revision':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'archived':
        return <Archive className="w-4 h-4" />;
      case 'submitted':
        return <Upload className="w-4 h-4" />;
      case 'draft':
        return <AlertCircle className="w-4 h-4" />;
      case 'needs_revision':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  if (selectedCalibre && selectedLot) {
    const calibreImages = uploadedImages[selectedCalibre] || [];
    const savedImages = savedImageUrls[selectedCalibre] || [];
    const allImages = [...calibreImages, ...savedImages];
    const calibreResults = testResults[selectedCalibre] || {};
    
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => setSelectedCalibre(null)}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-2"
            >
              ← Back to Lot {selectedLot.id}
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              Calibre {selectedCalibre} - Quality Control
            </h1>
            <p className="text-gray-600">Lot: {selectedLot.id} | Pallet: {selectedLot.palletNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Upload Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Unit Images ({allImages.length}/12 required)
            </h3>
            
            <div className="mb-6 space-y-3">
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(allImages.length / 12) * 100}%` }}
                ></div>
              </div>
              
              {/* Drag and Drop Area */}
              <div 
                className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                  isDragging 
                    ? 'border-blue-400 bg-blue-50' 
                    : calibreImages.length >= 12 
                      ? 'border-gray-300 bg-gray-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, selectedCalibre)}
              >
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    {isDragging ? 'Drop images here' : 'Drag and drop images here'}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    or click to browse files (max 12 images)
                  </p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}                  disabled={allImages.length >= 12}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    allImages.length >= 12 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                    >
                      Browse Files
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Upload Options */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(selectedCalibre, e.target.files)}
                    className="hidden"
                  />
                  <button
                    onClick={() => addSingleImage(selectedCalibre)}
                    disabled={allImages.length >= 12}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      allImages.length >= 12 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Add Single Image
                  </button>
                  
                  <span className="flex items-center text-sm text-gray-500 px-3 py-2">
                    {12 - allImages.length} slot{12 - allImages.length !== 1 ? 's' : ''} remaining
                  </span>
                </div>
                
                {/* Multi-selection controls */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      if (isSelectionMode) {
                        setSelectedImages([]);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelectionMode 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isSelectionMode ? 'Exit Selection' : 'Select Multiple'}
                  </button>
                  
                  {isSelectionMode && (
                    <>
                      <button
                        onClick={() => selectAllImages(selectedCalibre)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllImages}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                      >
                        Deselect All
                      </button>
                      {selectedImages.length > 0 && (
                        <button
                          onClick={() => deleteSelectedImages(selectedCalibre)}
                          className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
                        >
                          <X className="w-4 h-4" />
                          Delete ({selectedImages.length})
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Status Message */}
              {allImages.length === 12 && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">All 12 images uploaded successfully!</span>
                </div>
              )}
              
              {allImages.length < 12 && allImages.length > 0 && (
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {12 - allImages.length} more image{12 - allImages.length !== 1 ? 's' : ''} needed
                  </span>
                </div>
              )}
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {allImages.map((file, index) => (
                <div key={index} className="relative group">
                  <div 
                    className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      isSelectionMode && selectedImages.includes(index)
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-blue-400'
                    }`}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleImageSelection(index);
                      }
                    }}
                  >
                    <img
                      src={typeof file === 'string' ? file : URL.createObjectURL(file)}
                      alt={`Unit ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Selection checkbox */}
                    {isSelectionMode && (
                      <div className="absolute top-2 left-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedImages.includes(index)
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-white border-gray-300'
                        }`}>
                          {selectedImages.includes(index) && (
                            <CheckCircle className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Individual delete button (only shown when not in selection mode) */}
                    {!isSelectionMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(selectedCalibre, index);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    
                    {/* Image number */}
                    <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      {index + 1}
                    </div>
                    
                    {/* Selection indicator */}
                    {isSelectionMode && selectedImages.includes(index) && (
                      <div className="absolute inset-0 bg-blue-600 bg-opacity-20 rounded-lg"></div>
                    )}
                    
                    {/* Saved indicator for uploaded images */}
                    {typeof file === 'string' && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                        <CheckCircle className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: 12 - allImages.length }).map((_, index) => (
                <div 
                  key={`empty-${index}`} 
                  className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                  onClick={() => !isSelectionMode && addSingleImage(selectedCalibre)}
                >
                  <Plus className="w-8 h-8 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Add Image</span>
                  <span className="text-xs text-gray-400">#{allImages.length + index + 1}</span>
                </div>
              ))}
            </div>
            
            {/* Selection summary */}
            {isSelectionMode && selectedImages.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteSelectedImages(selectedCalibre)}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      <X className="w-3 h-3" />
                      Delete Selected
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Keyboard shortcuts info */}
            {isSelectionMode && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                <strong>Keyboard shortcuts:</strong> Ctrl+A (Select all) | Delete (Delete selected) | Escape (Exit selection mode)
              </div>
            )}
          </div>

          {/* Test Results Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Test Results
            </h3>

            <div className="mb-4">
              <label id="input-mode-label" className="text-sm font-medium text-gray-700 mb-2 block">Input Mode</label>
              <div className="flex gap-2" role="radiogroup" aria-labelledby="input-mode-label">
                <button
                  onClick={() => setInputMode('manual')}
                  role="radio"
                  aria-checked={inputMode === 'manual'}
                  aria-label="Select manual input mode for test results"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    inputMode === 'manual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Manual Input
                </button>
                <button
                  onClick={() => setInputMode('image')}
                  role="radio"
                  aria-checked={inputMode === 'image'}
                  aria-label="Select image upload mode for test results"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    inputMode === 'image'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Image Upload
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Poids (Weight) */}
              <div>
                <label htmlFor={`poids-${selectedCalibre}`} className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Poids (Weight)
                </label>
                {inputMode === 'manual' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={`poids-${selectedCalibre}`}
                      type="number"
                      placeholder="240"
                      value={calibreResults.poids || ''}
                      onChange={(e) => handleTestResultChange(selectedCalibre, 'poids', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Poids en grammes"
                    />
                    <span className="text-gray-500">g</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      id={`poids-image-${selectedCalibre}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleTestImageUpload(selectedCalibre, 'poids', e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Upload image for weight test result"
                    />
                    {calibreResults.poids_image && (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Weight image uploaded</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Firmness */}
              <div>
                <label htmlFor={`firmness-${selectedCalibre}`} className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Firmness
                </label>
                {inputMode === 'manual' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={`firmness-${selectedCalibre}`}
                      type="number"
                      step="0.1"
                      placeholder="0.7"
                      value={calibreResults.firmness || ''}
                      onChange={(e) => handleTestResultChange(selectedCalibre, 'firmness', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Firmness en kg/cm²"
                    />
                    <span className="text-gray-500">kg/cm²</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      id={`firmness-image-${selectedCalibre}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleTestImageUpload(selectedCalibre, 'firmness', e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Upload image for firmness test result"
                    />
                    {calibreResults.firmness_image && (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Firmness image uploaded</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Purée (Always image) */}
              <div>
                <label htmlFor={`puree-${selectedCalibre}`} className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Purée Test Result (Image Required)
                </label>
                <div className="space-y-2">
                  <input
                    id={`puree-${selectedCalibre}`}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleTestImageUpload(selectedCalibre, 'puree', e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Upload image for purée test result"
                  />
                  {calibreResults.puree_image && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Purée test image uploaded</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => saveCaliberData(selectedCalibre)}
              disabled={isSaving}
              className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Saving to Firestore...' : 'Save to Firestore'}
            </button>
            
            {/* Debug Upload Button */}
            {allImages.length > 0 && (
              <button
                onClick={async () => {
                  try {
                    const testFile = calibreImages[0];
                    if (testFile) {
                      console.log('Testing single image upload...');
                      const url = await uploadQualityControlImage(testFile, selectedLot.id, 'calibre', String(selectedCalibre));
                      console.log('Test upload successful:', url);
                      toast({
                        title: "Test réussi",
                        description: "Upload test réussi - Firebase Storage fonctionne",
                        variant: "default",
                      });
                    }
                  } catch (error) {
                    console.error('Test upload failed:', error);
                    toast({
                      title: "Test échoué",
                      description: `Erreur: ${(error as Error).message}`,
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
              >
                🔧 Test Upload (Debug)
              </button>
            )}
            
            {/* Comprehensive Firebase Diagnostic */}
            <button
              onClick={async () => {
                try {
                  console.log('🔍 Starting comprehensive Firebase diagnostic...');
                  
                  // 1. Check user authentication and permissions
                  const { checkUserPermissions } = await import('../../lib/qualityControlService');
                  await checkUserPermissions();
                  
                  // 2. Test Firebase Storage connection
                  const { ref } = await import('firebase/storage');
                  const { storage } = await import('../../lib/firebase');
                  const testRef = ref(storage, '.diagnostic-test');
                  console.log('✅ Storage reference created successfully');
                  
                  // 3. Test simple upload to test path
                  if (calibreImages.length > 0) {
                    const { testSimpleUpload } = await import('../../lib/qualityControlService');
                    const testFile = calibreImages[0];
                    console.log('🧪 Testing simple upload...');
                    const simpleUrl = await testSimpleUpload(testFile);
                    console.log('✅ Simple upload successful:', simpleUrl);
                    
                    // 4. Test QC path upload
                    const { testQualityControlPathUpload } = await import('../../lib/qualityControlService');
                    console.log('🎯 Testing QC path upload...');
                    const qcUrl = await testQualityControlPathUpload(testFile, selectedLot.id, String(selectedCalibre));
                    console.log('✅ QC path upload successful:', qcUrl);
                    
                    toast({
                      title: "Diagnostic Réussi! ✅",
                      description: "Tous les tests Firebase sont passés. Les uploads devraient fonctionner.",
                      variant: "default",
                    });
                  } else {
                    toast({
                      title: "Diagnostic Partiel ✅",
                      description: "Authentification OK. Ajoutez des images pour tester les uploads.",
                      variant: "default",
                    });
                  }
                  
                } catch (error) {
                  console.error('❌ Diagnostic failed:', error);
                  toast({
                    title: "Diagnostic Échoué ❌",
                    description: `Problème détecté: ${(error as Error).message}`,
                    variant: "destructive",
                  });
                }
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              🔍 Diagnostic Complet Firebase
            </button>
            
            {/* Firebase Storage Connection Test */}
            <button
              onClick={async () => {
                try {
                  const { ref } = await import('firebase/storage');
                  const { storage } = await import('../../lib/firebase');
                  
                  console.log('Testing Firebase Storage connection...');
                  const testRef = ref(storage, '.connection-test');
                  console.log('Storage reference created successfully');
                  
                  // Test authentication
                  const { auth } = await import('../../lib/firebase');
                  const user = auth.currentUser;
                  
                  if (!user) {
                    throw new Error('No authenticated user found');
                  }
                  
                  console.log('Authentication OK:', { email: user.email, uid: user.uid });
                  
                  toast({
                    title: "Connexion OK",
                    description: "Firebase Storage et Authentication fonctionnent correctement",
                    variant: "default",
                  });
                } catch (error) {
                  console.error('Connection test failed:', error);
                  toast({
                    title: "Test de connexion échoué",
                    description: `Erreur: ${(error as Error).message}`,
                    variant: "destructive",
                  });
                }
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              🔗 Test Firebase Connection
            </button>
            
            {/* Simple Upload Test */}
            {allImages.length > 0 && (
              <button
                onClick={async () => {
                  try {
                    const { testSimpleUpload } = await import('../../lib/qualityControlService');
                    const testFile = calibreImages[0];
                    if (testFile) {
                      console.log('🧪 Testing simple upload method...');
                      const url = await testSimpleUpload(testFile);
                      console.log('✅ Simple upload successful:', url);
                      toast({
                        title: "Test Simple réussi!",
                        description: "Upload simple fonctionne - problème identifié avec uploadBytesResumable",
                        variant: "default",
                      });
                    }
                  } catch (error) {
                    console.error('❌ Simple upload failed:', error);
                    toast({
                      title: "Test Simple échoué",
                      description: `Erreur: ${(error as Error).message}`,
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
              >
                🔬 Test Simple Upload
              </button>
            )}
            
            {/* Quality Control Path Test */}
            {allImages.length > 0 && (
              <button
                onClick={async () => {
                  try {
                    const { testQualityControlPathUpload } = await import('../../lib/qualityControlService');
                    const testFile = calibreImages[0];
                    if (testFile) {
                      console.log('🎯 Testing QC path upload method...');
                      const url = await testQualityControlPathUpload(testFile, selectedLot.id, String(selectedCalibre));
                      console.log('✅ QC path upload successful:', url);
                      toast({
                        title: "Test QC Path réussi!",
                        description: "Upload avec chemin quality control fonctionne!",
                        variant: "default",
                      });
                    }
                  } catch (error) {
                    console.error('❌ QC path upload failed:', error);
                    toast({
                      title: "Test QC Path échoué",
                      description: `Erreur: ${(error as Error).message}`,
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
              >
                🎯 Test QC Path Upload
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedLot) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => setSelectedLot(null)}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-2"
            >
              ← Back to Lots
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Lot Details</h1>
            <p className="text-gray-600">Quality Control - Chief Phase</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => updateLotStatus('complete')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Complete
            </button>
            <button
              onClick={() => updateLotStatus('needs_revision')}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <AlertCircle className="w-4 h-4" />
              Needs Revision
            </button>
          </div>
        </div>

        {/* Lot Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Lot Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Lot Number</label>
              <p className="text-lg font-semibold">{selectedLot.lotNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Date</label>
              <p className="text-lg font-semibold">{selectedLot.date}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Controller</label>
              <p className="text-lg font-semibold">{selectedLot.controller}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Reference</label>
              <p className="text-lg font-semibold">{selectedLot.palletNumber}</p>
            </div>
          </div>
          
          {/* Additional form data info */}
          {selectedLot.formData && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Form Data Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {selectedLot.formData.product && (
                  <div>
                    <span className="text-gray-500">Product:</span>
                    <span className="ml-2 font-medium">{selectedLot.formData.product}</span>
                  </div>
                )}
                {selectedLot.formData.variety && (
                  <div>
                    <span className="text-gray-500">Variety:</span>
                    <span className="ml-2 font-medium">{selectedLot.formData.variety}</span>
                  </div>
                )}
                {selectedLot.formData.category && (
                  <div>
                    <span className="text-gray-500">Category:</span>
                    <span className="ml-2 font-medium">{selectedLot.formData.category}</span>
                  </div>
                )}
                {selectedLot.formData.palettes && (
                  <div>
                    <span className="text-gray-500">Palettes:</span>
                    <span className="ml-2 font-medium">{selectedLot.formData.palettes.length}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calibres */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Calibres à traiter</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Progression: {selectedLot.calibres.filter(cal => {
                  const images = uploadedImages[cal] || [];
                  const results = testResults[cal] || {};
                  return images.length === 12 && 
                    (inputMode === 'manual' 
                      ? results.poids && results.firmness && results.puree_image
                      : results.poids_image && results.firmness_image && results.puree_image);
                }).length} / {selectedLot.calibres.length}
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(selectedLot.calibres.filter(cal => {
                      const images = uploadedImages[cal] || [];
                      const results = testResults[cal] || {};
                      return images.length === 12 && 
                        (inputMode === 'manual' 
                          ? results.poids && results.firmness && results.puree_image
                          : results.poids_image && results.firmness_image && results.puree_image);
                    }).length / selectedLot.calibres.length) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.isArray(selectedLot.calibres) && selectedLot.calibres.length > 0 ? (
              selectedLot.calibres.map((calibre, idx) => {
                const images = uploadedImages[calibre] || [];
                const results = testResults[calibre] || {};
                const isComplete = images.length === 12 && 
                  (inputMode === 'manual' 
                    ? results.poids && results.firmness && results.puree_image
                    : results.poids_image && results.firmness_image && results.puree_image);
                return (
                  <button
                    key={calibre + '-' + idx}
                    onClick={() => setSelectedCalibre(calibre)}
                    className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors text-center ${
                      isComplete ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="text-2xl font-bold mb-2">{calibre}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      Images: {images.length}/12
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      Tests: {Object.keys(results).filter(k => results[k] && results[k] !== '').length}
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      isComplete ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isComplete ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Terminé
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          En cours
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full text-gray-500">No calibres</div>
            )}
          </div>
          
          {/* Complete rapport button */}
          {selectedLot.calibres.every(cal => {
            const images = uploadedImages[cal] || [];
            const results = testResults[cal] || {};
            return images.length === 12 && 
              (inputMode === 'manual' 
                ? results.poids && results.firmness && results.puree_image
                : results.poids_image && results.firmness_image && results.puree_image);
          }) && selectedLot.calibres.length > 0 && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-800">Rapport prêt à finaliser</h3>
                  <p className="text-sm text-green-600">Tous les calibres sont terminés. Vous pouvez maintenant finaliser le rapport.</p>
                </div>
                <button
                  onClick={() => saveCompleteRapport(selectedLot)}
                  disabled={isSaving || isGeneratingPDF}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {isSaving || isGeneratingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving || isGeneratingPDF ? 'Finalisation...' : 'Finaliser le Rapport'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quality Control - Chief Phase</h1>
          <p className="text-gray-600">Review and process submitted lots from Firebase</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRapportsFromFirestore}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            {isLoading ? 'Loading from Firebase...' : 'Refresh from Firebase'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600">Loading real lots from Firebase...</p>
            <p className="text-sm text-gray-500">This may take a moment</p>
          </div>
        </div>
      ) : (
        <>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="date-from-filter" className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
            <input
              id="date-from-filter"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value || '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter lots from this date onwards"
            />
          </div>
          <div>
            <label htmlFor="date-to-filter" className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
            <input
              id="date-to-filter"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value || '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter lots up to this date"
            />
          </div>
          <div>
            <label htmlFor="calibre-filter" className="block text-sm font-medium text-gray-700 mb-2">Calibre</label>
            <select
              id="calibre-filter"
              value={filters.calibre || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, calibre: e.target.value || '' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter lots by calibre size"
            >
              <option value="">All Calibres</option>
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="18">18</option>
              <option value="20">20</option>
              <option value="22">22</option>
            </select>
          </div>
          <div>
            <label htmlFor="lot-search" className="block text-sm font-medium text-gray-700 mb-2">Lot Number / Reference</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="lot-search"
                type="text"
                placeholder="Search lot number or reference..."
                value={filters.lotId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, lotId: e.target.value || '' }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Search lots by lot number or reference"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lots Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Quality Control Lots from Firebase ({filteredLots.length})</h2>
          <p className="text-sm text-gray-500 mt-1">
            Showing completed lots ready for rapport processing
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Controller</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calibres</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLots.map((lot) => (
                <tr key={lot.id || Math.random()} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div>
                      <div className="font-semibold">{lot.lotNumber}</div>
                      {lot.id !== lot.lotNumber && (
                        <div className="text-xs text-gray-500 mt-1">ID: {lot.id.substring(0, 8)}...</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lot.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lot.controller}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div>{lot.palletNumber}</div>
                      {lot.formData?.clientLot && lot.formData.clientLot !== lot.palletNumber && (
                        <div className="text-xs text-gray-400 mt-1">Client: {lot.formData.clientLot}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(lot.calibres) && lot.calibres.length > 0 ? (
                        lot.calibres.map((cal, idx) => (
                          <span 
                            key={cal + '-' + idx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {cal}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">No calibres</span>
                      )}
                    </div>
                    {Array.isArray(lot.calibres) && lot.calibres.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        {lot.calibres.length} calibre{lot.calibres.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lot.status)}`}>
                      {getStatusIcon(lot.status)}
                      {typeof lot.status === 'string' ? lot.status.replace('_', ' ') : 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedLot(lot)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      
                      {/* Download options for completed lots */}
                      {(lot.status === 'completed' || lot.status === 'submitted') && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => downloadRapportPDF(lot.id)}
                            disabled={isGeneratingPDF}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            title="Télécharger le rapport standard"
                          >
                            {isGeneratingPDF ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            PDF
                          </button>
                          
                          <button
                            onClick={() => downloadVisualReport(lot.id)}
                            disabled={isGeneratingPDF}
                            className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                            title="Télécharger le rapport visuel avec images"
                          >
                            {isGeneratingPDF ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            Visuel
                          </button>
                          
                          {/* Archive button for completed reports */}
                          <button
                            onClick={() => archiveRapport(lot.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            title="Archiver ce rapport"
                          >
                            <Archive className="w-4 h-4" />
                            Archive
                          </button>
                        </div>
                      )}
                      
                      {/* Processing indicator for in-progress lots */}
                      {lot.status === 'draft' && (
                        <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                          <AlertCircle className="w-4 h-4" />
                          En cours
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default Rapportqualité;