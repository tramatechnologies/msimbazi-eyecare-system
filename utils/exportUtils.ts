/**
 * Export Utilities
 * Functions for exporting data to PDF, Excel, and CSV formats
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDate, getCurrentDate } from './dateTimeUtils';
import { addPDFHeader, addCSVHeader, HOSPITAL_NAME } from './documentHeader';

export interface ExportData {
  title: string;
  period?: string;
  dateRange?: { start: string; end: string };
  summary?: Array<{ label: string; value: string | number }>;
  tables?: Array<{
    title: string;
    headers: string[];
    rows: (string | number)[][];
  }>;
  metadata?: Record<string, string | number>;
}

/**
 * Export data to PDF format
 */
export const exportToPDF = async (data: ExportData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Add hospital header with logo
  let yPosition = await addPDFHeader(doc, pageWidth);
  
  // Add document title
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;

  // Add metadata
  if (data.period) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${data.period}`, 14, yPosition);
    yPosition += 6;
  }

  if (data.dateRange) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date Range: ${data.dateRange.start} to ${data.dateRange.end}`, 14, yPosition);
    yPosition += 6;
  }

  doc.text(`Generated: ${getCurrentDate()}`, 14, yPosition);
  yPosition += 10;

  // Add summary section
  if (data.summary && data.summary.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    data.summary.forEach((item, index) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setTextColor(60, 60, 60);
      doc.text(item.label + ':', 20, yPosition);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(String(item.value), pageWidth - 20, yPosition, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Add tables
  if (data.tables && data.tables.length > 0) {
    data.tables.forEach((table, tableIndex) => {
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      // Table title
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(table.title, 14, yPosition);
      yPosition += 8;

      // Generate table using jspdf-autotable
      (doc as any).autoTable({
        head: [table.headers],
        body: table.rows,
        startY: yPosition,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { 
          fillColor: [0, 102, 51], // Brand green
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    });
  }

  // Add footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${totalPages} | Generated on ${getCurrentDate()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `msimbazi-${data.title.toLowerCase().replace(/\s+/g, '-')}-${data.period || 'report'}-${getCurrentDate()}.pdf`;
  doc.save(filename);
};

/**
 * Export data to Excel format
 */
export const exportToExcel = (data: ExportData): void => {
  const workbook = XLSX.utils.book_new();

  // Create Summary sheet
  if (data.summary && data.summary.length > 0) {
    const summaryData = [
      [data.title],
      [],
      ['Report Information'],
      ['Period', data.period || 'N/A'],
      ['Date Range', data.dateRange ? `${data.dateRange.start} to ${data.dateRange.end}` : 'N/A'],
      ['Generated', getCurrentDate()],
      [],
      ['Summary'],
      ['Metric', 'Value'],
      ...data.summary.map(item => [item.label, item.value]),
    ];

    // Add hospital header to summary data
    const summaryDataWithHeader = [
      [HOSPITAL_NAME],
      ['Professional Eye Care Services'],
      [],
      ...summaryData,
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryDataWithHeader);
    
    // Style header rows
    if (!summarySheet['!merges']) {
      summarySheet['!merges'] = [];
    }
    summarySheet['!merges'].push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Hospital name
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }  // Tagline
    );
    
    // Set column widths
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }

  // Create table sheets
  if (data.tables && data.tables.length > 0) {
    data.tables.forEach((table, index) => {
      // Add hospital header to table data
      const tableData = [
        [HOSPITAL_NAME],
        ['Professional Eye Care Services'],
        [],
        [table.title],
        [],
        table.headers,
        ...table.rows,
      ];

      const tableSheet = XLSX.utils.aoa_to_sheet(tableData);
      
      // Merge header rows
      if (!tableSheet['!merges']) {
        tableSheet['!merges'] = [];
      }
      tableSheet['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: table.headers.length - 1 } }, // Hospital name
        { s: { r: 1, c: 0 }, e: { r: 1, c: table.headers.length - 1 } }, // Tagline
        { s: { r: 3, c: 0 }, e: { r: 3, c: table.headers.length - 1 } }  // Table title
      );
      
      // Set column widths (auto-size based on content)
      const colWidths = table.headers.map((_, colIndex) => {
        const maxLength = Math.max(
          table.headers[colIndex].length,
          ...table.rows.map(row => String(row[colIndex] || '').length)
        );
        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      tableSheet['!cols'] = colWidths;
      
      const sheetName = table.title.substring(0, 31) || `Table ${index + 1}`;
      XLSX.utils.book_append_sheet(workbook, tableSheet, sheetName);
    });
  }

  // Save Excel file
  const filename = `msimbazi-${data.title.toLowerCase().replace(/\s+/g, '-')}-${data.period || 'report'}-${getCurrentDate()}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

/**
 * Export data to CSV format
 */
export const exportToCSV = (data: ExportData): void => {
  const csvRows: string[] = [];

  // Add document title
  csvRows.push(data.title);
  csvRows.push('');

  // Add metadata
  if (data.period) {
    csvRows.push(`Period,${data.period}`);
  }
  if (data.dateRange) {
    csvRows.push(`Date Range,${data.dateRange.start} to ${data.dateRange.end}`);
  }
  csvRows.push(`Generated,${getCurrentDate()}`);
  csvRows.push('');

  // Add summary
  if (data.summary && data.summary.length > 0) {
    csvRows.push('Summary');
    csvRows.push('Metric,Value');
    data.summary.forEach(item => {
      csvRows.push(`${item.label},${item.value}`);
    });
    csvRows.push('');
  }

  // Add tables
  if (data.tables && data.tables.length > 0) {
    data.tables.forEach((table, index) => {
      if (index > 0) csvRows.push('');
      csvRows.push(table.title);
      csvRows.push(table.headers.join(','));
      table.rows.forEach(row => {
        csvRows.push(row.map(cell => {
          // Escape commas and quotes in CSV
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','));
      });
    });
  }

  // Add hospital header and create CSV
  const csvWithHeader = addCSVHeader(csvRows);
  const csvContent = csvWithHeader.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `msimbazi-${data.title.toLowerCase().replace(/\s+/g, '-')}-${data.period || 'report'}-${getCurrentDate()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Helper function to format currency
 */
export const formatCurrency = (amount: number): string => {
  return `TZS ${amount.toLocaleString()}`;
};

/**
 * Helper function to format percentage
 */
export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
};
