import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { FilePlus, Package, Plus, RefreshCw, Save, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useSharedLots } from '@/hooks/useSharedLots';
import { SharedLot } from '@/lib/sharedLotService';
import logoUrl from '../../../assets/logo.png';
import { dechetArchiveService, DechetArchive } from '@/lib/dechetArchiveService';

// Data model for a Suivi Déchets lot
interface DechetRow {
  numeroPalette: string;     // N° palette
  nombreCaisses: string;     // Nombre de caisses
  poidsBrut: string;         // Poids Brut
  poidsNet: string;          // Poids Net
  natureDechet: string;      // Nature de déchet
  variete: string;           // Variété
}

interface DechetFormData {
  header: {
    code: string;              // F.S.D
    date: string;              // Date creation
    version: string;           // version
    dateTraitement: string;    // Date traitement
    responsableTracabilite: string; // Responsable Traçabilité
    produit: string;           // AVOCAT
    conventionnel: boolean;
    biologique: boolean;
  };
  rows: DechetRow[];
}

const defaultDechetForm = (): DechetFormData => ({
  header: {
    code: 'F.S.D',
    date: '18/09/2023',
    version: '00',
    dateTraitement: format(new Date(), 'dd/MM/yyyy'),
    responsableTracabilite: '',
    produit: 'AVOCAT',
    conventionnel: true,
    biologique: false,
  },
  rows: Array.from({ length: 20 }, () => ({
    numeroPalette: '',
    nombreCaisses: '',
    poidsBrut: '',
    poidsNet: '',
    natureDechet: '',
    variete: ''
  }))
});

