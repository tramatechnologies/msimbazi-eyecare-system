/**
 * Document Header Utilities
 * Functions for adding hospital name and logo to all exported documents
 */

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export const HOSPITAL_NAME = 'MSIMBAZI EYE CARE';
export const HOSPITAL_TAGLINE = 'Professional Eye Care Services';

/**
 * Add hospital header with logo to PDF document
 * @param doc - jsPDF document instance
 * @param pageWidth - Page width
 * @returns yPosition after header
 */
export const addPDFHeader = async (doc: jsPDF, pageWidth: number): Promise<number> => {
  let yPosition = 15;

  try {
    // Try to load logo from assets
    const logoPath = '/src/assets/Msimbazi Logo.jpg';
    
    // For browser environment, we'll use a base64 approach or load from public folder
    // Since we can't directly access file system, we'll create a styled header
    // In production, you'd convert the logo to base64 and embed it
    
    // Create a styled header box
    doc.setFillColor(0, 102, 51); // Brand green
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Hospital name - centered and bold
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255); // White text
    doc.setFont('helvetica', 'bold');
    doc.text(HOSPITAL_NAME, pageWidth / 2, 22, { align: 'center' });
    
    // Tagline
    yPosition = 28;
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text(HOSPITAL_TAGLINE, pageWidth / 2, yPosition, { align: 'center' });
    
    // Reset text color for content
    doc.setTextColor(0, 0, 0);
    
    // Add spacing after header
    yPosition = 45;
    
    return yPosition;
  } catch (error) {
    console.warn('Could not load logo, using text-only header:', error);
    
    // Fallback: Text-only header
    doc.setFontSize(20);
    doc.setTextColor(0, 102, 51); // Brand green
    doc.setFont('helvetica', 'bold');
    doc.text(HOSPITAL_NAME, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 8;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(HOSPITAL_TAGLINE, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;
    return yPosition;
  }
};

/**
 * Add hospital header to Excel workbook
 * @param workbook - XLSX workbook
 * @param sheetName - Name of the sheet to add header to
 */
export const addExcelHeader = (workbook: XLSX.WorkBook, sheetName: string): void => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;

  // Insert header rows at the beginning
  const headerData = [
    [HOSPITAL_NAME],
    [HOSPITAL_TAGLINE],
    [], // Empty row
  ];

  // Get existing data
  const existingData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  // Combine header with existing data
  const newData = [...headerData, ...existingData];
  
  // Create new sheet with header
  const newSheet = XLSX.utils.aoa_to_sheet(newData);
  
  // Merge header cells
  if (!newSheet['!merges']) {
    newSheet['!merges'] = [];
  }
  
  // Merge hospital name row (assuming first column spans all columns)
  const maxCol = newData[0] ? newData[0].length : 1;
  newSheet['!merges'].push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: maxCol - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: maxCol - 1 } }
  );
  
  // Set column widths
  if (!newSheet['!cols']) {
    newSheet['!cols'] = [];
  }
  
  // Update workbook
  workbook.Sheets[sheetName] = newSheet;
};

/**
 * Add hospital header to CSV content
 * @param csvRows - Array of CSV row strings
 * @returns CSV rows with header prepended
 */
export const addCSVHeader = (csvRows: string[]): string[] => {
  return [
    HOSPITAL_NAME,
    HOSPITAL_TAGLINE,
    '', // Empty row
    ...csvRows,
  ];
};

/**
 * Load logo as base64 (for future use when logo is available as base64)
 * This function can be used when you have the logo converted to base64
 */
export const loadLogoBase64 = async (): Promise<string | null> => {
  try {
    // In production, you would:
    // 1. Convert the logo image to base64
    // 2. Store it as a constant or load from a config
    // 3. Return the base64 string
    
    // Example:
    // return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';
    
    return null; // Return null if logo not available
  } catch (error) {
    console.warn('Could not load logo:', error);
    return null;
  }
};
