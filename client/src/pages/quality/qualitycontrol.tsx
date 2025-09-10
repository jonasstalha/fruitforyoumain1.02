import React, { useState, useEffect } from 'react';
import { Save, FileText, AlertTriangle, Check, X, Plus, Trash2, Copy, SplitSquareHorizontal, Upload, Cloud, CloudOff } from 'lucide-react';
import { jsPDF } from "jspdf"; // Import jsPDF for PDF generation
// Extend PaletteData to support dynamic keys for columns
import logo from '../../../assets/icon.png';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { 
  saveQualityControlLot, 
  uploadQualityControlImage, 
  getQualityControlLots,
  QualityControlLot as FirebaseLot,
  QualityControlFormData 
} from '../../lib/qualityControlService';
import { useSharedLots } from '../../hooks/useSharedLots';
import { SharedLot } from '../../lib/sharedLotService';
import { useMultiLots } from '../../hooks/useMultiLots';
import { firestore, storage } from '../../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { ref, deleteObject, listAll } from 'firebase/storage';

interface PaletteData {
  [key: string]: string | undefined;
  firmness: string;
  rotting: string;
  foreignMatter: string;
  withered: string;
  hardenedEndoderm: string;
  parasitePresence: string;
  parasiteAttack: string;
  temperature: string;
  odorOrTaste: string;
  packageWeight: string;
  shapeDefect: string;
  colorDefect: string;
  epidermisDefect: string;
  homogeneity: string;
  missingBrokenGrains: string;
  size: string;
  packageCount: string;
  packagingState: string;
  labelingPresence: string;
  corners: string;
  horizontalStraps: string;
  paletteSheet: string;
  woodenPaletteState: string;
  grossWeight: string;
  netWeight: string;
  internalLotNumber: string;
  paletteConformity: string;
  requiredNetWeight: string;
}

interface FormData {
  date: string;
  product: string;
  variety: string;
  campaign: string;
  clientLot: string;
  shipmentNumber: string;
  packagingType: string;
  category: string;
  exporterNumber: string;
  frequency: string;
  palettes: PaletteData[];
  tolerance?: {
    minCharacteristic?: string;
    category1Defects?: string;
    category2Defects?: string;
    category3Defects?: string;
    category4Defects?: string;
    minCharacteristicConform?: boolean;
    category1DefectsConform?: boolean;
    category2DefectsConform?: boolean;
    category3DefectsConform?: boolean;
  };
}

interface QualityControlLot {
  id: string;
  lotNumber: string;
  formData: FormData;
  images: File[];
  imageUrls?: string[]; // Firebase Storage URLs
  status: 'draft' | 'completed' | 'submitted' | 'chief_approved' | 'chief_rejected';
  phase: 'controller' | 'chief';
  createdAt: string;
  updatedAt: string;
  controller?: string;
  chief?: string;
  chiefComments?: string;
  chiefApprovalDate?: string;
  syncedToFirebase?: boolean;
  // Multi-lot synchronization fields
  sourceMultiLotId?: string;
  sourceMultiLotNumber?: string;
}

const emptyPaletteData = (): PaletteData => ({
  firmness: '0',
  rotting: '0',
  foreignMatter: '0',
  withered: 'C',
  hardenedEndoderm: '0',
  parasitePresence: '0',
  parasiteAttack: '0',
  temperature: 'C',
  odorOrTaste: 'C',
  packageWeight: '0',
  shapeDefect: '0',
  colorDefect: '0',
  epidermisDefect: '0',
  homogeneity: 'C',
  missingBrokenGrains: '0',
  size: '0',
  packageCount: '',
  packagingState: 'C',
  labelingPresence: 'C',
  corners: 'C',
  horizontalStraps: 'C',
  paletteSheet: 'C',
  woodenPaletteState: 'C',
  grossWeight: '',
  netWeight: '',
  internalLotNumber: '',
  paletteConformity: 'C',
  requiredNetWeight: ''
});

const initializeFormData = (): FormData => ({
  date: new Date().toISOString().split('T')[0],
  product: '',
  variety: '',
  campaign: '2024-2025',
  clientLot: '',
  shipmentNumber: '',
  packagingType: '',
  category: 'I',
  exporterNumber: '106040',
  frequency: '1 Carton/palette',
  palettes: Array(5).fill(null).map(() => emptyPaletteData())
});