const SuiviDechets: React.FC = () => {
  const { lots, addLot, updateLot, deleteLot } = useSharedLots();

  // Only dechet lots
  const dechetLots = useMemo(() => lots.filter(l => l.type === 'dechets'), [lots]);
  const [currentLotId, setCurrentLotId] = useState<string>('');
  const [archives, setArchives] = useState<DechetArchive[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  // Convert SharedLot to local model
  const sharedToLocal = (sl: SharedLot): DechetFormData => {
    return (sl as any).dechetData || defaultDechetForm();
  };

  const getCurrentLot = () => dechetLots.find(l => l.id === currentLotId);
  const getCurrentForm = (): DechetFormData => {
    const lot = getCurrentLot();
    if (!lot) return defaultDechetForm();
    const data = sharedToLocal(lot);
    const def = defaultDechetForm();
    return {
      header: { ...def.header, ...data.header },
      rows: data.rows?.length ? data.rows : def.rows
    };
  };

  const createNewLot = async (): Promise<string> => {
    const form = defaultDechetForm();
    const lotNumber = `Déchets ${dechetLots.length + 1}`;
    const newId = await addLot({
      lotNumber,
      status: 'brouillon' as any,
      type: 'dechets' as any,
      dechetData: form as any
    } as any);
    setCurrentLotId(newId);
    return newId;
  };

  const duplicateLot = async (lotId: string) => {
    const lot = dechetLots.find(l => l.id === lotId);
    if (!lot) return;
    const newId = await addLot({
      lotNumber: `${lot.lotNumber} (Copie)`,
      status: lot.status as any,
      type: 'dechets' as any,
      dechetData: sharedToLocal(lot) as any
    } as any);
    setCurrentLotId(newId);
  };

  const removeLot = async (lotId: string) => {
    if (dechetLots.length <= 1) {
      alert('Vous ne pouvez pas supprimer le dernier lot');
      return;
    }
    if (confirm('Supprimer ce lot ?')) {
      await deleteLot(lotId);
      const remaining = dechetLots.filter(l => l.id !== lotId);
      setCurrentLotId(remaining[0]?.id || '');
    }
  };

  const updateForm = async (updates: Partial<DechetFormData>) => {
    if (!currentLotId) return;
    const current = getCurrentForm();
    const next: DechetFormData = {
      header: { ...current.header, ...(updates.header || {}) },
      rows: updates.rows || current.rows
    };
    await updateLot(currentLotId, { dechetData: next } as any);
  };

  // Archive subscription
  useEffect(() => {
    let unsubscribeArchives: (() => void) | undefined;
    let unsubscribeAuth: (() => void) | undefined;

    const startArchives = () => {
      unsubscribeArchives = dechetArchiveService.subscribe(
        setArchives,
        (err) => {
          console.error('Archives listener error:', err);
          alert('Erreur permissions archives: ' + (err.message || 'permission-denied'));
        }
      );
    };

    if (auth.currentUser) {
      startArchives();
    } else {
      unsubscribeAuth = onAuthStateChanged(auth, (u) => {
        if (u) {
          startArchives();
          if (unsubscribeAuth) unsubscribeAuth();
        }
      });
    }

    return () => {
      if (unsubscribeArchives) unsubscribeArchives();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  const saveToArchive = async () => {
    setIsArchiving(true);
    try {
      const form = getCurrentForm();
      const lot = getCurrentLot();
      const lotNumber = lot?.lotNumber || `Déchets ${new Date().toISOString()}`;
      await dechetArchiveService.add({ lotNumber, data: form });
      alert('Fiche déchets archivée avec succès');
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l\'archivage');
    } finally {
      setIsArchiving(false);
    }
  };

  const loadArchive = async (archive: DechetArchive) => {
    let targetId = currentLotId;
    if (!targetId) {
      targetId = await createNewLot();
    }
    if (!targetId) return;
    await updateLot(targetId, { dechetData: archive.data } as any);
    setSelectedArchiveId(archive.id);
    alert('Archive chargée dans l\'éditeur');
  };

  const updateArchiveFromEditor = async () => {
    if (!selectedArchiveId) {
      alert('Aucune archive sélectionnée');
      return;
    }
    const form = getCurrentForm();
    await dechetArchiveService.update(selectedArchiveId, { data: form });
    alert('Archive mise à jour');
  };

  const deleteArchive = async (id: string) => {
    if (!confirm('Supprimer cette archive ?')) return;
    await dechetArchiveService.delete(id);
  };

  const saveWorking = async () => {
    if (!currentLotId) {
      alert('Aucun lot sélectionné');
      return;
    }
    await updateLot(currentLotId, { dechetData: getCurrentForm() } as any);
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

    // Colors
    const colors = {
      headerGreen: [101, 174, 73] as const,
      lightGreen: [200, 230, 201] as const,
      border: [0, 0, 0] as const,
      text: [0, 0, 0] as const,
      white: [255, 255, 255] as const
    };

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
      color: readonly [number, number, number] = colors.text
    ) => {
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(text, x, y);
    };

    let y = margin;

    // Helper for logo
    const toDataURL = async (url: string): Promise<string> => {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        (fr as any).onloadend = () => resolve(fr.result as string);
        (fr as any).onerror = reject;
        fr.readAsDataURL(blob);
      });
    };

    // Header section
    drawRect(margin, y, 30, 20, colors.lightGreen);
    try {
      const dataUrl = await toDataURL(logoUrl as unknown as string);
      doc.addImage(dataUrl, 'PNG', margin + 2, y + 2, 26, 16);
    } catch (e) {
      drawText('LOGO', margin + 10, y + 12, 10, true);
      console.warn('Failed to load logo for PDF:', e);
    }

    // Title
    drawRect(margin + 30, y, 100, 20, colors.headerGreen);
    drawText('Fiche Suivi Déchets', margin + 65, y + 12, 14, true, colors.white);

    // Document info
    drawRect(margin + 130, y, 60, 20, colors.white);
    drawText(`code : ${form.header.code}`, margin + 135, y + 5, 8, true);
    drawText(`Date : ${form.header.date}`, margin + 135, y + 10, 8);
    drawText(`version : ${form.header.version}`, margin + 135, y + 15, 8);

    y += 25;

    // Form header section
    drawRect(margin, y, contentWidth, 15, colors.white);
    
    // Date and Responsable row
    drawText(`Date : ${form.header.dateTraitement}`, margin + 2, y + 8, 9);
    drawText('Responsable Traçabilité :', margin + 80, y + 8, 9, true);
    drawText(form.header.responsableTracabilite || '', margin + 140, y + 8, 9);

    y += 20;

    // Product and type section
    drawRect(margin, y, contentWidth, 10, colors.lightGreen);
    drawText(`Produit : ${form.header.produit}`, margin + 2, y + 6, 9, true);
    
    // Type checkboxes
    const conventionnelText = form.header.conventionnel ? '☑ CONVENTIONNEL' : '☐ CONVENTIONNEL';
    const biologiqueText = form.header.biologique ? '☑ BIOLOGIQUE' : '☐ BIOLOGIQUE';
    drawText(conventionnelText, margin + 100, y + 6, 8);
    drawText(biologiqueText, margin + 150, y + 6, 8);

    y += 15;

    // Table headers
    const headers = ['N° palette', 'Nombre de caisses', 'Poids Brut', 'Poids Net', 'Nature de déchet', 'Variété'];
    const colWidths = [30, 35, 30, 30, 40, 25];

    drawRect(margin, y, contentWidth, 12, colors.lightGreen);
    
    let x = margin;
    headers.forEach((header, i) => {
      if (i > 0) {
        doc.line(x, y, x, y + 12);
      }
      
      const lines = header.split(' ');
      if (lines.length > 1) {
        drawText(lines[0], x + 2, y + 5, 8, true);
        drawText(lines.slice(1).join(' '), x + 2, y + 9, 8, true);
      } else {
        drawText(header, x + 2, y + 7.5, 8, true);
      }
      x += colWidths[i];
    });

    y += 12;

    // Table rows
    for (let i = 0; i < 20; i++) {
      const row = form.rows[i];
      drawRect(margin, y, contentWidth, 10, colors.white);
      
      let cx = margin;
      const values = [
        row?.numeroPalette || '',
        row?.nombreCaisses || '',
        row?.poidsBrut || '',
        row?.poidsNet || '',
        row?.natureDechet || '',
        row?.variete || ''
      ];

      values.forEach((value, j) => {
        if (j > 0) {
          doc.line(cx, y, cx, y + 10);
        }
        drawText(value, cx + 2, y + 6.5, 8);
        cx += colWidths[j];
      });
      y += 10;
    }

    const fileName = `Fiche_Suivi_Dechets_${(lot?.lotNumber || 'Lot').replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(fileName);
  };

  // Auto-select first lot
  useEffect(() => {
    if (!currentLotId && dechetLots.length) {
      setCurrentLotId(dechetLots[0].id);
    }
  }, [dechetLots, currentLotId]);

  const form = getCurrentForm();

  return (
    <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl">
        {/* Header Controls */}
        <div className="bg-white border-b p-4 shadow-sm rounded-t-xl">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Fiche Suivi Déchets - Multi-lots</h1>
            <div className="flex gap-3">
              <button onClick={createNewLot} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all">
                <Plus size={20} /> Nouveau Lot
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dechetLots.map((lot) => (
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
                  {dechetLots.length > 1 && (
                    <button onClick={() => removeLot(lot.id)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form matching the waste tracking PDF layout */}
        <div className="p-6">
          {/* Header with logo section, title and document info */}
          <div className="flex mb-6">
            {/* Company logo */}
            <div className="w-24 h-16 bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center mr-4 overflow-hidden">
              <img src={logoUrl} alt="Fruits For You" className="object-contain h-full" />
            </div>
            
            {/* Main title */}
            <div className="flex-1 bg-green-600 text-white flex items-center justify-center rounded-lg mr-4">
              <h2 className="text-xl font-bold">Fiche Suivi Déchets</h2>
            </div>
            
            {/* Document info */}
            <div className="w-48 bg-gray-50 border-2 border-gray-300 rounded-lg p-2">
              <div className="text-sm">
                <span className="font-bold">code :</span>
                <input
                  type="text"
                  value={form.header.code}
                  onChange={(e) => updateForm({ header: { ...form.header, code: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-16"
                />
              </div>
              <div className="text-sm">
                <span className="font-bold">Date :</span>
                <input
                  type="text"
                  value={form.header.date}
                  onChange={(e) => updateForm({ header: { ...form.header, date: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-20"
                />
              </div>
              <div className="text-sm">
                <span className="font-bold">version :</span>
                <input
                  type="text"
                  value={form.header.version}
                  onChange={(e) => updateForm({ header: { ...form.header, version: e.target.value } })}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-8"
                />
              </div>
            </div>
          </div>

          {/* Form fields section */}
          <div className="border-2 border-gray-400 mb-4">
            {/* Date and Responsable row */}
            <div className="flex border-b border-gray-400 p-3 bg-gray-50">
              <div className="flex-1 flex items-center">
                <span className="font-bold mr-2">Date :</span>
                <input
                  type="text"
                  value={form.header.dateTraitement}
                  onChange={(e) => updateForm({ header: { ...form.header, dateTraitement: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none"
                  placeholder="02/10/2023"
                />
              </div>
              <div className="flex-1 flex items-center border-l border-gray-400 pl-3">
                <span className="font-bold mr-2">Responsable Traçabilité :</span>
                <input
                  type="text"
                  value={form.header.responsableTracabilite}
                  onChange={(e) => updateForm({ header: { ...form.header, responsableTracabilite: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                />
              </div>
            </div>

            {/* Product and type */}
            <div className="flex p-3 bg-green-100 items-center">
              <div className="flex-1">
                <span className="font-bold mr-2">Produit :</span>
                <input
                  type="text"
                  value={form.header.produit}
                  onChange={(e) => updateForm({ header: { ...form.header, produit: e.target.value } })}
                  className="border-0 bg-transparent focus:outline-none font-bold"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.header.conventionnel}
                    onChange={(e) => updateForm({ header: { ...form.header, conventionnel: e.target.checked } })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">CONVENTIONNEL</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.header.biologique}
                    onChange={(e) => updateForm({ header: { ...form.header, biologique: e.target.checked } })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">BIOLOGIQUE</span>
                </label>
              </div>
            </div>
          </div>

          {/* Table for waste data */}
          <div className="border-2 border-gray-400 mb-6">
            {/* Table header */}
            <div className="flex bg-green-100 border-b border-gray-400">
              <div className="w-32 p-2 border-r border-gray-400 text-center">
                <div className="text-sm font-bold">N° palette</div>
              </div>
              <div className="w-36 p-2 border-r border-gray-400 text-center">
                <div className="text-sm font-bold leading-tight">Nombre de<br/>caisses</div>
              </div>
              <div className="w-32 p-2 border-r border-gray-400 text-center">
                <div className="text-sm font-bold">Poids Brut</div>
              </div>
              <div className="w-32 p-2 border-r border-gray-400 text-center">
                <div className="text-sm font-bold">Poids Net</div>
              </div>
              <div className="w-40 p-2 border-r border-gray-400 text-center">
                <div className="text-sm font-bold leading-tight">Nature de<br/>déchet</div>
              </div>
              <div className="w-28 p-2 text-center">
                <div className="text-sm font-bold">Variété</div>
              </div>
            </div>

            {/* Table rows */}
            {form.rows.map((row, index) => (
              <div key={index} className="flex border-b border-gray-400 hover:bg-gray-50">
                <div className="w-32 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.numeroPalette}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, numeroPalette: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-36 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.nombreCaisses}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, nombreCaisses: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-32 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.poidsBrut}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, poidsBrut: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-32 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.poidsNet}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, poidsNet: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-40 border-r border-gray-400">
                  <input
                    type="text"
                    value={row.natureDechet}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, natureDechet: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="text"
                    value={row.variete}
                    onChange={(e) => {
                      const rows = [...form.rows];
                      rows[index] = { ...row, variete: e.target.value };
                      updateForm({ rows });
                    }}
                    className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={generatePDF} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all">
              <FilePlus size={20} /> Générer PDF
            </button>
            <button onClick={() => updateForm(defaultDechetForm())} className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all">
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
      
      {/* Archived waste forms */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl mt-6 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold">Archives - Fiches Déchets</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Les archives sont des copies figées de vos fiches déchets. Utilisez Archiver pour ajouter une nouvelle fiche ici.</p>
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
                          await dechetArchiveService.update(a.id, { lotNumber: name.trim() });
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
                  Dernière mise à jour: {a.updatedAt?.toDate ? (a.updatedAt as any).toDate().toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuiviDechets;
