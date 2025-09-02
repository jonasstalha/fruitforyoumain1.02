import { jsPDF } from 'jspdf';
import { QualityRapport } from './qualityControlService';

// Add image to PDF with proper scaling
const addImageToPDF = (doc: jsPDF, imageData: string, x: number, y: number, width: number, height: number) => {
  try {
    doc.addImage(imageData, 'JPEG', x, y, width, height);
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    // Add a placeholder rectangle if image fails to load
    doc.rect(x, y, width, height);
    doc.text('Image unavailable', x + width/2, y + height/2, { align: 'center' });
  }
};

// Convert image URL to base64 for PDF
const imageUrlToBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/jpeg', 0.7);
      resolve(dataURL);
    };
    img.onerror = reject;
    img.src = url;
  });
};

// Generate comprehensive quality rapport PDF
export const generateQualityRapportPDF = async (rapport: QualityRapport): Promise<Blob> => {
  const doc = new jsPDF();
  let yPosition = 20;

  // Header
  doc.setFontSize(20);
  doc.text('Rapport de Contrôle Qualité', 105, yPosition, { align: 'center' });
  yPosition += 20;

  // Basic Information
  doc.setFontSize(14);
  doc.text('Informations Générales', 20, yPosition);
  yPosition += 10;

  doc.setFontSize(12);
  doc.text(`Numéro de Lot: ${rapport.lotNumber}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Date: ${new Date(rapport.date).toLocaleDateString('fr-FR')}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Contrôleur: ${rapport.controller}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Numéro de Palette: ${rapport.palletNumber}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Calibres: ${rapport.calibres.join(', ')}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Statut: ${rapport.status}`, 20, yPosition);
  yPosition += 15;

  // Process each calibre
  for (const calibre of rapport.calibres) {
    const calibreImages = rapport.images[calibre] || [];
    const calibreResults = rapport.testResults[calibre] || {};

    // Add new page if needed
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Calibre header
    doc.setFontSize(16);
    doc.text(`Calibre: ${calibre}`, 20, yPosition);
    yPosition += 15;

    // Test results
    doc.setFontSize(12);
    doc.text('Résultats des Tests:', 20, yPosition);
    yPosition += 10;

    if (calibreResults.poids) {
      doc.text(`Poids: ${calibreResults.poids}g`, 30, yPosition);
      yPosition += 7;
    }
    if (calibreResults.firmness) {
      doc.text(`Fermeté: ${calibreResults.firmness}`, 30, yPosition);
      yPosition += 7;
    }
    if (calibreResults.color) {
      doc.text(`Couleur: ${calibreResults.color}`, 30, yPosition);
      yPosition += 7;
    }
    if (calibreResults.defects) {
      doc.text(`Défauts: ${calibreResults.defects}`, 30, yPosition);
      yPosition += 7;
    }
    if (calibreResults.notes) {
      doc.text(`Notes: ${calibreResults.notes}`, 30, yPosition);
      yPosition += 7;
    }

    yPosition += 10;

    // Add images if available
    if (calibreImages.length > 0) {
      doc.text(`Images (${calibreImages.length})`, 20, yPosition);
      yPosition += 10;

      // Calculate image layout (3 columns max)
      const imageWidth = 50;
      const imageHeight = 40;
      const imagesPerRow = 3;
      const marginX = 20;
      const spacingX = 10;

      for (let i = 0; i < Math.min(calibreImages.length, 12); i++) {
        const row = Math.floor(i / imagesPerRow);
        const col = i % imagesPerRow;
        
        const x = marginX + col * (imageWidth + spacingX);
        const y = yPosition + row * (imageHeight + 10);

        try {
          const imageData = await imageUrlToBase64(calibreImages[i]);
          addImageToPDF(doc, imageData, x, y, imageWidth, imageHeight);
          
          // Add image number
          doc.setFontSize(8);
          doc.text(`${i + 1}`, x + 2, y + imageHeight - 2);
          doc.setFontSize(12);
        } catch (error) {
          console.error('Error processing image:', error);
          doc.rect(x, y, imageWidth, imageHeight);
          doc.text('Image indisponible', x + imageWidth/2, y + imageHeight/2, { align: 'center' });
        }
      }

      // Update yPosition based on number of image rows
      const imageRows = Math.ceil(Math.min(calibreImages.length, 12) / imagesPerRow);
      yPosition += imageRows * (imageHeight + 10) + 10;
    }

    yPosition += 10;

    // Add page break between calibres if needed
    if (yPosition > 200 && calibre !== rapport.calibres[rapport.calibres.length - 1]) {
      doc.addPage();
      yPosition = 20;
    }
  }

  // Footer
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(10);
  doc.text('Généré le: ' + new Date().toLocaleDateString('fr-FR'), 20, yPosition);
  if (rapport.submittedAt) {
    yPosition += 5;
    doc.text('Soumis le: ' + new Date(rapport.submittedAt).toLocaleDateString('fr-FR'), 20, yPosition);
  }

  return doc.output('blob');
};

