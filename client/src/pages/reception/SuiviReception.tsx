import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus, Package, Plus, RefreshCw, Save, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useSharedLots } from '@/hooks/useSharedLots';
import { SharedLot } from '@/lib/sharedLotService';
import logoUrl from '../../../assets/logo.png';
import { receptionArchiveService, ReceptionArchive } from '@/lib/receptionArchiveService';

// Data model for a Suivi Reception lot
interface ReceptionRow {
  numeroPalette: string; // N° PALETTE
  nrCaisse: string;      // NR CAISSE
  tarePalette: string;   // TARE PALETTE
  poidsBrut: string;     // POIDS BRUT (kg)
  poidsNet: string;      // POIDS NET (kg)
  variete: string;       // VARIETE
  numeroLotInterne: string; // N°DE LOT INTERN
  decision: string;      // DECISION
}

interface ReceptionFormData {
  header: {
    date: string;
    responsable: string;
    compagne: string;
    produit: string; // AVOCAT
    conventionnel: boolean;
    biologique: boolean;
    bonLivraison: string;  // N° BON DE LIVRISON
    bonReception: string;  // N° BON DE RECEPTION
  };
  rows: ReceptionRow[];
  footer: {
    totalLabel: string; // TOTALE (display only)
    poidsTicket: string;
    poidsUsine: string;
    ecart: string;
  };
}

const defaultReceptionForm = (): ReceptionFormData => ({
  header: {
    date: format(new Date(), 'yyyy-MM-dd'),
    responsable: '',
    compagne: '',
    produit: 'AVOCAT',
    conventionnel: true,
    biologique: false,
    bonLivraison: '',
    bonReception: ''
  },
  rows: Array.from({ length: 20 }, () => ({
    numeroPalette: '',
    nrCaisse: '',
    tarePalette: '',
    poidsBrut: '',
    poidsNet: '',
    variete: '',
    numeroLotInterne: '',
    decision: ''
  })),
  footer: {
    totalLabel: 'TOTALE',
    poidsTicket: '',
    poidsUsine: '',
    ecart: ''
  }
});

