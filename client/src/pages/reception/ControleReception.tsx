import React, { useMemo, useState } from 'react';
import logoUrl from '../../../assets/icon.png';
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
      lime300: [190, 242, 100] as const,
      lime200: [217, 249, 157] as const,
      border: [0, 0, 0] as const,
      text: [0, 0, 0] as const,
    };

    // Header frame like page
    const headerH = 26;
    const leftW = 22;
    const rightW = 40;
    const centerW = contentWidth - leftW - rightW;
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.6);
    // Outer
    doc.rect(margin, margin, contentWidth, headerH);
    // Separators
    doc.line(margin + leftW, margin, margin + leftW, margin + headerH);
    doc.line(margin + leftW + centerW, margin, margin + leftW + centerW, margin + headerH);
    // Center title band
    const centerX0 = margin + leftW;
    doc.setFillColor(...colors.lime300);
    const titleBandH = 10;
    doc.rect(centerX0, margin, centerW, titleBandH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('Fiche de contrôle à la réception (avocat)', centerX0 + centerW / 2, margin + 6.2, { align: 'center' });
    doc.text('SYSTEME DE GESTION DE LA QUALITE', centerX0 + centerW / 2, margin + titleBandH + 7.2, { align: 'center' });
    // Right info rows
    const rightX0 = margin + leftW + centerW;
    const rowH = headerH / 3;
    doc.line(rightX0, margin + rowH, rightX0 + rightW, margin + rowH);
    doc.line(rightX0, margin + rowH * 2, rightX0 + rightW, margin + rowH * 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Réf : ${currentLot.data.header.ref}`, rightX0 + 2, margin + rowH - 2);
    doc.text(`Version : ${currentLot.data.header.version}`, rightX0 + 2, margin + rowH * 2 - 2);
    doc.text(`Date : ${currentLot.data.header.date}`, rightX0 + 2, margin + rowH * 3 - 2);
    // Logo
    try {
      const img = new Image();
      img.src = logoUrl as unknown as string;
      await new Promise((res, rej) => { (img.onload = res as any), (img.onerror = rej as any); });
      const imgSize = 14;
      const imgX = margin + (leftW - imgSize) / 2;
      const imgY = margin + (headerH - imgSize) / 2;
      doc.addImage(img, 'PNG', imgX, imgY, imgSize, imgSize);
    } catch {}

    // Table body matching page
    const rec = currentLot.data.header;
    const qc = currentLot.data.qualityChecks;
    const checkbox = (b: boolean) => (b ? '☑' : '☐');

    autoTable(doc, {
      startY: margin + headerH + 2,
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.2, lineColor: colors.border, lineWidth: 0.6, textColor: colors.text },
      margin: { left: margin, right: margin },
      theme: 'grid',
      body: [
        [
          { content: 'Date', styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: rec.deliveryDate || '' },
          { content: 'Gamme de\nproduit :', styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: `${checkbox(rec.conventionnel)} Conventionnel\n${checkbox(rec.bio)} BIO` },
          { content: 'Prestataire :', styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: rec.provider || '' },
          { content: 'Protocole :\n1 Caisse (23KG) / 12palette', styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
        ],

        [ { content: 'N° de Bon de livraison', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.deliveryBonNumber || '', colSpan: 6 } ],
        [ { content: 'N° de bon de réception', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.receptionBonNumber || '', colSpan: 6 } ],
        [ { content: 'Heure de réception', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.receptionTime || '', colSpan: 6 } ],
        [ { content: 'Etats des caisses (C/NC)', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.boxState || '', colSpan: 6 } ],
        [ { content: 'Matricule', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.matricule || '', colSpan: 6 } ],
        [ { content: 'Variété', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.variety || '', colSpan: 6 } ],
        [ { content: 'Producteur', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.producer || '', colSpan: 6 } ],
        [ { content: 'Contrôle qualité de états Camion : Odeur ; corps étranger ; nettoyage. (C/NC)', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.truckQuality || '', colSpan: 6 } ],
        [ { content: 'Nombre total de palettes', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.totalPallets || '', colSpan: 6 } ],
        [ { content: 'Poids NET', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.netWeight || '', colSpan: 6 } ],
        [ { content: 'N° de lot du produit', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.productLotNumber || '', colSpan: 6 } ],

        [ { content: 'Nbr Fruit avec trace de maladie', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits\n(max 10u)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 3 } ],
        [ { content: qc.diseaseTraces.count || '' }, { content: qc.diseaseTraces.weight || '' }, { content: qc.diseaseTraces.percentage || '' }, { content: '', colSpan: 3 } ],

        [ { content: 'Nbr fruit murs', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits\n(max 0u)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 3 } ],
        [ { content: qc.ripeFruit.count || '' }, { content: qc.ripeFruit.weight || '' }, { content: qc.ripeFruit.percentage || '' }, { content: '', colSpan: 3 } ],

        [ { content: 'Nbr fruit Terreux', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits\n(max 8u)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 3 } ],
        [ { content: qc.dirtyFruit.count || '' }, { content: qc.dirtyFruit.weight || '' }, { content: qc.dirtyFruit.percentage || '' }, { content: '', colSpan: 3 } ],

        [ { content: 'Epiderme et brulures de soleil', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits\n(max 6cm²)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 3 } ],
        [ { content: qc.sunBurns.count || '' }, { content: qc.sunBurns.weight || '' }, { content: qc.sunBurns.percentage || '' }, { content: '', colSpan: 3 } ],

        [ { content: 'Nbr fruit\nSans pédoncule', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 3 } ],
        [ { content: qc.withoutStem.count || '' }, { content: qc.withoutStem.weight || '' }, { content: qc.withoutStem.percentage || '' }, { content: '', colSpan: 3 } ],

        [ { content: 'Totalité des défauts %', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.totalDefects || '', colSpan: 6 } ],
        [ { content: 'Couleur C/NC', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.color || '', colSpan: 6 } ],
        [ { content: 'Odeur C / NC', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.odor || '', colSpan: 6 } ],
        [ { content: 'Décision + Action', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.decision || '', colSpan: 6 } ],
      ],
      columnStyles: { 0: { cellWidth: 45 } },
    });

    // Notes and visa
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 1,
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.2, lineColor: colors.border, lineWidth: 0.6 },
      margin: { left: margin, right: margin },
      theme: 'grid',
      body: [
        [ { content: 'Note : en cas de présence', styles: { fontStyle: 'bold' } } ],
        [ { content: "• En cas d'un taux élevé (10%) des écarts il faut identifier le lot par une F.P et informer le R.Q" } ],
        [ { content: `Visa responsable de réception: ${currentLot.data.responsibleSignature || ''}`, styles: { halign: 'center', fontStyle: 'bold' } } ],
      ],
    });

    // Footer
    const footerY = (doc as any).lastAutoTable.finalY + 6;
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

        {/* Form-like Printed Layout */}
        <div className="p-6">
          <div className="max-w-5xl mx-auto bg-white shadow-lg">
            {/* Header */}
            <div className="border-2 border-black">
              <div className="flex">
                {/* Logo */}
                <div className="w-20 h-16 border-r border-black flex items-center justify-center bg-white">
                  <img src={logoUrl} alt="Logo" className="max-h-12 max-w-16 object-contain" />
                </div>

                {/* Title */}
                <div className="flex-1 border-r border-black">
                  <div className="bg-lime-300 text-center py-1 border-b border-black font-bold text-sm">
                    Fiche de contrôle à la réception (avocat)
                  </div>
                  <div className="text-center py-2 font-bold text-sm">
                    SYSTEME DE GESTION DE LA QUALITE
                  </div>
                </div>

                {/* Info */}
                <div className="w-40">
                  <div className="border-b border-black p-1 text-xs">
                    <label className="block font-semibold mb-0.5">Réf :</label>
                    <input
                      type="text"
                      value={currentLot.data.header.ref}
                      onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, ref: e.target.value } })}
                      className="w-full text-xs border border-black rounded px-1 py-0.5"
                    />
                  </div>
                  <div className="border-b border-black p-1 text-xs">
                    <label className="block font-semibold mb-0.5">Version :</label>
                    <input
                      type="text"
                      value={currentLot.data.header.version}
                      onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, version: e.target.value } })}
                      className="w-full text-xs border border-black rounded px-1 py-0.5"
                    />
                  </div>
                  <div className="p-1 text-xs">
                    <label className="block font-semibold mb-0.5">Date :</label>
                    <input
                      type="text"
                      value={currentLot.data.header.date}
                      onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, date: e.target.value } })}
                      className="w-full text-xs border border-black rounded px-1 py-0.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="border-x-2 border-b-2 border-black">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {/* Date Row */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 w-32 font-bold">Date</td>
                    <td className="border border-black p-1 w-24">
                      <input
                        type="date"
                        value={currentLot.data.header.deliveryDate}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, deliveryDate: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="bg-lime-300 border border-black p-1 font-bold">
                      Gamme de
                      <br />
                      produit :
                    </td>
                    <td className="border border-black p-1">
                      <div className="mb-1">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={currentLot.data.header.conventionnel}
                            onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, conventionnel: e.target.checked } })}
                            className="text-xs"
                          />
                          <span>Conventionnel</span>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={currentLot.data.header.bio}
                            onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, bio: e.target.checked } })}
                            className="text-xs"
                          />
                          <span>BIO</span>
                        </label>
                      </div>
                    </td>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Prestataire :</td>
                    <td className="border border-black p-1 w-48">
                      <input
                        type="text"
                        value={currentLot.data.header.provider}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, provider: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="bg-lime-300 border border-black p-1 font-bold">
                      Protocole :
                      <br />
                      1 Caisse (23KG) / 12palette
                    </td>
                  </tr>

                  {/* N° de Bon de livraison */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">N° de Bon de livraison</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.deliveryBonNumber}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, deliveryBonNumber: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* N° de bon de réception */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">N° de bon de réception</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.receptionBonNumber}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, receptionBonNumber: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Heure de réception */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Heure de réception</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="time"
                        step={60}
                        value={currentLot.data.header.receptionTime}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, receptionTime: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Etats des caisses */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Etats des caisses (C/NC)</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.boxState}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, boxState: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Matricule */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Matricule</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.matricule}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, matricule: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Variété */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Variété</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.variety}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, variety: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Producteur */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Producteur</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.producer}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, producer: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Contrôle qualité camion */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Contrôle qualité de états Camion : Odeur ; corps étranger ; nettoyage. (C/NC)</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.truckQuality}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, truckQuality: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Nombre total de palettes */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Nombre total de palettes</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.totalPallets}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, totalPallets: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Poids NET */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Poids NET</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.netWeight}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, netWeight: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* N° de lot du produit */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">N° de lot du produit</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.productLotNumber}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, productLotNumber: e.target.value } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Quality rows */}
                  {/* Fruit avec trace de maladie */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold" rowSpan={2}>Nbr Fruit avec trace de maladie</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Nbr de fruits<br/>(max 10u)</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Poids</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">%</td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.diseaseTraces.count}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, diseaseTraces: { ...currentLot.data.qualityChecks.diseaseTraces, count: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.diseaseTraces.weight}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, diseaseTraces: { ...currentLot.data.qualityChecks.diseaseTraces, weight: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.diseaseTraces.percentage}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, diseaseTraces: { ...currentLot.data.qualityChecks.diseaseTraces, percentage: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>

                  {/* Nbr fruit murs */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold" rowSpan={2}>Nbr fruit murs</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Nbr de fruits<br/>(max 0u)</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Poids</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">%</td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.ripeFruit.count}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, ripeFruit: { ...currentLot.data.qualityChecks.ripeFruit, count: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.ripeFruit.weight}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, ripeFruit: { ...currentLot.data.qualityChecks.ripeFruit, weight: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.ripeFruit.percentage}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, ripeFruit: { ...currentLot.data.qualityChecks.ripeFruit, percentage: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>

                  {/* Nbr fruit Terreux */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold" rowSpan={2}>Nbr fruit Terreux</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Nbr de fruits<br/>(max 8u)</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Poids</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">%</td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.dirtyFruit.count}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, dirtyFruit: { ...currentLot.data.qualityChecks.dirtyFruit, count: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.dirtyFruit.weight}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, dirtyFruit: { ...currentLot.data.qualityChecks.dirtyFruit, weight: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.dirtyFruit.percentage}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, dirtyFruit: { ...currentLot.data.qualityChecks.dirtyFruit, percentage: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>

                  {/* Epiderme et brulures de soleil */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold" rowSpan={2}>Epiderme et brulures de soleil</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Nbr de fruits<br/>(max 6cm²)</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Poids</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">%</td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.sunBurns.count}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, sunBurns: { ...currentLot.data.qualityChecks.sunBurns, count: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.sunBurns.weight}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, sunBurns: { ...currentLot.data.qualityChecks.sunBurns, weight: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.sunBurns.percentage}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, sunBurns: { ...currentLot.data.qualityChecks.sunBurns, percentage: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>

                  {/* Nbr fruit Sans pédoncule */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold" rowSpan={2}>Nbr fruit
                      <br />
                      Sans pédoncule
                    </td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Nbr de fruits</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">Poids</td>
                    <td className="bg-lime-200 border border-black p-1 font-bold text-center">%</td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.withoutStem.count}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, withoutStem: { ...currentLot.data.qualityChecks.withoutStem, count: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.withoutStem.weight}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, withoutStem: { ...currentLot.data.qualityChecks.withoutStem, weight: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.withoutStem.percentage}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, withoutStem: { ...currentLot.data.qualityChecks.withoutStem, percentage: e.target.value } } })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                    <td className="border border-black p-1" colSpan={3}></td>
                  </tr>

                  {/* Totalité des défauts % */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Totalité des défauts %</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.totalDefects}
                        onChange={(e) => updateCurrentLot({ totalDefects: e.target.value })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Couleur C/NC */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Couleur C/NC</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.color}
                        onChange={(e) => updateCurrentLot({ color: e.target.value })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Odeur C / NC */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Odeur C / NC</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.odor}
                        onChange={(e) => updateCurrentLot({ odor: e.target.value })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>

                  {/* Décision + Action */}
                  <tr>
                    <td className="bg-lime-300 border border-black p-1 font-bold">Décision + Action</td>
                    <td className="border border-black p-1" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.decision}
                        onChange={(e) => updateCurrentLot({ decision: e.target.value })}
                        className="w-full text-xs border-none outline-none"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Footer notes */}
              <div className="p-2 text-xs border-t border-black">
                <p className="font-semibold">Note : en cas de présence :</p>
                <p>• En cas d'un taux élevé (10%) des écarts il faut identifier le lot par une F.P et informer le R.Q</p>
              </div>

              <div className="text-center p-4 border-t border-black">
                <p className="font-bold text-sm">Visa responsable de réception</p>
                <div className="mt-1">
                  <input
                    type="text"
                    value={currentLot.data.responsibleSignature}
                    onChange={(e) => updateCurrentLot({ responsibleSignature: e.target.value })}
                    className="w-64 text-xs border border-black rounded px-2 py-1"
                    placeholder="Nom et signature"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 text-center flex flex-wrap gap-3 justify-center">
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
