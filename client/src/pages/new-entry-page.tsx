import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Save, CheckCircle, Clock, ArrowLeft, ArrowRight, Package, Truck, Factory, Warehouse, Ship, MapPin } from "lucide-react";
import { addAvocadoTracking, getFarms } from "@/lib/firebaseService";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NewEntryPage() {
  const { t } = useLanguage();
  const [farms, setFarms] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadFarms = async () => {
      try {
        const farmsData = await getFarms();
        setFarms(farmsData);
      } catch (error) {
        console.error("Error loading farms:", error);
      }
    };
    loadFarms();
  }, []);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  const [formData, setFormData] = useState({
    harvest: {
      harvestDate: "",
      farmLocation: "",
      farmerId: "",
      lotNumber: "",
      variety: "hass",
      avocadoType: "",
    },
    transport: {
      lotNumber: "",
      transportCompany: "",
      driverName: "",
      vehicleId: "",
      departureDateTime: "",
      arrivalDateTime: "",
      temperature: 0,
    },
    sorting: {
      lotNumber: "",
      sortingDate: "",
      qualityGrade: "A",
      rejectedCount: 0,
      notes: "",
    },
    packaging: {
      lotNumber: "",
      packagingDate: "",
      boxId: "",
      workerIds: [],
      netWeight: 0,
      avocadoCount: 0,
      boxType: "case",
      boxTypes: [],
      calibers: [],
      boxWeights: [],
      paletteNumbers: [],
    },
    storage: {
      boxId: "",
      entryDate: "",
      storageTemperature: 0,
      storageRoomId: "",
      exitDate: "",
    },
    export: {
      boxId: "",
      loadingDate: "",
      containerId: "",
      driverName: "",
      vehicleId: "",
      destination: "",
    },
    delivery: {
      boxId: "",
      estimatedDeliveryDate: "",
      actualDeliveryDate: "",
      clientName: "",
      clientLocation: "",
      notes: "",
    },
    selectedFarm: "",
    packagingDate: "",
    boxId: "",
    boxTypes: [],
    calibers: [],
    avocadoCount: 0,
    status: "draft",
    completedSteps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const toast = (message) => {
    // Mock toast function for demo
    console.log(message.title + ": " + message.description);
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return formData.harvest.harvestDate && formData.harvest.farmerId && formData.harvest.lotNumber;
      case 2:
        return formData.transport.transportCompany && formData.transport.driverName;
      case 3:
        return formData.sorting.sortingDate && formData.sorting.qualityGrade;
      case 4:
        return formData.packagingDate && formData.boxId;
      case 5:
        return formData.storage.entryDate && formData.storage.storageRoomId;
      case 6:
        return formData.export.loadingDate && formData.export.containerId;
      case 7:
        return formData.delivery.estimatedDeliveryDate && formData.delivery.clientName;
      default:
        return false;
    }
  };

  const getStepCompletionPercentage = () => {
    const completedSteps = formData.completedSteps?.length || 0;
    return Math.round((completedSteps / 7) * 100);
  };

  const saveDraft = async (silent = false) => {
    setIsSavingDraft(true);
    try {
      // Remove id, createdAt, and updatedAt from formData
      const { id, createdAt, updatedAt, ...draftData } = formData;

      // Add draft status
      const draftSubmission = {
        ...draftData,
        status: 'draft',
        lastSaved: new Date().toISOString()
      };

      // Save draft to Firebase
      const savedDraft = await addAvocadoTracking(draftSubmission);
      setDraftId(savedDraft.id);
      setLastSaved(new Date().toISOString());
    } catch (error) {
      console.error('Error saving draft:', error);
      // Show error alert
      setError('Failed to save draft. Please try again.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Remove id, createdAt, and updatedAt from formData
      const { id, createdAt, updatedAt, ...submissionData } = formData;

      // Submit data to Firebase
      await addAvocadoTracking(submissionData);

      // Navigate to lots page after successful submission
      navigate('/lots');
    } catch (error) {
      console.error('Error submitting form:', error);
      // Show error alert
      setError('Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (section, field, value) => {
    setFormData((prev) => {
      const updatedSection = {
        ...(prev[section] || {}),
        [field]: value,
      };
      const newData = {
        ...prev,
        [section]: updatedSection,
        updatedAt: new Date().toISOString(),
      };
      return newData;
    });
  };

  const markStepComplete = () => {
    if (validateCurrentStep()) {
      setFormData(prev => ({
        ...prev,
        completedSteps: [...new Set([...(prev.completedSteps || []), currentStep])],
        updatedAt: new Date().toISOString(),
      }));
    }
  };

  const nextStep = () => {
    markStepComplete();
    setCurrentStep(prev => Math.min(prev + 1, 7));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  const handleBoxTypeToggle = (boxType) => {
    setFormData(prev => ({
      ...prev,
      boxTypes: prev.boxTypes.includes(boxType)
        ? prev.boxTypes.filter(t => t !== boxType)
        : [...prev.boxTypes, boxType]
    }));
  };

  const handleCaliberToggle = (caliber) => {
    setFormData(prev => ({
      ...prev,
      calibers: prev.calibers.includes(caliber)
        ? prev.calibers.filter(c => c !== caliber)
        : [...prev.calibers, caliber]
    }));
  };

  const stepIcons = {
    1: "🌱",
    2: "🚛",
    3: "🏭",
    4: "📦",
    5: "🏪",
    6: "🚢",
    7: "📍"
  };

  const stepTitles = {
    1: t('newEntry.harvest'),
    2: "Transport",
    3: t('newEntry.sorting'),
    4: t('newEntry.packaging'),
    5: t('newEntry.storage'),
    6: t('newEntry.shipping'),
    7: "Livraison"
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-3 text-green-800">
                <span className="text-2xl">🌱</span>
                <div>
                  <div>{t('newEntry.harvestTitle')}</div>
                  <div className="text-sm font-normal text-green-600">{t('newEntry.harvestSubtitle')}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="harvestDate" className="flex items-center gap-2 font-semibold">
                    📅 {t('newEntry.harvestDate')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="harvestDate"
                    type="datetime-local"
                    value={formData.harvest?.harvestDate || ""}
                    onChange={(e) => handleChange("harvest", "harvestDate", e.target.value)}
                    className="border-2 focus:border-green-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selectedFarm" className="flex items-center gap-2 font-semibold">
                    🏡 {t('newEntry.farm')}
                  </Label>
                  <Select
                    value={formData.selectedFarm || ""}
                    onValueChange={(value) => setFormData({ ...formData, selectedFarm: value })}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.chooseFarm')} />
                    </SelectTrigger>
                    <SelectContent>
                      {farms.map((farm) => (
                        <SelectItem key={farm.id} value={farm.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{farm.name}</span>
                            <span className="text-gray-500">- {farm.location}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="farmerId" className="flex items-center gap-2 font-semibold">
                    👨‍🌾 {t('newEntry.agronomistId')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="farmerId"
                    value={formData.harvest?.farmerId || ""}
                    onChange={(e) => handleChange("harvest", "farmerId", e.target.value)}
                    className="border-2 focus:border-green-500 transition-colors"
                    placeholder={t('newEntry.agronomistPlaceholder')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lotNumber" className="flex items-center gap-2 font-semibold">
                    🏷️ {t('newEntry.lotId')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lotNumber"
                    value={formData.harvest?.lotNumber || ""}
                    onChange={(e) => handleChange("harvest", "lotNumber", e.target.value)}
                    className="border-2 focus:border-green-500 transition-colors"
                    placeholder={t('newEntry.lotPlaceholder')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avocadoType" className="flex items-center gap-2 font-semibold">
                    🥑 {t('newEntry.avocadoType')}
                  </Label>
                  <Select
                    value={formData.harvest?.avocadoType || ""}
                    onValueChange={(value) => handleChange("harvest", "avocadoType", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conventionnel">🌱 Conventionnel</SelectItem>
                      <SelectItem value="bio">🌿 Bio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variety" className="flex items-center gap-2 font-semibold">
                    🌳 {t('newEntry.variety')}
                  </Label>
                  <Select
                    value={formData.harvest?.variety || "hass"}
                    onValueChange={(value) => handleChange("harvest", "variety", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-green-500">
                      <SelectValue placeholder={t('newEntry.selectVariety')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hass">🥑 Hass</SelectItem>
                      <SelectItem value="fuerte">🌿 Fuerte</SelectItem>
                      <SelectItem value="bacon">🥓 Bacon</SelectItem>
                      <SelectItem value="zutano">🌱 Zutano</SelectItem>
                      <SelectItem value="other">❓ Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardTitle className="flex items-center gap-3 text-blue-800">
                <span className="text-2xl">🚛</span>
                <div>
                  <div>Transport vers l'usine</div>
                  <div className="text-sm font-normal text-blue-600">Informations de transport et logistique</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="transportCompany" className="flex items-center gap-2 font-semibold">
                    🏢 Société de transport <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="transportCompany"
                    value={formData.transport?.transportCompany || ""}
                    onChange={(e) => handleChange("transport", "transportCompany", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                    placeholder="Ex: Transport Express SA"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverName" className="flex items-center gap-2 font-semibold">
                    👨‍💼 Nom du chauffeur <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="driverName"
                    value={formData.transport?.driverName || ""}
                    onChange={(e) => handleChange("transport", "driverName", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                    placeholder="Ex: Jean Dupont"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleId" className="flex items-center gap-2 font-semibold">
                    🚚 ID du véhicule
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="vehicleId"
                      value={formData.transport?.vehicleId || ""}
                      onChange={(e) => handleChange("transport", "vehicleId", e.target.value)}
                      className="border-2 focus:border-blue-500 transition-colors"
                      placeholder="Ex: VH-2024-001"
                      lang="ar"
                      dir="rtl"
                    />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="px-3"
                        >
                          ع
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px]">
                        <div className="h-[400px] w-full">
                          <iframe
                            src="https://www.lexilogos.com/keyboard/arabic.htm"
                            className="w-full h-full border-none"
                            title="Arabic Keyboard"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature" className="flex items-center gap-2 font-semibold">
                    🌡️ Température (°C)
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={formData.transport?.temperature || ""}
                    onChange={(e) => handleChange("transport", "temperature", parseFloat(e.target.value) || 0)}
                    className="border-2 focus:border-blue-500 transition-colors"
                    placeholder="Ex: 4.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departureDateTime" className="flex items-center gap-2 font-semibold">
                    🕐 Date et heure de départ
                  </Label>
                  <Input
                    id="departureDateTime"
                    type="datetime-local"
                    value={formData.transport?.departureDateTime || ""}
                    onChange={(e) => handleChange("transport", "departureDateTime", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalDateTime" className="flex items-center gap-2 font-semibold">
                    🕑 Date et heure d'arrivée
                  </Label>
                  <Input
                    id="arrivalDateTime"
                    type="datetime-local"
                    value={formData.transport?.arrivalDateTime || ""}
                    onChange={(e) => handleChange("transport", "arrivalDateTime", e.target.value)}
                    className="border-2 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50">
              <CardTitle className="flex items-center gap-3 text-purple-800">
                <span className="text-2xl">🏭</span>
                <div>
                  <div>{t('newEntry.sortingTitle')}</div>
                  <div className="text-sm font-normal text-purple-600">{t('newEntry.sortingSubtitle')}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sortingDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de tri <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sortingDate"
                    type="datetime-local"
                    value={formData.sorting?.sortingDate || ""}
                    onChange={(e) => handleChange("sorting", "sortingDate", e.target.value)}
                    className="border-2 focus:border-purple-500 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualityGrade" className="flex items-center gap-2 font-semibold">
                    ⭐ {t('newEntry.qualityGrade')} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.sorting?.qualityGrade || "A"}
                    onValueChange={(value) => handleChange("sorting", "qualityGrade", value)}
                  >
                    <SelectTrigger className="border-2 focus:border-purple-500">
                      <SelectValue placeholder={t('newEntry.selectGrade')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">🌟 Grade A - Premium</SelectItem>
                      <SelectItem value="B">⭐ Grade B - Standard</SelectItem>
                      <SelectItem value="C">✨ Grade C - Économique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rejectedCount" className="flex items-center gap-2 font-semibold">
                    ❌ Avocats rejetés
                  </Label>
                  <Input
                    id="rejectedCount"
                    type="number"
                    min="0"
                    value={formData.sorting?.rejectedCount || ""}
                    onChange={(e) => handleChange("sorting", "rejectedCount", parseInt(e.target.value) || 0)}
                    className="border-2 focus:border-purple-500 transition-colors"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="sortingNotes" className="flex items-center gap-2 font-semibold">
                    📝 {t('newEntry.observations')}
                  </Label>
                  <Textarea
                    id="sortingNotes"
                    value={formData.sorting?.notes || ""}
                    onChange={(e) => handleChange("sorting", "notes", e.target.value)}
                    className="border-2 focus:border-purple-500 transition-colors"
                    placeholder={t('newEntry.observationsPlaceholder')}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
              <CardTitle className="flex items-center gap-3 text-amber-800">
                <span className="text-2xl">📦</span>
                <div>
                  <div>Emballage</div>
                  <div className="text-sm font-normal text-amber-600">Conditionnement des avocats</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="packagingDate" className="flex items-center gap-2 font-semibold">
                    📅 Date d'emballage <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="packagingDate"
                    type="datetime-local"
                    value={formData.packagingDate || ""}
                    onChange={(e) => setFormData({ ...formData, packagingDate: e.target.value })}
                    className="border-2 focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    ⚖️ Poids net de la boîte <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    {["4kg", "10kg"].map((weight) => (
                      <div key={weight} className="flex items-center space-x-2">
                        <Checkbox
                          id={`boxWeight-${weight}`}
                          checked={formData.packaging?.boxWeights?.includes(weight)}
                          onCheckedChange={() => {
                            const currentWeights = formData.packaging?.boxWeights || [];
                            const newWeights = currentWeights.includes(weight)
                              ? currentWeights.filter(w => w !== weight)
                              : [...currentWeights, weight];
                            handleChange("packaging", "boxWeights", newWeights);
                          }}
                        />
                        <label
                          htmlFor={`boxWeight-${weight}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {weight}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    📦 Numéro de palette <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-4">
                    {["220", "264", "90"].map((number) => (
                      <div key={number} className="flex items-center space-x-2">
                        <Checkbox
                          id={`palette-${number}`}
                          checked={formData.packaging?.paletteNumbers?.includes(number)}
                          onCheckedChange={() => {
                            const currentNumbers = formData.packaging?.paletteNumbers || [];
                            const newNumbers = currentNumbers.includes(number)
                              ? currentNumbers.filter(n => n !== number)
                              : [...currentNumbers, number];
                            handleChange("packaging", "paletteNumbers", newNumbers);
                          }}
                        />
                        <label
                          htmlFor={`palette-${number}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {number}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    📦 Type d'emballage <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    {["Caisse plastique", "Box"].map((boxType) => (
                      <div key={boxType} className="flex items-center space-x-2">
                        <Checkbox
                          id={`boxType-${boxType}`}
                          checked={formData.boxTypes.includes(boxType)}
                          onCheckedChange={() => handleBoxTypeToggle(boxType)}
                        />
                        <label
                          htmlFor={`boxType-${boxType}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {boxType}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    📏 Calibres
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {["12", "14", "16", "18", "20", "22", "24", "26", "28", "30"].map((caliber) => (
                      <div key={caliber} className="flex items-center space-x-2">
                        <Checkbox
                          id={`caliber-${caliber}`}
                          checked={formData.calibers.includes(caliber)}
                          onCheckedChange={() => handleCaliberToggle(caliber)}
                        />
                        <label
                          htmlFor={`caliber-${caliber}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Calibre {caliber}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50">
              <CardTitle className="flex items-center gap-3 text-indigo-800">
                <span className="text-2xl">🏪</span>
                <div>
                  <div>Stockage</div>
                  <div className="text-sm font-normal text-indigo-600">Informations de stockage</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="entryDate" className="flex items-center gap-2 font-semibold">
                    📅 Date d'entrée <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="entryDate"
                    type="datetime-local"
                    value={formData.storage?.entryDate || ""}
                    onChange={(e) => handleChange("storage", "entryDate", e.target.value)}
                    className="border-2 focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exitDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de sortie
                  </Label>
                  <Input
                    id="exitDate"
                    type="datetime-local"
                    value={formData.storage?.exitDate || ""}
                    onChange={(e) => handleChange("storage", "exitDate", e.target.value)}
                    className="border-2 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storageTemperature" className="flex items-center gap-2 font-semibold">
                    🌡️ Température (°C)
                  </Label>
                  <Input
                    id="storageTemperature"
                    type="number"
                    step="0.1"
                    value={formData.storage?.storageTemperature || ""}
                    onChange={(e) => handleChange("storage", "storageTemperature", parseFloat(e.target.value) || 0)}
                    className="border-2 focus:border-indigo-500 transition-colors"
                    placeholder="Ex: 4.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storageRoomId" className="flex items-center gap-2 font-semibold">
                    🏢 ID de la chambre froide <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="storageRoomId"
                    value={formData.storage?.storageRoomId || ""}
                    onChange={(e) => handleChange("storage", "storageRoomId", e.target.value)}
                    className="border-2 focus:border-indigo-500 transition-colors"
                    placeholder="Ex: ROOM-001"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 6:
        return (
          <Card className="border-l-4 border-l-teal-500">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardTitle className="flex items-center gap-3 text-teal-800">
                <span className="text-2xl">🚢</span>
                <div>
                  <div>Export</div>
                  <div className="text-sm font-normal text-teal-600">Informations d'exportation</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="loadingDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de chargement <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="loadingDate"
                    type="datetime-local"
                    value={formData.export?.loadingDate || ""}
                    onChange={(e) => handleChange("export", "loadingDate", e.target.value)}
                    className="border-2 focus:border-teal-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="containerId" className="flex items-center gap-2 font-semibold">
                    🗳️ ID du conteneur <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="containerId"
                    value={formData.export?.containerId || ""}
                    onChange={(e) => handleChange("export", "containerId", e.target.value)}
                    placeholder="Ex: CONT-2024-001"
                    className="border-2 focus:border-teal-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exportDriverName" className="flex items-center gap-2 font-semibold">
                    👨‍💼 Nom du chauffeur
                  </Label>
                  <Input
                    id="exportDriverName"
                    value={formData.export?.driverName || ""}
                    onChange={(e) => handleChange("export", "driverName", e.target.value)}
                    placeholder="Ex: Jean Dupont"
                    className="border-2 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exportVehicleId" className="flex items-center gap-2 font-semibold">
                    🚛 ID du véhicule
                  </Label>
                  <Input
                    id="exportVehicleId"
                    value={formData.export?.vehicleId || ""}
                    onChange={(e) => handleChange("export", "vehicleId", e.target.value)}
                    placeholder="Ex: VH-2024-001"
                    className="border-2 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="destination" className="flex items-center gap-2 font-semibold">
                    🌍 Destination
                  </Label>
                  <Input
                    id="destination"
                    value={formData.export?.destination || ""}
                    onChange={(e) => handleChange("export", "destination", e.target.value)}
                    placeholder="Ex: Port de Marseille, France"
                    className="border-2 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 7:
        return (
          <Card className="border-l-4 border-l-pink-500">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50">
              <CardTitle className="flex items-center gap-3 text-pink-800">
                <span className="text-2xl">📍</span>
                <div>
                  <div>Livraison</div>
                  <div className="text-sm font-normal text-pink-600">Livraison finale au client</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="estimatedDeliveryDate" className="flex items-center gap-2 font-semibold">
                    📅 Date de livraison estimée <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="estimatedDeliveryDate"
                    type="datetime-local"
                    value={formData.delivery?.estimatedDeliveryDate || ""}
                    onChange={(e) => handleChange("delivery", "estimatedDeliveryDate", e.target.value)}
                    className="border-2 focus:border-pink-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actualDeliveryDate" className="flex items-center gap-2 font-semibold">
                    ✅ Date de livraison réelle
                  </Label>
                  <Input
                    id="actualDeliveryDate"
                    type="datetime-local"
                    value={formData.delivery?.actualDeliveryDate || ""}
                    onChange={(e) => handleChange("delivery", "actualDeliveryDate", e.target.value)}
                    className="border-2 focus:border-pink-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientName" className="flex items-center gap-2 font-semibold">
                    🏢 Nom du client <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="clientName"
                    value={formData.delivery?.clientName || ""}
                    onChange={(e) => handleChange("delivery", "clientName", e.target.value)}
                    placeholder="Ex: SuperMarché Bio SA"
                    className="border-2 focus:border-pink-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientLocation" className="flex items-center gap-2 font-semibold">
                    📍 Lieu de livraison
                  </Label>
                  <Input
                    id="clientLocation"
                    value={formData.delivery?.clientLocation || ""}
                    onChange={(e) => handleChange("delivery", "clientLocation", e.target.value)}
                    placeholder="Ex: Paris, France"
                    className="border-2 focus:border-pink-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="deliveryNotes" className="flex items-center gap-2 font-semibold">
                    📝 Notes de livraison
                  </Label>
                  <Textarea
                    id="deliveryNotes"
                    value={formData.delivery?.notes || ""}
                    onChange={(e) => handleChange("delivery", "notes", e.target.value)}
                    className="border-2 focus:border-pink-500 transition-colors"
                    placeholder="Instructions spéciales, observations..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            🥑 <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Nouveau Suivi d'Avocats
            </span>
          </h1>
          <p className="text-gray-600 text-lg">Suivez le parcours de vos avocats de la ferme à la livraison</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Progression du suivi</h3>
            <span className="text-sm font-medium text-gray-600">
              {getStepCompletionPercentage()}% complété
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / 7) * 100}%` }}
            ></div>
          </div>

          {/* Step Navigator */}
          <div className="grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <button
                key={step}
                onClick={() => goToStep(step)}
                className={`p-3 rounded-lg text-center transition-all duration-200 ${currentStep === step
                  ? 'bg-blue-500 text-white shadow-lg scale-105'
                  : formData.completedSteps?.includes(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
              >
                <div className="text-lg mb-1">{stepIcons[step]}</div>
                <div className="text-xs font-medium">{stepTitles[step]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-600">{error}</AlertDescription>
          </Alert>
        )}

        {/* Auto-save Status */}
        {(isSavingDraft || lastSaved) && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Clock className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              {isSavingDraft ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sauvegarde en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Dernière sauvegarde: {lastSaved ? new Date(lastSaved).toLocaleTimeString() : 'Jamais'}</span>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {renderStep()}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-8 border-t">
            <Button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('newEntry.previous')}
            </Button>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => saveDraft()}
                disabled={isSavingDraft}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isSavingDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('newEntry.saveDraft')}
              </Button>

              {currentStep < 7 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!validateCurrentStep()}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
                >
                  {t('newEntry.next')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting || !validateCurrentStep()}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {isSubmitting ? t('newEntry.saving') : t('newEntry.finalize')}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Validation Alert */}
        {!validateCurrentStep() && (
          <Alert className="mt-4 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('newEntry.validationMessage')}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}