import React, { useMemo, useState } from 'react';
import { FilePlus, Package, Plus, RefreshCw, Save, Trash2, Copy } from 'lucide-react';

// Data model for avocado quality control
interface QualityControlData {
  header: {
    ref: string;
    version: string;
    date: string;
    deliveryDate: string;
    productRange: string;
    provider: string;
    protocol: string;
    conventionnel: boolean;
    bio: boolean;
    deliveryBonNumber: string;
    receptionBonNumber: string;
    receptionTime: string;
    boxState: string;
    matricule: string;
    variety: string;
    producer: string;
    truckQuality: string;
    totalPallets: string;
    netWeight: string;
    productLotNumber: string;
  };
  qualityChecks: {
    diseaseTraces: { count: string; weight: string; percentage: string };
    ripeFruit: { count: string; weight: string; percentage: string };
    dirtyFruit: { count: string; weight: string; percentage: string };
    sunBurns: { count: string; weight: string; percentage: string };
    withoutStem: { count: string; weight: string; percentage: string };
  };
  totalDefects: string;
  color: string;
  odor: string;
  decision: string;
  responsibleSignature: string;
}

interface QualityControlLot {
  id: string;
  lotNumber: string;
  status: 'brouillon' | 'en_cours' | 'termine';
  data: QualityControlData;
  createdAt: Date;
  updatedAt: Date;
}

const defaultQualityControlData = (): QualityControlData => ({
  header: {
    ref: 'SMQ.ENR.10',
    version: '01',
    date: '1/07/2023',
    deliveryDate: new Date().toLocaleDateString('fr-FR'),
    productRange: 'Avocat',
    provider: '',
    protocol: '1 Caisse (23KG) / 12palette',
    conventionnel: true,
    bio: false,
    deliveryBonNumber: '',
    receptionBonNumber: '',
    receptionTime: '',
    boxState: '',
    matricule: '',
    variety: '',
    producer: '',
    truckQuality: '',
    totalPallets: '',
    netWeight: '',
    productLotNumber: '',
  },
  qualityChecks: {
    diseaseTraces: { count: '', weight: '', percentage: '' },
    ripeFruit: { count: '', weight: '', percentage: '' },
    dirtyFruit: { count: '', weight: '', percentage: '' },
    sunBurns: { count: '', weight: '', percentage: '' },
    withoutStem: { count: '', weight: '', percentage: '' },
  },
  totalDefects: '',
  color: '',
  odor: '',
  decision: '',
  responsibleSignature: '',
});

