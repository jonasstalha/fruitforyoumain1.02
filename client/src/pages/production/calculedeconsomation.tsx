import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}
import logo from "../../../assets/logo.png"; // Adjust the path to your logo image
// Define the logo variable with a placeholder path or base64 string

type ReportData = {
  date: string;
  employee: string;
  notes?: string;
  entrants: number;
  emballes: number;
  dechets: number;
  pertes: number;
  tauxDechets: string;
  tauxPertes: string;
};

const calculedeconsomation = () => {
  const { register, handleSubmit, reset } = useForm();
  const [result, setResult] = useState<ReportData | null>(null);

  const onSubmit = (data) => {
    const entrants = parseFloat(data.entrants);
    const emballes = parseFloat(data.emballes);
    const dechets = parseFloat(data.dechets);

    const pertes = entrants - emballes - dechets;
    const tauxDechets = ((dechets / entrants) * 100).toFixed(2);
    const tauxPertes = ((pertes / entrants) * 100).toFixed(2);

    const final: ReportData = {
      ...data,
      pertes,
      tauxDechets,
      tauxPertes,
    };

    setResult(final);
  };

  const generatePDF = () => {
    if (!result) return;
    
    // Create new document with better page formatting
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true
    });
  
    // Set document properties
    doc.setProperties({
      title: `Rapport Journalier - ${result.date}`,
      subject: 'Rapport de Production d\'Avocats',
      author: 'Fruit For You',
      creator: 'Système de Gestion'
    });
  
    // Document styling constants
    const colors = {
      primary: [39, 174, 96],       // Green for header
      secondary: [41, 128, 185],    // Blue for subheadings
      text: [44, 62, 80],           // Dark blue-gray for text
      light: [236, 240, 241]        // Light gray for backgrounds
    };
    
    // Add logo image (replace with actual logo path or base64 string)
    doc.addImage(logo, "PNG", 20, 15, 15, 15);
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(...colors.primary);
    doc.setFont("helvetica", "bold");
    doc.text("Rapport Journalier", 45, 25);
    
    doc.setFontSize(16);
    doc.text("Usine de Traitement d'Avocats", 45, 32);
    
    // Add horizontal separator
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);
    
    // Company information in a styled box
    doc.setFillColor(...colors.light);
    doc.roundedRect(20, 43, 170, 25, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(...colors.text);
    doc.setFont("helvetica", "bold");
    doc.text("Entreprise:", 25, 50);
    doc.text("Adresse:", 25, 56);
    doc.text("Date de génération:", 25, 62);
    
    doc.setFont("helvetica", "normal");
    doc.text("Fruit For You", 60, 50);
    doc.text("Morocco, Kenitra, Birami", 60, 56);
    doc.text(new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }), 60, 62);
    
    // Report details section
    doc.setFillColor(...colors.secondary);
    doc.rect(20, 75, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DÉTAILS DU RAPPORT", 105, 80, { align: 'center' });
    
    // Report attributes with icons
    doc.setTextColor(...colors.text);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    
    doc.text("  Date:", 25, 95);
    doc.text("  Employé:", 25, 103);
    doc.text("  Notes:", 25, 111);
    
    doc.setFont("helvetica", "normal");
    doc.text(result.date, 60, 95);
    doc.text(result.employee, 60, 103);
    
    // Handle multiline notes
    const splitNotes = doc.splitTextToSize(result.notes || "Aucune note fournie", 130);
    doc.text(splitNotes, 60, 111);
    
    // Production data section title
    doc.setFillColor(...colors.secondary);
    doc.rect(20, 125, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DONNÉES DE PRODUCTION", 105, 130, { align: 'center' });
    
    // Data table
    autoTable(doc, {
      startY: 140,
      head: [['Description', 'Quantité (kg)']],
      body: [
        ['Avocats entrants', `${result.entrants} kg`],
        ['Avocats emballés', `${result.emballes} kg`],
        ['Déchets', `${result.dechets} kg`],
        ['Pertes inconnues', `${result.pertes.toFixed(2)} kg`],
      ],
      theme: 'grid',
      headStyles: { 
        fillColor: colors.primary,
        textColor: 255, 
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: { 
        fontSize: 11, 
        textColor: colors.text,
        lineWidth: 0.1,
        lineColor: [220, 220, 220]
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249]
      },
      margin: { top: 10, left: 20, right: 20 },
      styles: {
        overflow: 'linebreak',
        cellPadding: 5,
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' }
      }
    });
    
    // Add key metrics in visual boxes
    const metricsY = doc.lastAutoTable.finalY + 15;
    
    // Waste rate box
    doc.setFillColor(...colors.light);
    doc.roundedRect(20, metricsY, 80, 35, 3, 3, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.secondary);
    doc.setFontSize(12);
    doc.text("TAUX DE DÉCHETS", 60, metricsY + 10, { align: 'center' });
    
    doc.setTextColor(...colors.primary);
    doc.setFontSize(20);
    doc.text(`${result.tauxDechets}%`, 60, metricsY + 25, { align: 'center' });
    
    // Loss rate box
    doc.setFillColor(...colors.light);
    doc.roundedRect(110, metricsY, 80, 35, 3, 3, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.secondary);
    doc.setFontSize(12);
    doc.text("TAUX DE PERTES", 150, metricsY + 10, { align: 'center' });
    
    doc.setTextColor(...colors.primary);
    doc.setFontSize(20);
    doc.text(`${result.tauxPertes}%`, 150, metricsY + 25, { align: 'center' });
    
    // Signature section
    const signatureY = metricsY + 50;
    doc.setDrawColor(...colors.text);
    doc.setLineWidth(0.2);
    
    doc.setTextColor(...colors.text);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Signature du Responsable:", 20, signatureY);
    
    doc.line(20, signatureY + 15, 80, signatureY + 15);
    
    
    doc.line(100, signatureY + 15, 160, signatureY + 15);
    
    // Footer
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.line(20, 270, 190, 270);
    
    doc.setFontSize(8);
    doc.setTextColor(...colors.text);
    doc.setFont("helvetica", "italic");
    doc.text("Fruit For You - Rapport généré automatiquement", 105, 275, { align: 'center' });
    doc.text("Ce document est confidentiel et à usage interne uniquement", 105, 280, { align: 'center' });
    
    // Page numbering
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...colors.text);
      doc.text(`Page ${i} sur ${pageCount}`, 190, 287, { align: 'right' });
    }
    
    // Save the PDF with a well-formatted name
    const formattedDate = result.date.replace(/\//g, '-');
    doc.save(`Rapport_Production_Avocats_${formattedDate}.pdf`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-lg space-y-6">
      <h2 className="text-2xl font-extrabold text-center text-gray-800">Formulaire de Rapport Journalier</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="date" {...register("date")} required className="input border border-gray-300 rounded-lg p-2" />
          <input type="text" placeholder="Employé" {...register("employee")} required className="input border border-gray-300 rounded-lg p-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="number" step="0.01" placeholder="Avocats entrants (kg)" {...register("entrants")} required className="input border border-gray-300 rounded-lg p-2" />
          <input type="number" step="0.01" placeholder="Avocats emballés (kg)" {...register("emballes")} required className="input border border-gray-300 rounded-lg p-2" />
          <input type="number" step="0.01" placeholder="Déchets (kg)" {...register("dechets")} required className="input border border-gray-300 rounded-lg p-2" />
        </div>
        <textarea placeholder="Notes" {...register("notes")} className="input border border-gray-300 rounded-lg p-2 w-full" />

        <div className="flex justify-between items-center">
          <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg shadow">Calculer</button>
          <button type="button" onClick={() => reset()} className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg shadow">Réinitialiser</button>
        </div>
      </form>

      {result && (
        <div className="mt-6 border-t pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Résultats</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p><strong>Pertes:</strong> {result.pertes.toFixed(2)} kg</p>
            <p><strong>% Déchets:</strong> {result.tauxDechets}%</p>
            <p><strong>% Pertes:</strong> {result.tauxPertes}%</p>
          </div>
          <button onClick={generatePDF} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow">Générer PDF</button>
        </div>
      )}
    </div>
  );
};

export default calculedeconsomation;
