import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus, Package, Plus, RefreshCw, Save, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useSharedLots } from '@/hooks/useSharedLots';
import { SharedLot } from '@/lib/sharedLotService';

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

  const createNewLot = async () => {
    const form = defaultReceptionForm();
    const lotNumber = `Réception ${receptionLots.length + 1}`;
    const newId = await addLot({
      lotNumber,
      status: 'brouillon',
      type: 'reception',
      receptionData: form
    });
    setCurrentLotId(newId);
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

  const generatePDF = async () => {
    const form = getCurrentForm();
    const lot = getCurrentLot();
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = 210;
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;

  const colors = {
      primary: [46, 125, 50],
      headerBg: [200, 230, 201],
      tableBg: [232, 245, 233],
      border: [224, 224, 224],
      text: [33, 33, 33],
      lightText: [97, 97, 97]
  } as const;

    const drawRect = (x: number, y: number, w: number, h: number, fill?: readonly number[]) => {
      if (fill) doc.setFillColor(fill[0] as number, fill[1] as number, fill[2] as number);
      doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      doc.rect(x, y, w, h, fill ? 'FD' : 'S');
    };
    const drawText = (t: string, x: number, y: number, s: number, bold = false) => {
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(s);
      doc.text(t, x, y);
    };

    // Header
    let y = margin;
    drawRect(margin, y, contentWidth, 30, colors.headerBg);
    drawText('SUIVI RECEPTION', margin + 4, y + 10, 16, true);
    drawText('SMQ.ENR 24', margin + contentWidth - 60, y + 8, 9, true);
    drawText('Date: 01/07/2023', margin + contentWidth - 60, y + 14, 8);
    drawText('Version: 01', margin + contentWidth - 60, y + 20, 8);

    y += 34;

    // Top fields
    drawRect(margin, y, contentWidth, 20);
    drawText(`Date: ${form.header.date || ''}`, margin + 4, y + 7, 9, true);
    drawText(`Responsable: ${form.header.responsable || ''}`, margin + contentWidth / 3, y + 7, 9, true);
    drawText(`Compagne: ${form.header.compagne || ''}`, margin + (2 * contentWidth) / 3, y + 7, 9, true);

    drawText(`N° BON DE LIVRISON : ${form.header.bonLivraison || ''}`, margin + 4, y + 15, 8);
    drawText(`N° BON DE RECEPTION : ${form.header.bonReception || ''}`, margin + contentWidth / 2, y + 15, 8);

    y += 24;

    drawRect(margin, y, contentWidth, 10, colors.tableBg);
    drawText('PRODUIT : AVOCAT', margin + 4, y + 7, 9, true);
    drawText('CONVENTIONNEL', margin + contentWidth / 2, y + 7, 8, form.header.conventionnel);
    drawText('BIOLOGIQUE', margin + (contentWidth / 2) + 40, y + 7, 8, form.header.biologique);

    y += 14;

    // Table header
    const headers = ['N° PALETTE', 'NR CAISSE', 'TARE PALETTE', 'POIDS BRUT (kg)', 'POIDS NET (kg)', 'VARIETE', 'N°DE LOT INTERN', 'DECISION'];
    const widths = [20, 22, 25, 28, 26, 20, 25, 24];

    drawRect(margin, y, contentWidth, 10, colors.tableBg);
    let x = margin;
    headers.forEach((h, idx) => {
      doc.line(x, y, x, y + 10);
      drawText(h, x + 2, y + 7, 7, true);
      x += widths[idx];
    });
    doc.line(margin + contentWidth, y, margin + contentWidth, y + 10);
    y += 10;

    // Rows (up to 20)
    const formRows = getCurrentForm().rows;
    for (let i = 0; i < formRows.length; i++) {
      const row = formRows[i];
      drawRect(margin, y, contentWidth, 8);
      let cx = margin + 2;
      const vals = [row.numeroPalette, row.nrCaisse, row.tarePalette, row.poidsBrut, row.poidsNet, row.variete, row.numeroLotInterne, row.decision];
      for (let j = 0; j < headers.length; j++) {
        drawText(vals[j] || '', cx, y + 5.5, 7);
        cx += widths[j];
      }
      y += 8;
    }

    // Totals/Footer
    y += 2;
    const totals = calculateTotals();
    drawRect(margin, y, contentWidth, 10, colors.tableBg);
    drawText('TOTALE', margin + 4, y + 7, 9, true);
    drawText(`POIDS BRUT: ${totals.totalBrut.toFixed(2)} kg`, margin + contentWidth / 2, y + 7, 8);
    drawText(`POIDS NET: ${totals.totalNet.toFixed(2)} kg`, margin + (contentWidth / 2) + 45, y + 7, 8);

    y += 14;
    drawRect(margin, y, contentWidth, 12);
    drawText(`POIDS TICKET: ${form.footer.poidsTicket || ''}`, margin + 4, y + 8, 9, true);
    drawText(`POIDS USINE: ${form.footer.poidsUsine || ''}`, margin + contentWidth / 2, y + 8, 9, true);
    drawText(`ECART: ${form.footer.ecart || ''}`, margin + (contentWidth / 2) + 50, y + 8, 9, true);

    const file = `Suivi_Reception_${(getCurrentLot()?.lotNumber || 'Lot').replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(file);
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
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl p-6">
        {/* Header and Controls */}
        <div className="bg-white border-b p-4 shadow-sm mb-6">
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

        {/* Form header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={form.header.date} onChange={(e) => updateForm({ header: { ...form.header, date: e.target.value } })} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <input type="text" value={form.header.responsable} onChange={(e) => updateForm({ header: { ...form.header, responsable: e.target.value } })} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all" />
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compagne</label>
              <input type="text" value={form.header.compagne} onChange={(e) => updateForm({ header: { ...form.header, compagne: e.target.value } })} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
              <input type="text" value={form.header.produit} onChange={(e) => updateForm({ header: { ...form.header, produit: e.target.value } })} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all" />
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-3">Type</label>
            <div className="space-y-2">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={form.header.conventionnel} onChange={(e) => updateForm({ header: { ...form.header, conventionnel: e.target.checked } })} className="form-checkbox text-green-600 focus:ring-green-500 h-4 w-4" />
                <span className="ml-2">CONVENTIONNEL</span>
              </label>
              <label className="inline-flex items-center">
                <input type="checkbox" checked={form.header.biologique} onChange={(e) => updateForm({ header: { ...form.header, biologique: e.target.checked } })} className="form-checkbox text-green-600 focus:ring-green-500 h-4 w-4" />
                <span className="ml-2">BIOLOGIQUE</span>
              </label>
            </div>
          </div>
        </div>

        {/* Bon numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1">N° BON DE LIVRISON</label>
            <input type="text" value={form.header.bonLivraison} onChange={(e) => updateForm({ header: { ...form.header, bonLivraison: e.target.value } })} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all" />
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1">N° BON DE RECEPTION</label>
            <input type="text" value={form.header.bonReception} onChange={(e) => updateForm({ header: { ...form.header, bonReception: e.target.value } })} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">N° PALETTE</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">NR CAISSE</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">TARE PALETTE</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">POIDS BRUT (kg)</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">POIDS NET (kg)</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">VARIETE</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">N°DE LOT INTERN</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DECISION</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentForm().rows.map((row, idx) => (
                  <tr key={idx} className={`${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-green-50`}>
                    <td className="px-3 py-2 border-r">
                      <input type="text" value={row.numeroPalette} onChange={(e) => {
                        const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, numeroPalette: e.target.value }; updateForm({ rows });
                      }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input type="text" value={row.nrCaisse} onChange={(e) => { const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, nrCaisse: e.target.value }; updateForm({ rows }); }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input type="text" value={row.tarePalette} onChange={(e) => { const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, tarePalette: e.target.value }; updateForm({ rows }); }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input type="number" value={row.poidsBrut} onChange={(e) => { const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, poidsBrut: e.target.value }; updateForm({ rows }); }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input type="number" value={row.poidsNet} onChange={(e) => { const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, poidsNet: e.target.value }; updateForm({ rows }); }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input type="text" value={row.variete} onChange={(e) => { const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, variete: e.target.value }; updateForm({ rows }); }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input type="text" value={row.numeroLotInterne} onChange={(e) => { const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, numeroLotInterne: e.target.value }; updateForm({ rows }); }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={row.decision} onChange={(e) => { const rows = [...getCurrentForm().rows]; rows[idx] = { ...row, decision: e.target.value }; updateForm({ rows }); }} className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Totaux</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">TOTAL POIDS BRUT:</span>
                <span className="text-lg font-bold text-blue-600">{calculateTotals().totalBrut.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">POIDS NET:</span>
                <span className="text-lg font-bold text-blue-600">{calculateTotals().totalNet.toFixed(2)} Kg</span>
              </div>
            </div>
          </div>
          <div className="p-6 bg-green-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Poids & Ecart</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">POIDS TICKET</label>
                <input type="text" value={form.footer.poidsTicket} onChange={(e) => updateForm({ footer: { ...form.footer, poidsTicket: e.target.value } })} className="w-full p-2 rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">POIDS USINE</label>
                <input type="text" value={form.footer.poidsUsine} onChange={(e) => updateForm({ footer: { ...form.footer, poidsUsine: e.target.value } })} className="w-full p-2 rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ECART</label>
                <input type="text" value={form.footer.ecart} onChange={(e) => updateForm({ footer: { ...form.footer, ecart: e.target.value } })} className="w-full p-2 rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={generatePDF} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all">
            <FilePlus size={20} /> Générer PDF
          </button>
          <button onClick={() => updateForm(defaultReceptionForm())} className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all">
            <RefreshCw size={20} /> Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuiviReception;