const ControleReception: React.FC = () => {
  const [lots, setLots] = useState<QualityControlLot[]>([
    {
      id: '1',
      lotNumber: 'Réception 1',
      status: 'brouillon',
      data: defaultQualityControlData(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);
  const [currentLotId, setCurrentLotId] = useState<string>('1');
  const [archives, setArchives] = useState<QualityControlLot[]>([]);

  const currentLot = useMemo(() => lots.find(l => l.id === currentLotId), [lots, currentLotId]);

  const createNewLot = () => {
    const newLot: QualityControlLot = {
      id: Date.now().toString(),
      lotNumber: `Réception ${lots.length + 1}`,
      status: 'brouillon',
      data: defaultQualityControlData(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setLots([...lots, newLot]);
    setCurrentLotId(newLot.id);
  };

  const duplicateLot = (lotId: string) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    
    const newLot: QualityControlLot = {
      id: Date.now().toString(),
      lotNumber: `${lot.lotNumber} (Copie)`,
      status: lot.status,
      data: { ...lot.data },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setLots([...lots, newLot]);
    setCurrentLotId(newLot.id);
  };

  const removeLot = (lotId: string) => {
    if (lots.length <= 1) {
      alert('Vous ne pouvez pas supprimer le dernier lot');
      return;
    }
    if (confirm('Supprimer ce lot ?')) {
      const newLots = lots.filter(l => l.id !== lotId);
      setLots(newLots);
      if (currentLotId === lotId) {
        setCurrentLotId(newLots[0].id);
      }
    }
  };

  const updateCurrentLot = (updates: Partial<QualityControlData>) => {
    if (!currentLot) return;
    
    const updatedLot = {
      ...currentLot,
      data: {
        ...currentLot.data,
        ...updates,
        header: { ...currentLot.data.header, ...(updates.header || {}) },
        qualityChecks: { ...currentLot.data.qualityChecks, ...(updates.qualityChecks || {}) },
      },
      updatedAt: new Date(),
    };
    
    setLots(lots.map(l => l.id === currentLotId ? updatedLot : l));
  };

  const resetForm = () => {
    updateCurrentLot(defaultQualityControlData());
  };

  const saveToArchive = () => {
    if (!currentLot) return;
    
    const archiveLot = {
      ...currentLot,
      id: `archive_${Date.now()}`,
      lotNumber: `Archive - ${currentLot.lotNumber}`,
    };
    
    setArchives([...archives, archiveLot]);
    alert('Fiche archivée avec succès');
  };

  const loadFromArchive = (archive: QualityControlLot) => {
    if (!currentLot) return;
    updateCurrentLot(archive.data);
    alert("Archive chargée dans l'éditeur");
  };

  const deleteArchive = (archiveId: string) => {
    if (!confirm('Supprimer cette archive ?')) return;
    setArchives(archives.filter(a => a.id !== archiveId));
  };

  const generatePDF = async () => {
    if (!currentLot) return;

    const jsPDFClass = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default as any;
    const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;

    const colors = {
      headerGreen: [101, 174, 73] as const,
      lightGreen: [226, 243, 224] as const,
      border: [0, 0, 0] as const,
      text: [0, 0, 0] as const,
    };

    const centerX = margin + contentWidth / 2;

    // Header band
    doc.setFillColor(...colors.headerGreen);
    doc.rect(margin, margin, contentWidth, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('FICHE D\'AGRÉAGE À LA RÉCEPTION', centerX, margin + 11, { align: 'center' });

    // Meta table (Ref, Version, Date)
    autoTable(doc, {
      startY: margin + 18,
      styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 9, cellPadding: 2, lineColor: colors.border, textColor: colors.text },
      headStyles: { fillColor: colors.lightGreen as any, textColor: colors.text, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: contentWidth / 3 }, 1: { cellWidth: contentWidth / 3 }, 2: { cellWidth: contentWidth / 3 } },
      margin: { left: margin, right: margin },
      head: [[
        `Réf : ${currentLot.data.header.ref}`,
        `Version : ${currentLot.data.header.version}`,
        `Date doc : ${currentLot.data.header.date}`
      ]],
      body: [[`Date réception : ${currentLot.data.header.deliveryDate}`, '', '']],
      theme: 'grid',
    });

    // Product info block
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      styles: { fontSize: 9, cellPadding: 2, lineColor: colors.border, textColor: colors.text },
      headStyles: { fillColor: colors.lightGreen as any, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
      head: [[{ content: 'Informations produit', colSpan: 3, styles: { halign: 'center' } }]],
      body: [
        [{ content: `Gamme de produit : ${currentLot.data.header.productRange}`, colSpan: 3 }],
        [{ content: `Prestataire : ${currentLot.data.header.provider}`, colSpan: 3 }],
        [{ content: `Protocole : ${currentLot.data.header.protocol}`, colSpan: 3 }],
        [
          { content: `${currentLot.data.header.conventionnel ? '☑' : '☐'} CONVENTIONNEL`, styles: { cellWidth: contentWidth / 3 } },
          { content: `${currentLot.data.header.bio ? '☑' : '☐'} BIO`, styles: { cellWidth: contentWidth / 3 } },
          { content: '', styles: { cellWidth: contentWidth / 3 } }
        ],
      ],
      theme: 'grid',
    });

    // Reception details (2 columns grid)
    const rec = currentLot.data.header;
    const detailsRows = [
      [`N° Bon de livraison : ${rec.deliveryBonNumber}`, `N° Bon de réception : ${rec.receptionBonNumber}`],
      [`Heure de réception : ${rec.receptionTime}`, `État des caisses : ${rec.boxState}`],
      [`Matricule : ${rec.matricule}`, `Variété : ${rec.variety}`],
      [`Producteur : ${rec.producer}`, `Qualité camion : ${rec.truckQuality}`],
      [`Total palettes : ${rec.totalPallets}`, `Poids NET : ${rec.netWeight}`],
      [`N° lot produit : ${rec.productLotNumber}`, ''],
    ];
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      styles: { fontSize: 9, cellPadding: 2, lineColor: colors.border },
      headStyles: { fillColor: colors.lightGreen as any, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
      head: [[{ content: 'Détails de la réception', colSpan: 2, styles: { halign: 'center' } }]],
      body: detailsRows,
      theme: 'grid',
      columnStyles: { 0: { cellWidth: contentWidth / 2 }, 1: { cellWidth: contentWidth / 2 } },
    });

    // Quality checks table
    const qc = currentLot.data.qualityChecks;
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      styles: { fontSize: 9, cellPadding: 2, lineColor: colors.border },
      headStyles: { fillColor: colors.lightGreen as any, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
      head: [[
        'Type de défaut', 'Nbr de fruits', 'Poids', '%', 'Max autorisé'
      ]],
      body: [
        ['Fruit avec trace de maladie', qc.diseaseTraces.count, qc.diseaseTraces.weight, qc.diseaseTraces.percentage, 'max 10u'],
        ['Fruit murs', qc.ripeFruit.count, qc.ripeFruit.weight, qc.ripeFruit.percentage, 'max 0u'],
        ['Fruit Terreux', qc.dirtyFruit.count, qc.dirtyFruit.weight, qc.dirtyFruit.percentage, 'max 8u'],
        ['Épiderme et brûlures de soleil', qc.sunBurns.count, qc.sunBurns.weight, qc.sunBurns.percentage, 'max 6cm²'],
        ['Fruit Sans pédoncule', qc.withoutStem.count, qc.withoutStem.weight, qc.withoutStem.percentage, ''],
      ],
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: contentWidth - (70 + 26 + 26 + 16) },
      },
    });

    // Totals and qualitative checks
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      styles: { fontSize: 9, cellPadding: 2, lineColor: colors.border },
      headStyles: { fillColor: colors.lightGreen as any, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
      body: [
        [{ content: `Totalité des défauts % : ${currentLot.data.totalDefects}`, colSpan: 2 }],
        [{ content: `Couleur : ${currentLot.data.color}`, colSpan: 1 }, { content: `Odeur : ${currentLot.data.odor}`, colSpan: 1 }],
      ],
      theme: 'grid',
      columnStyles: { 0: { cellWidth: contentWidth / 2 }, 1: { cellWidth: contentWidth / 2 } },
    });

    // Decision and signature
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 3,
      styles: { fontSize: 9, cellPadding: 2, lineColor: colors.border },
      margin: { left: margin, right: margin },
      body: [
        [{ content: `Décision + Action : ${currentLot.data.decision}`, colSpan: 2, styles: { minCellHeight: 16 } }],
        [{ content: `Visa responsable de réception : ${currentLot.data.responsibleSignature}`, colSpan: 2, styles: { minCellHeight: 10 } }],
      ],
      theme: 'grid',
      columnStyles: { 0: { cellWidth: contentWidth / 2 }, 1: { cellWidth: contentWidth / 2 } },
    });

    // Footer with form ref/version
    const footerY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Formulaire: ${currentLot.data.header.ref}  |  Version: ${currentLot.data.header.version}`, margin, footerY);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin + contentWidth, footerY, { align: 'right' });

    const fileName = `Fiche_Controle_Reception_${currentLot.lotNumber.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
  };
  
  if (!currentLot) return <div>Chargement...</div>;
  
  return (
    <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-xl">
        {/* Header Controls */}
        <div className="bg-white border-b p-4 shadow-sm rounded-t-xl sticky top-0 z-10">
          <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Fiche de Contrôle à la Réception - Avocat</h1>
              <p className="text-sm text-gray-500">Créez, éditez et archivez vos contrôles de réception.</p>
            </div>
            <button onClick={createNewLot} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={20} /> Nouveau Lot
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
            {lots.map((lot) => (
              <div key={lot.id} className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => setCurrentLotId(lot.id)}
                  className={`px-4 py-2 flex items-center gap-2 transition-all ${
                    currentLotId === lot.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package size={16} />
                  {lot.lotNumber}
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    lot.status === 'termine' ? 'bg-green-200 text-green-800' :
                    lot.status === 'en_cours' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {lot.status}
                  </span>
                </button>
                <div className="flex">
                  <button onClick={() => duplicateLot(lot.id)} className="p-2 text-gray-600 hover:text-blue-600" title="Dupliquer">
                    <Copy size={16} />
                  </button>
                  {lots.length > 1 && (
                    <button onClick={() => removeLot(lot.id)} className="p-2 text-gray-600 hover:text-red-600" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Header Section */}
          <div className="bg-green-600 text-white p-4 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold text-center">SYSTÈME DE GESTION DE LA QUALITÉ</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <label className="block font-semibold mb-1">Réf :</label>
                <input
                  type="text"
                  value={currentLot.data.header.ref}
                  onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, ref: e.target.value } })}
                  placeholder="SMQ.ENR.10"
                  className="w-full p-2 rounded text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/70"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Version :</label>
                <input
                  type="text"
                  value={currentLot.data.header.version}
                  onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, version: e.target.value } })}
                  placeholder="01"
                  className="w-full p-2 rounded text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/70"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Date :</label>
                <input
                  type="text"
                  value={currentLot.data.header.date}
                  onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, date: e.target.value } })}
                  placeholder="1/07/2023"
                  className="w-full p-2 rounded text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/70"
                />
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="text-base font-semibold text-neutral-700 mb-4">Informations de base</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Date :</label>
              <input
                type="date"
                value={currentLot.data.header.deliveryDate}
                onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, deliveryDate: e.target.value } })}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Gamme de produit :</label>
              <input
                type="text"
                value={currentLot.data.header.productRange}
                onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, productRange: e.target.value } })}
                placeholder="Avocat"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Prestataire :</label>
              <input
                type="text"
                value={currentLot.data.header.provider}
                onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, provider: e.target.value } })}
                placeholder="Nom du prestataire"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Protocole :</label>
              <input
                type="text"
                value={currentLot.data.header.protocol}
                onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, protocol: e.target.value } })}
                placeholder="1 Caisse (23KG) / 12 palette"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            </div>
          </div>

          {/* Type */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="text-base font-semibold text-neutral-700 mb-3">Type</h3>
            <div className="flex gap-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentLot.data.header.conventionnel}
                onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, conventionnel: e.target.checked } })}
                className="mr-2"
              />
              CONVENTIONNEL
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentLot.data.header.bio}
                onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, bio: e.target.checked } })}
                className="mr-2"
              />
              BIO
            </label>
            </div>
          </div>

          {/* Reception Details */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="text-base font-semibold text-neutral-700 mb-4">Détails de la réception</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'deliveryBonNumber', label: 'N° de Bon de livraison' },
              { key: 'receptionBonNumber', label: 'N° de bon de réception' },
              { key: 'receptionTime', label: 'Heure de réception' },
              { key: 'boxState', label: 'États des caisses (C/NC)' },
              { key: 'matricule', label: 'Matricule' },
              { key: 'variety', label: 'Variété' },
              { key: 'producer', label: 'Producteur' },
              { key: 'truckQuality', label: 'Contrôle qualité états Camion' },
              { key: 'totalPallets', label: 'Nombre total de palettes' },
              { key: 'netWeight', label: 'Poids NET' },
              { key: 'productLotNumber', label: 'N° de lot du produit' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-sm font-semibold mb-2">{field.label} :</label>
                {field.key === 'receptionTime' ? (
                  <input
                    type="time"
                    value={(currentLot.data.header as any)[field.key]}
                    onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, [field.key]: e.target.value } as any })}
                    step={60}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={(currentLot.data.header as any)[field.key]}
                    onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, [field.key]: e.target.value } as any })}
                    placeholder={field.label}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                )}
              </div>
            ))}
            </div>
          </div>

          {/* Quality Checks */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="text-lg font-bold mb-4 bg-green-100 p-3 rounded">Contrôles Qualité</h3>
            <div className="space-y-4">
              {[
                { key: 'diseaseTraces', label: 'Fruit avec trace de maladie', max: 'max 10u' },
                { key: 'ripeFruit', label: 'Fruit murs', max: 'max 0u' },
                { key: 'dirtyFruit', label: 'Fruit Terreux', max: 'max 8u' },
                { key: 'sunBurns', label: 'Épiderme et brûlures de soleil', max: 'max 6cm²' },
                { key: 'withoutStem', label: 'Fruit Sans pédoncule', max: '' },
              ].map((check: any) => (
                <div key={check.key} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center bg-gray-50 p-3 rounded border">
                  <div className="font-medium">{check.label}</div>
                  <div>
                    <label className="block text-xs text-gray-600">Nbr de fruits</label>
                    <input
                      type="text"
                      value={(currentLot.data.qualityChecks as any)[check.key].count}
                      onChange={(e) => updateCurrentLot({
                        qualityChecks: {
                          ...currentLot.data.qualityChecks,
                          [check.key]: {
                            ...(currentLot.data.qualityChecks as any)[check.key],
                            count: e.target.value
                          }
                        }
                      })}
                      placeholder="0"
                      className="w-full p-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Poids</label>
                    <input
                      type="text"
                      value={(currentLot.data.qualityChecks as any)[check.key].weight}
                      onChange={(e) => updateCurrentLot({
                        qualityChecks: {
                          ...currentLot.data.qualityChecks,
                          [check.key]: {
                            ...(currentLot.data.qualityChecks as any)[check.key],
                            weight: e.target.value
                          }
                        }
                      })}
                      placeholder="kg"
                      className="w-full p-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">%</label>
                    <input
                      type="text"
                      value={(currentLot.data.qualityChecks as any)[check.key].percentage}
                      onChange={(e) => updateCurrentLot({
                        qualityChecks: {
                          ...currentLot.data.qualityChecks,
                          [check.key]: {
                            ...(currentLot.data.qualityChecks as any)[check.key],
                            percentage: e.target.value
                          }
                        }
                      })}
                      placeholder="0%"
                      className="w-full p-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div className="text-sm text-gray-600">{check.max}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Final Checks */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="text-base font-semibold text-neutral-700 mb-4">Vérifications finales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Totalité des défauts % :</label>
              <input
                type="text"
                value={currentLot.data.totalDefects}
                onChange={(e) => updateCurrentLot({ totalDefects: e.target.value })}
                placeholder="0%"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Couleur C/NC :</label>
              <input
                type="text"
                value={currentLot.data.color}
                onChange={(e) => updateCurrentLot({ color: e.target.value })}
                placeholder="C ou NC"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Odeur C / NC :</label>
              <input
                type="text"
                value={currentLot.data.odor}
                onChange={(e) => updateCurrentLot({ odor: e.target.value })}
                placeholder="C ou NC"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Visa responsable de réception :</label>
              <input
                type="text"
                value={currentLot.data.responsibleSignature}
                onChange={(e) => updateCurrentLot({ responsibleSignature: e.target.value })}
                placeholder="Nom et signature"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <label className="block text-sm font-semibold mb-2">Décision + Action :</label>
            <textarea
              value={currentLot.data.decision}
              onChange={(e) => updateCurrentLot({ decision: e.target.value })}
              placeholder="Décision prise et actions à mener..."
              className="w-full p-3 border rounded h-24 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-2">
            <button onClick={generatePDF} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
              <FilePlus size={20} /> Générer PDF
            </button>
            <button onClick={resetForm} className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors">
              <RefreshCw size={20} /> Réinitialiser
            </button>
            <button onClick={saveToArchive} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              <Save size={20} /> Archiver
            </button>
          </div>
        </div>
      </div>

      {/* Archives Section */}
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-xl mt-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Archives - Fiches de Contrôle Réception</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Les archives sont des copies figées de vos fiches de contrôle. Utilisez Archiver pour sauvegarder une fiche.</p>
        
        {archives.length === 0 ? (
          <div className="text-gray-500 text-center py-8">Aucune archive pour le moment.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archives.map((archive) => (
              <div key={archive.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{archive.lotNumber}</div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    archive.status === 'termine' ? 'bg-green-200 text-green-800' :
                    archive.status === 'en_cours' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {archive.status}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  <div>Prestataire: {archive.data.header.provider}</div>
                  <div>Variété: {archive.data.header.variety}</div>
                  <div>Date: {archive.data.header.deliveryDate}</div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => loadFromArchive(archive)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Charger
                  </button>
                  <button
                    onClick={() => deleteArchive(archive.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Supprimer
                  </button>
                </div>
                
                <div className="text-xs text-gray-400 mt-2">
                  Archivé le: {archive.updatedAt.toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ControleReception;