// Generate summary PDF with visual report
export const generateVisualRapportPDF = async (rapport: QualityRapport): Promise<Blob> => {
  const doc = new jsPDF();
  let yPosition = 20;

  // Title
  doc.setFontSize(18);
  doc.text('Rapport Visuel de Contrôle Qualité', 105, yPosition, { align: 'center' });
  yPosition += 20;

  // Basic info
  doc.setFontSize(12);
  doc.text(`Lot: ${rapport.lotNumber} | Date: ${new Date(rapport.date).toLocaleDateString('fr-FR')}`, 20, yPosition);
  yPosition += 10;
  doc.text(`Contrôleur: ${rapport.controller} | Palette: ${rapport.palletNumber}`, 20, yPosition);
  yPosition += 20;

  // Create visual grid for each calibre
  for (const calibre of rapport.calibres) {
    const calibreImages = rapport.images[calibre] || [];
    const calibreResults = rapport.testResults[calibre] || {};

    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    // Calibre section
    doc.setFontSize(14);
    doc.text(`Calibre ${calibre}`, 20, yPosition);
    yPosition += 15;

    // Test results summary
    doc.setFontSize(10);
    const resultsText = [
      calibreResults.poids ? `Poids: ${calibreResults.poids}g` : '',
      calibreResults.firmness ? `Fermeté: ${calibreResults.firmness}` : '',
      calibreResults.color ? `Couleur: ${calibreResults.color}` : ''
    ].filter(Boolean).join(' | ');
    
    if (resultsText) {
      doc.text(resultsText, 20, yPosition);
      yPosition += 10;
    }

    // Image grid (4x3 layout)
    const imageWidth = 35;
    const imageHeight = 28;
    const imagesPerRow = 4;
    const marginX = 20;
    const spacingX = 8;

    for (let i = 0; i < Math.min(calibreImages.length, 12); i++) {
      const row = Math.floor(i / imagesPerRow);
      const col = i % imagesPerRow;
      
      const x = marginX + col * (imageWidth + spacingX);
      const y = yPosition + row * (imageHeight + 5);

      try {
        const imageData = await imageUrlToBase64(calibreImages[i]);
        addImageToPDF(doc, imageData, x, y, imageWidth, imageHeight);
        
        // Add image number
        doc.setFontSize(8);
        doc.text(`${i + 1}`, x + 1, y + imageHeight - 1);
      } catch (error) {
        doc.rect(x, y, imageWidth, imageHeight);
        doc.setFontSize(8);
        doc.text('N/A', x + imageWidth/2, y + imageHeight/2, { align: 'center' });
      }
    }

    const imageRows = Math.ceil(Math.min(calibreImages.length, 12) / imagesPerRow);
    yPosition += imageRows * (imageHeight + 5) + 15;
  }

  // Footer
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(8);
  doc.text('Rapport généré automatiquement - ' + new Date().toLocaleDateString('fr-FR'), 105, yPosition, { align: 'center' });

  return doc.output('blob');
};

// Save PDF to Firebase Storage
export const uploadPDFToStorage = async (pdfBlob: Blob, fileName: string): Promise<string> => {
  try {
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { storage } = await import('./firebase');
    
    const pdfRef = ref(storage, `rapports/pdfs/${fileName}`);
    await uploadBytes(pdfRef, pdfBlob);
    return await getDownloadURL(pdfRef);
  } catch (error) {
    console.error('Error uploading PDF to storage:', error);
    throw error;
  }
};

// Download PDF file
export const downloadPDF = (pdfBlob: Blob, fileName: string) => {
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