export default function QualityControl() {
  const { lots: multiLots } = useMultiLots();
  const [lots, setLots] = useState<QualityControlLot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize with first lot
  useEffect(() => {
    if (lots.length === 0) {
      const initialLot: QualityControlLot = {
        id: Date.now().toString(),
        lotNumber: `LOT-${Date.now().toString().slice(-3)}`,
        formData: initializeFormData(),
        images: [],
        status: 'draft',
        phase: 'controller',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setLots([initialLot]);
    }
  }, []);

  // Multi-lot synchronization effect
  useEffect(() => {
    if (!multiLots || multiLots.length === 0) return;
    
    const createQualityLotFromMultiLot = async (multiLot: any) => {
      const qualityLot: QualityControlLot = {
        id: `quality-${multiLot.id}`,
        lotNumber: `QL-${multiLot.lotNumber}`,
        formData: {
          ...initializeFormData(),
          product: multiLot.product || '',
          variety: multiLot.variety || '',
          clientLot: multiLot.lotNumber || '',
          date: multiLot.creationDate?.split('T')[0] || new Date().toISOString().split('T')[0]
        },
        images: [],
        status: 'draft',
        phase: 'controller',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceMultiLotId: multiLot.id,
        sourceMultiLotNumber: multiLot.lotNumber
      };
      return qualityLot;
    };

    const syncNewMultiLots = async () => {
      if (isSyncing) return;
      setIsSyncing(true);

      try {
        const existingQualityLotNumbers = lots.map(lot => 
          lot.sourceMultiLotNumber || lot.lotNumber
        );

        const newMultiLots = multiLots.filter(multiLot => 
          !existingQualityLotNumbers.includes(multiLot.lotNumber)
        );

        if (newMultiLots.length > 0) {
          const syncPromises = newMultiLots.map(async (multiLot) => {
            const qualityLot = await createQualityLotFromMultiLot(multiLot);
            return qualityLot;
          });

          const newQualityLots = await Promise.all(syncPromises);
          setLots(prev => [...prev, ...newQualityLots]);
          console.log(`Synchronized ${newQualityLots.length} new lots from multi-lots`);
        }
      } catch (error) {
        console.error('Error syncing multi-lots:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncNewMultiLots();
  }, [multiLots, lots, isSyncing]);

  // Helper function implementations
  const updateLotFormData = (lotId: string, field: string, value: any) => {
    setLots(prevLots => 
      prevLots.map(lot => 
        lot.id === lotId 
          ? { ...lot, formData: { ...lot.formData, [field]: value } }
          : lot
      )
    );
  };

  const handleLotInputChange = (lotId: string, field: string, value: string) => {
    updateLotFormData(lotId, field, value);
  };

  const handleLotPaletteChange = (lotId: string, paletteIndex: number, field: string, value: string) => {
    setLots(prevLots => 
      prevLots.map(lot => {
        if (lot.id === lotId) {
          const updatedPalettes = [...lot.formData.palettes];
          if (!updatedPalettes[paletteIndex]) {
            updatedPalettes[paletteIndex] = emptyPaletteData();
          }
          updatedPalettes[paletteIndex] = {
            ...updatedPalettes[paletteIndex],
            [field]: value
          };
          return {
            ...lot,
            formData: { ...lot.formData, palettes: updatedPalettes }
          };
        }
        return lot;
      })
    );
  };

  const calculateLotAverages = (lot: QualityControlLot, field: keyof PaletteData): string => {
    const palettes = lot.formData.palettes || [];
    const values = palettes
      .map(p => parseFloat(p[field] as string || '0'))
      .filter(v => !isNaN(v) && v > 0);
    
    if (values.length === 0) return '0';
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    return average.toFixed(1);
  };

  const generateLotPDF = async (lot: QualityControlLot) => {
    console.log('Generating PDF for lot:', lot.lotNumber);
    // Implementation will use existing PDF generation logic
  };

  const saveToFirestore = async (lot: QualityControlLot) => {
    // Implement Firestore save logic
    console.log('Saving to Firestore:', lot);
  };

  const saveLot = async (lotId: string) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    
    try {
      await saveToFirestore(lot);
      console.log('Lot saved:', lot.lotNumber);
    } catch (error) {
      console.error('Error saving lot:', error);
    }
  };

  const duplicateLot = (lotId: string) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    
    const newLot: QualityControlLot = {
      ...lot,
      id: Date.now().toString(),
      lotNumber: `${lot.lotNumber}-COPY`,
      status: 'draft'
    };
    
    setLots(prev => [...prev, newLot]);
  };

  const deleteLot = (lotId: string) => {
    if (lots.length <= 1) return; // Keep at least one lot
    setLots(prev => prev.filter(l => l.id !== lotId));
  };

  const createNewLot = () => {
    const newLot: QualityControlLot = {
      id: Date.now().toString(),
      lotNumber: `LOT-${Date.now().toString().slice(-3)}`,
      formData: initializeFormData(),
      images: [],
      status: 'draft',
      phase: 'controller',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setLots(prev => [...prev, newLot]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Contrôle Qualité</h1>
              <p className="text-gray-600 mt-2">
                Gestion des lots de contrôle qualité avec synchronisation multi-lots
              </p>
            </div>
            
            {/* Sync status */}
            {isSyncing && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-800">
                <Cloud className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-medium">Synchronisation en cours...</span>
              </div>
            )}
          </div>
        </div>

        {/* Lots Container */}
        <div className="space-y-6">
          {/* Empty State */}
          {lots.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun lot disponible</h3>
              <p className="text-gray-600 mb-6">Créez votre premier lot de contrôle qualité.</p>
              <button
                onClick={createNewLot}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Créer un lot
              </button>
            </div>
          ) : (
            lots.map((lot) => (
              <div key={lot.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                {/* Lot Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-900">{lot.lotNumber}</h2>
                    
                    {/* Sync indicator */}
                    {lot.sourceMultiLotId && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-100 border border-green-300 rounded-lg text-green-800">
                        <SplitSquareHorizontal className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          Depuis: {lot.sourceMultiLotNumber}
                        </span>
                      </div>
                    )}
                    
                    {/* Status indicator */}
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      lot.status === 'completed' ? 'bg-green-100 text-green-800' :
                      lot.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lot.status === 'completed' && <Check className="w-4 h-4 mr-1" />}
                      {lot.status === 'submitted' && <Check className="w-4 h-4 mr-1" />}
                      {lot.status === 'draft' && <AlertTriangle className="w-4 h-4 mr-1" />}
                      {lot.status.charAt(0).toUpperCase() + lot.status.slice(1)}
                    </span>
                  </div>
                  
                  {/* Lot Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => generateLotPDF(lot)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-1"
                      title="Générer PDF pour ce lot"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => saveLot(lot.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
                      title="Sauvegarder ce lot"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => duplicateLot(lot.id)}
                      className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm flex items-center gap-1"
                      title="Dupliquer ce lot"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteLot(lot.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm flex items-center gap-1"
                      title="Supprimer ce lot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Basic Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-blue-600" />
                    Informations de base
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={lot.formData.date}
                        onChange={(e) => handleLotInputChange(lot.id, 'date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
                      <input
                        type="text"
                        value={lot.formData.product}
                        onChange={(e) => handleLotInputChange(lot.id, 'product', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: Avocat"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Variété</label>
                      <input
                        type="text"
                        value={lot.formData.variety}
                        onChange={(e) => handleLotInputChange(lot.id, 'variety', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: Hass"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Campagne</label>
                      <input
                        type="text"
                        value={lot.formData.campaign}
                        onChange={(e) => handleLotInputChange(lot.id, 'campaign', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lot Client</label>
                      <input
                        type="text"
                        value={lot.formData.clientLot}
                        onChange={(e) => handleLotInputChange(lot.id, 'clientLot', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type d'emballage</label>
                      <select
                        value={lot.formData.packagingType}
                        onChange={(e) => handleLotInputChange(lot.id, 'packagingType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Sélectionner</option>
                        <option value="Carton">Carton</option>
                        <option value="Plateau">Plateau</option>
                        <option value="Sac">Sac</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quality Control Data */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    Contrôle Qualité
                  </h3>
                  
                  {/* Simple quality metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fermeté (kgf)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={lot.formData.palettes[0]?.firmness || ''}
                        onChange={(e) => handleLotPaletteChange(lot.id, 0, 'firmness', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pourriture (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={lot.formData.palettes[0]?.rotting || ''}
                        onChange={(e) => handleLotPaletteChange(lot.id, 0, 'rotting', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Poids (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={lot.formData.palettes[0]?.packageWeight || ''}
                        onChange={(e) => handleLotPaletteChange(lot.id, 0, 'packageWeight', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Conformité</label>
                      <select
                        value={lot.formData.palettes[0]?.paletteConformity || 'C'}
                        onChange={(e) => handleLotPaletteChange(lot.id, 0, 'paletteConformity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="C">Conforme</option>
                        <option value="NC">Non Conforme</option>
                      </select>
                    </div>
                  </div>

                  {/* Results summary */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Résumé Qualité</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Fermeté:</span>
                        <span className="ml-2 font-medium">{calculateLotAverages(lot, 'firmness')} kgf</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Pourriture:</span>
                        <span className="ml-2 font-medium">{calculateLotAverages(lot, 'rotting')}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Poids:</span>
                        <span className="ml-2 font-medium">{calculateLotAverages(lot, 'packageWeight')} kg</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className={`ml-2 font-medium ${
                          lot.formData.palettes[0]?.paletteConformity === 'C' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {lot.formData.palettes[0]?.paletteConformity === 'C' ? 'Conforme' : 'Non Conforme'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Add New Lot Button */}
          {lots.length > 0 && (
            <div className="text-center">
              <button
                onClick={createNewLot}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Ajouter un nouveau lot
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