const SuiviReception: React.FC = () => {
  const { lots, addLot, updateLot, deleteLot, getProductionLots } = useSharedLots();

  // Only reception lots
  const receptionLots = useMemo(() => lots.filter(l => l.type === 'reception'), [lots]);
  const [currentLotId, setCurrentLotId] = useState<string>('');
  const [archives, setArchives] = useState<ReceptionArchive[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  // Convert SharedLot to local model
  const sharedToLocal = (sl: SharedLot): ReceptionFormData => {
    return sl.receptionData || defaultReceptionForm();
  };

  const getCurrentLot = () => receptionLots.find(l => l.id === currentLotId);
  const getCurrentForm = (): ReceptionFormData => {
    const lot = getCurrentLot();
    if (!lot) return defaultReceptionForm();
    const data = sharedToLocal(lot);
    const def = defaultReceptionForm();
    return {
      header: { ...def.header, ...data.header },
      rows: data.rows?.length ? data.rows : def.rows,
      footer: { ...def.footer, ...data.footer }
    };
  };

  const createNewLot = async (): Promise<string> => {
    const form = defaultReceptionForm();
    const lotNumber = `Réception ${receptionLots.length + 1}`;
    const newId = await addLot({
      lotNumber,
      status: 'brouillon',
      type: 'reception',
      receptionData: form
    });
    setCurrentLotId(newId);
    return newId;
  };

  const duplicateLot = async (lotId: string) => {
    const lot = receptionLots.find(l => l.id === lotId);
    if (!lot) return;
    const newId = await addLot({
      lotNumber: `${lot.lotNumber} (Copie)`,
      status: lot.status,
      type: 'reception',
      receptionData: sharedToLocal(lot)
    });
    setCurrentLotId(newId);
  };

  const removeLot = async (lotId: string) => {
    if (receptionLots.length <= 1) {
      alert('Vous ne pouvez pas supprimer le dernier lot');
      return;
    }
    if (confirm('Supprimer ce lot ?')) {
      await deleteLot(lotId);
      const remaining = receptionLots.filter(l => l.id !== lotId);
      setCurrentLotId(remaining[0]?.id || '');
    }
  };

  const updateForm = async (updates: Partial<ReceptionFormData>) => {
    if (!currentLotId) return;
    const current = getCurrentForm();
    const next: ReceptionFormData = {
      header: { ...current.header, ...(updates.header || {}) },
      rows: updates.rows || current.rows,
      footer: { ...current.footer, ...(updates.footer || {}) }
    };
    await updateLot(currentLotId, { receptionData: next });
  };

  const calculateTotals = () => {
    const form = getCurrentForm();
    const totalBrut = form.rows.reduce((sum, r) => sum + (parseFloat(r.poidsBrut) || 0), 0);
    const totalNet = form.rows.reduce((sum, r) => sum + (parseFloat(r.poidsNet) || 0), 0);
    return { totalBrut, totalNet };
  };

  // Archive subscription
  useEffect(() => {
    const unsub = receptionArchiveService.subscribe(
      setArchives,
      (err) => {
        console.error('Archives listener error:', err);
        alert('Erreur permissions archives: ' + (err.message || 'permission-denied'));
      }
    );
    return () => unsub();
  }, []);

  const saveToArchive = async () => {
    setIsArchiving(true);
    try {
      const form = getCurrentForm();
      const lot = getCurrentLot();
      const lotNumber = lot?.lotNumber || `Réception ${new Date().toISOString()}`;
      await receptionArchiveService.add({ lotNumber, data: form });
      alert('Réception archivée avec succès');
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l\'archivage');
    } finally {
      setIsArchiving(false);
    }
  };

  const loadArchive = async (archive: ReceptionArchive) => {
    // Load archived data into current editor by saving into current shared lot
    let targetId = currentLotId;
    if (!targetId) {
      targetId = await createNewLot();
    }
    if (!targetId) return;
    await updateLot(targetId, { receptionData: archive.data });
    setSelectedArchiveId(archive.id);
    alert('Archive chargée dans l\'éditeur');
  };

  const updateArchiveFromEditor = async () => {
    if (!selectedArchiveId) {
      alert('Aucune archive sélectionnée');
      return;
    }
    const form = getCurrentForm();
    await receptionArchiveService.update(selectedArchiveId, { data: form });
    alert('Archive mise à jour');
  };

  const deleteArchive = async (id: string) => {
    if (!confirm('Supprimer cette archive ?')) return;
    await receptionArchiveService.delete(id);
  };

  const saveWorking = async () => {
    if (!currentLotId) {
      alert('Aucun lot sélectionné');
      return;
    }
    await updateLot(currentLotId, { receptionData: getCurrentForm() });
    alert('Données enregistrées dans le lot courant');
  };

  const generatePDF = async () => {
    const form = getCurrentForm();
    const lot = getCurrentLot();
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = 210;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    // Colors matching the original form
    const colors = {
      headerGreen: [101, 174, 73],     // Green header
      lightGreen: [200, 230, 201],     // Light green backgrounds
      blue: [0, 100, 200],             // Blue for TOTALE
      border: [0, 0, 0],               // Black borders
      text: [0, 0, 0],                 // Black text
      white: [255, 255, 255]           // White background
    } as const;

    const drawRect = (x: number, y: number, w: number, h: number, fill?: readonly number[], lineWidth = 0.5) => {
      doc.setLineWidth(lineWidth);
      if (fill) {
        doc.setFillColor(fill[0], fill[1], fill[2]);
      }
      doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      doc.rect(x, y, w, h, fill ? 'FD' : 'S');
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      size: number,
      bold: boolean = false,
      color: readonly [number, number, number] = colors.text as readonly [number, number, number]
    ) => {
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(text, x, y);
    };

    let y = margin;

    // Helper to convert imported asset URL to data URL for jsPDF
    const toDataURL = async (url: string): Promise<string> => {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    };

    // Logo block and main header
    drawRect(margin, y, 30, 20, colors.lightGreen);
    try {
      const dataUrl = await toDataURL(logoUrl as string);
      doc.addImage(dataUrl, 'PNG', margin + 2, y + 2, 26, 16);
    } catch (e) {
      // Fallback text if logo fails to load
      drawText('LOGO', margin + 10, y + 12, 10, true);
      console.warn('Failed to load logo for PDF:', e);
    }

    // Main title
    drawRect(margin + 30, y, 100, 20, colors.headerGreen);
    drawText('SUIVI RECEPTION', margin + 65, y + 12, 14, true, colors.white);

    // Document info
    drawRect(margin + 130, y, 60, 20, colors.white);
    drawText('SMQ.ENR 24', margin + 135, y + 6, 9, true);
    drawText('Date: 01/07/2023', margin + 135, y + 11, 8);
    drawText('Version: 01', margin + 135, y + 16, 8);

    y += 25;

    // Form header section
    drawRect(margin, y, contentWidth, 15, colors.white);
    
    // Date, Responsable, Compagne row
    drawText('Date:', margin + 2, y + 6, 9, true);
    drawText(form.header.date || '', margin + 15, y + 6, 9);
    
    drawText('Responsable:', margin + 65, y + 6, 9, true);
    drawText(form.header.responsable || '', margin + 90, y + 6, 9);
    
    drawText('Compagne:', margin + 135, y + 6, 9, true);
    drawText(form.header.compagne || '', margin + 155, y + 6, 9);

    // Bon numbers row
    drawText(`N° BON DE LIVRISON : ${form.header.bonLivraison || ''}`, margin + 2, y + 12, 8);
    drawText(`N° BON DE RECEPTION : ${form.header.bonReception || ''}`, margin + 100, y + 12, 8);

    y += 20;

    // Product and type section
    drawRect(margin, y, contentWidth, 10, colors.lightGreen);
    drawText(`PRODUIT : ${form.header.produit}`, margin + 2, y + 6, 9, true);
    
    // Type checkboxes
    const conventionnelText = form.header.conventionnel ? '☑ CONVENTIONNEL' : '☐ CONVENTIONNEL';
    const biologiqueText = form.header.biologique ? '☑ BIOLOGIQUE' : '☐ BIOLOGIQUE';
    drawText(conventionnelText, margin + 120, y + 6, 8);
    drawText(biologiqueText, margin + 160, y + 6, 8);

    y += 15;

    // Table headers with exact column structure from image
  const headers = ['N° PALETTE', 'NR CAISSE', 'TARE PALETTE', 'POIDS BRUT (Kg)', 'POIDS NET (Kg)', 'VARIETE', 'N°DE LOT INTERN', 'DECISION'];
  // Make DECISION narrower and increase other columns overall while keeping total width constant (190mm)
  const colWidths = [25, 21, 25, 27, 25, 21, 29, 17];

    drawRect(margin, y, contentWidth, 12, colors.lightGreen);
    
    let x = margin;
    headers.forEach((header, i) => {
      // Vertical lines between columns
      if (i > 0) {
        doc.line(x, y, x, y + 12);
      }
      
      // Multi-line headers for better fit
      const lines = header.split(' ');
      if (lines.length > 1) {
        drawText(lines[0], x + 1, y + 5, 7, true);
        drawText(lines.slice(1).join(' '), x + 1, y + 9, 7, true);
      } else {
        drawText(header, x + 1, y + 7.5, 7, true);
      }
      x += colWidths[i];
    });

    y += 12;

    // Table rows - exactly 20 rows as in the image
    for (let i = 0; i < 20; i++) {
      const row = form.rows[i];
      drawRect(margin, y, contentWidth, 8, colors.white);
      
      let cx = margin;
      const values = [
        row?.numeroPalette || '',
        row?.nrCaisse || '',
        row?.tarePalette || '',
        row?.poidsBrut || '',
        row?.poidsNet || '',
        row?.variete || '',
        row?.numeroLotInterne || '',
        row?.decision || ''
      ];

      values.forEach((value, j) => {
        // Vertical lines
        if (j > 0) {
          doc.line(cx, y, cx, y + 8);
        }
        drawText(value, cx + 1, y + 5.5, 7);
        cx += colWidths[j];
      });
      y += 8;
    }

    // TOTALE section (blue background like in image)
    y += 2;
    drawRect(margin, y, contentWidth, 10, [0, 150, 255]);
    drawText('TOTALE', margin + 2, y + 6, 9, true, colors.white);

    y += 15;

    // Footer section with three columns
    drawRect(margin, y, contentWidth, 12, colors.white);
    
    const footerWidth = contentWidth / 3;
    
    // POIDS TICKET
    drawText('POIDS TICKET', margin + 2, y + 4, 8, true);
    drawText(form.footer.poidsTicket || '', margin + 2, y + 9, 8);
    
    // POIDS USINE
    drawText('POIDS USINE', margin + footerWidth + 2, y + 4, 8, true);
    drawText(form.footer.poidsUsine || '', margin + footerWidth + 2, y + 9, 8);
    
    // ECART
    drawText('ECART', margin + (footerWidth * 2) + 2, y + 4, 8, true);
    drawText(form.footer.ecart || '', margin + (footerWidth * 2) + 2, y + 9, 8);

    // Vertical dividers in footer
    doc.line(margin + footerWidth, y, margin + footerWidth, y + 12);
    doc.line(margin + (footerWidth * 2), y, margin + (footerWidth * 2), y + 12);

    const fileName = `Suivi_Reception_${(lot?.lotNumber || 'Lot').replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(fileName);
  };

  // Auto-select first lot
  useEffect(() => {
    if (!currentLotId && receptionLots.length) {
      setCurrentLotId(receptionLots[0].id);
    }
  }, [receptionLots, currentLotId]);

  const form = getCurrentForm();

  return (
    <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl">
        {/* Header Controls */}
        <div className="bg-white border-b p-4 shadow-sm rounded-t-xl">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Suivi de réception - Multi-lots</h1>
            <div className="flex gap-3">
              <button onClick={createNewLot} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all">
                <Plus size={20} /> Nouveau Lot
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {receptionLots.map((lot) => (
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
                  <button onClick={() => duplicateLot(lot.id)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50" title="Dupliquer">
                    <Copy size={16} />
                  </button>
                  {receptionLots.length > 1 && (
                    <button onClick={() => removeLot(lot.id)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form matching the original PDF layout exactly */}
        <div className="p-6">
          {/* Header with logo section, title and document info */}
          <div className="flex mb-6">
            {/* Company logo */}
            <div className="w-24 h-16 bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center mr-4 overflow-hidden">
              <img src={logoUrl} alt="Fruits For You" className="object-contain h-full" />
            </div>
            
            {/* Main title */}
            <div className="flex-1 bg-green-600 text-white flex items-center justify-center rounded-lg mr-4">
              <h2 className="text-xl font-bold">SUIVI RECEPTION</h2>
            </div>
            
            {/* Document info */}
            <div className="w-40 bg-gray-50 border-2 border-gray-300 rounded-lg p-2">
              <div className="text-sm font-bold">SMQ.ENR 24</div>
              <div className="text-xs">Date: 01/07/2023</div>
              <div className="text-xs">Version: 01</div>
            </div>
          </div>

          {/* Form fields section matching original layout */}
          <div className="border-2 border-gray-400 mb-4">
            {/* First row: Date, Responsable, Compagne */}
            <div className="flex border-b border-gray-400 p-2 bg-gray-50">
              <div className="flex-1 flex items-center">
                <span className="font-bold mr-2">Date:</span>
                <input
                  type="date"
                  value={form.header.date}
                  onChange={(e) => updateForm({ header: { ...form.header, date: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex-1 flex items-center border-l border-gray-400 pl-2">
                <span className="font-bold mr-2">Responsable:</span>
                <input
                  type="text"
                  value={form.header.responsable}
                  onChange={(e) => updateForm({ header: { ...form.header, responsable: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                />
              </div>
              <div className="flex-1 flex items-center border-l border-gray-400 pl-2">
                <span className="font-bold mr-2">Compagne:</span>
                <input
                  type="text"
                  value={form.header.compagne}
                  onChange={(e) => updateForm({ header: { ...form.header, compagne: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                />
              </div>
            </div>

            {/* Second row: Bon numbers */}
            <div className="flex p-2 bg-white border-b border-gray-400">
              <div className="flex-1 flex items-center">
                <span className="text-sm mr-2">N° BON DE LIVRISON :</span>
                <input
                  type="text"
                  value={form.header.bonLivraison}
                  onChange={(e) => updateForm({ header: { ...form.header, bonLivraison: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                />
              </div>
              <div className="flex-1 flex items-center border-l border-gray-400 pl-2">
                <span className="text-sm mr-2">N° BON DE RECEPTION :</span>
                <input
                  type="text"
                  value={form.header.bonReception}
                  onChange={(e) => updateForm({ header: { ...form.header, bonReception: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                />
              </div>
            </div>

            {/* Third row: Product and type */}
            <div className="flex p-2 bg-green-100 items-center">
              <div className="flex-1">
                <span className="font-bold mr-2">PRODUIT :</span>
                <input
                  type="text"
                  value={form.header.produit}
                  onChange={(e) => updateForm({ header: { ...form.header, produit: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none font-bold"
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.header.conventionnel}
                    onChange={(e) => updateForm({ header: { ...form.header, conventionnel: e.target.checked } })}
                    className="mr-1"
                  />
                  <span className="text-sm font-medium">CONVENTIONNEL</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.header.biologique}
                    onChange={(e) => updateForm({ header: { ...form.header, biologique: e.target.checked } })}
                    className="mr-1"
                  />
                  <span className="text-sm font-medium">BIOLOGIQUE</span>
                </label>
              </div>
            </div>
          </div>

          {/* Table matching the original exactly */}
          <div className="border-2 border-gray-400 mb-4">
            {/* Table header */}
            <div className="flex bg-green-100 border-b border-gray-400">
              <div className="w-24 p-2 border-r border-gray-400 text-center">
                <div className="text-xs font-bold">N° PALETTE</div>
              </div>
              <div className="w-20 p-2 border-r border-gray-400 text-center">
                <div className="text-xs font-bold">NR CAISSE</div>
              </div>
              <div className="w-24 p-2 border-r border-gray-400 text-center">
                <div className="text-xs font-bold leading-tight">TARE<br/>PALETTE</div>
              </div>
              <div className="w-28 p-2 border-r border-gray-400 text-center">
                <div className="text-xs font-bold leading-tight">POIDS BRUT<br/>(Kg)</div>
              </div>
              <div className="w-24 p-2 border-r border-gray-400 text-center">
                <div className="text-xs font-bold leading-tight">POIDS NET<br/>(Kg)</div>
              </div>
              <div className="w-20 p-2 border-r border-gray-400 text-center">
                <div className="text-xs font-bold">VARIETE</div>
              </div>
              <div className="w-28 p-2 border-r border-gray-400 text-center">
                <div className="text-xs font-bold leading-tight">N°DE LOT<br/>INTERN</div>
              </div>
              <div className="w-24 p-2 text-center">
                <div className="text-xs font-bold">DECISION</div>
              </div>
            </div>

            {/* Table rows - exactly 20 rows */}
            {form.rows.map((row, index) => (
              <div key={index} className="flex border-b border-gray-400 hover:bg-gray-50">
                <div className="w-24 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.numeroPalette}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, numeroPalette: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-20 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.nrCaisse}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, nrCaisse: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-24 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.tarePalette}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, tarePalette: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-28 border-r border-gray-400">
                  <input
                    type="number"
                    value={row.poidsBrut}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, poidsBrut: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                    step="0.01"
                  />
                </div>
                <div className="w-24 border-r border-gray-400">
                  <input
                    type="number"
                    value={row.poidsNet}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, poidsNet: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                    step="0.01"
                  />
                </div>
                <div className="w-20 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.variete}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, variete: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-28 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.numeroLotInterne}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, numeroLotInterne: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="text"
                    value={row.decision}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, decision: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-1 border-0 text-xs text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
              </div>
            ))}

            {/* TOTALE row */}
            <div className="flex bg-blue-500 text-white">
              <div className="w-20 p-2 text-center font-bold text-sm">TOTALE</div>
              <div className="flex-1"></div>
            </div>
          </div>

          {/* Footer section matching original */}
          <div className="border-2 border-gray-400 mb-6">
            <div className="flex">
              <div className="flex-1 p-3 border-r border-gray-400">
                <div className="text-sm font-bold mb-1">POIDS TICKET</div>
                <input
                  type="text"
                  value={form.footer.poidsTicket}
                  onChange={(e) => updateForm({ footer: { ...form.footer, poidsTicket: e.target.value } })}
                  className="w-full border-0 bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex-1 p-3 border-r border-gray-400">
                <div className="text-sm font-bold mb-1">POIDS USINE</div>
                <input
                  type="text"
                  value={form.footer.poidsUsine}
                  onChange={(e) => updateForm({ footer: { ...form.footer, poidsUsine: e.target.value } })}
                  className="w-full border-0 bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex-1 p-3">
                <div className="text-sm font-bold mb-1">ECART</div>
                <input
                  type="text"
                  value={form.footer.ecart}
                  onChange={(e) => updateForm({ footer: { ...form.footer, ecart: e.target.value } })}
                  className="w-full border-0 bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={generatePDF} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all">
              <FilePlus size={20} /> Générer PDF
            </button>
            <button onClick={() => updateForm(defaultReceptionForm())} className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all">
              <RefreshCw size={20} /> Réinitialiser
            </button>
            <button onClick={saveWorking} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all">
              <Save size={20} /> Enregistrer
            </button>
            <button onClick={saveToArchive} disabled={isArchiving} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-60">
              <FilePlus size={20} /> {isArchiving ? 'Archivage...' : 'Archiver'}
            </button>
            {selectedArchiveId && (
              <button onClick={updateArchiveFromEditor} className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-all">
                <Save size={20} /> Mettre à jour l'archive
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Archived receptions */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl mt-6 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold">Archives - Réceptions</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Les archives sont des copies figées de vos formulaires (anciens rapports). Utilisez Archiver pour ajouter un nouveau rapport ici.</p>
        {archives.length === 0 ? (
          <div className="text-gray-500">Aucune archive pour le moment.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archives.map((a) => (
              <div key={a.id} className={`border rounded-lg p-4 ${selectedArchiveId === a.id ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.lotNumber}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadArchive(a)}
                      className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Ouvrir
                    </button>
                    <button
                      onClick={async () => {
                        const name = prompt('Renommer l\'archive en :', a.lotNumber);
                        if (name && name.trim()) {
                          await receptionArchiveService.update(a.id, { lotNumber: name.trim() });
                        }
                      }}
                      className="px-2 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => deleteArchive(a.id)}
                      className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Dernière mise à jour: {a.updatedAt?.toDate ? a.updatedAt.toDate().toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviReception;