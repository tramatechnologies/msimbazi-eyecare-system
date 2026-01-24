/**
 * Invoice and Receipt Generation Utilities
 * Functions for generating PDF invoices and receipts for cash clients
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Patient, BillItem, InsuranceType } from '../types';
import { calculateBillTotal, calculateInsuranceCoverage } from './patientUtils';
import { formatDate, formatTime, getCurrentDate } from './dateTimeUtils';
import { addPDFHeader, HOSPITAL_NAME } from './documentHeader';

/**
 * Generate Invoice PDF for cash clients
 */
export const generateInvoicePDF = async (patient: Patient): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Add hospital header with logo
  let yPosition = await addPDFHeader(doc, pageWidth);

  // Invoice Title
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 10;

  // Invoice Details
  const invoiceNumber = `INV-${patient.id}-${new Date().getFullYear()}`;
  const invoiceDate = formatDate(getCurrentDate());
  const currentTime = formatTime(new Date().toTimeString().substring(0, 5));

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  
  // Left side - Patient Info
  doc.text('Bill To:', 20, yPosition);
  doc.setFont('helvetica', 'bold');
  doc.text(patient.name, 20, yPosition + 6);
  doc.setFont('helvetica', 'normal');
  if (patient.phone) {
    doc.text(`Phone: ${patient.phone}`, 20, yPosition + 12);
  }
  if (patient.address) {
    doc.text(`Address: ${patient.address}`, 20, yPosition + 18);
  }
  doc.text(`Patient ID: ${patient.id}`, 20, yPosition + 24);

  // Right side - Invoice Info
  doc.text('Invoice Number:', pageWidth - 20, yPosition, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceNumber, pageWidth - 20, yPosition + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${invoiceDate}`, pageWidth - 20, yPosition + 12, { align: 'right' });
  doc.text(`Time: ${currentTime}`, pageWidth - 20, yPosition + 18, { align: 'right' });
  doc.text(`Payment Type: ${patient.insuranceType}`, pageWidth - 20, yPosition + 24, { align: 'right' });

  yPosition += 35;

  // Bill Items Table
  if (patient.billItems && patient.billItems.length > 0) {
    const tableData = patient.billItems.map((item, index) => [
      String(index + 1),
      item.description || item.name || 'Service',
      item.category || 'GENERAL',
      `TZS ${item.amount.toLocaleString()}`,
    ]);

    (doc as any).autoTable({
      head: [['#', 'Description', 'Category', 'Amount (TZS)']],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { 
        fillColor: [0, 102, 51], // Brand green
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 80 },
        2: { cellWidth: 40 },
        3: { cellWidth: 35, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 20;
    yPosition = finalY + 10;
  }

  // Totals Section
  const grossTotal = calculateBillTotal(patient.billItems);
  const insuranceCoverage = calculateInsuranceCoverage(patient);
  const netTotal = grossTotal - insuranceCoverage;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Gross Total
  doc.text('Gross Total:', pageWidth - 60, yPosition, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`TZS ${grossTotal.toLocaleString()}`, pageWidth - 20, yPosition, { align: 'right' });
  
  yPosition += 7;
  
  // Insurance Coverage (if applicable)
  if (insuranceCoverage > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 150, 0);
    doc.text('Insurance Coverage:', pageWidth - 60, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`- TZS ${insuranceCoverage.toLocaleString()}`, pageWidth - 20, yPosition, { align: 'right' });
    yPosition += 7;
  }
  
  // Net Total
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text('Net Amount Due:', pageWidth - 60, yPosition, { align: 'right' });
  doc.setFontSize(14);
  doc.text(`TZS ${netTotal.toLocaleString()}`, pageWidth - 20, yPosition, { align: 'right' });

  yPosition += 15;

  // Payment Terms
  if (patient.insuranceType === InsuranceType.CASH) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Payment Terms: Cash payment required at time of service', 20, yPosition);
    yPosition += 6;
    doc.text('Thank you for choosing MSIMBAZI EYE CARE', 20, yPosition);
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Insurance: ${patient.insuranceType}`, 20, yPosition);
    if (patient.insuranceNumber) {
      yPosition += 6;
      doc.text(`Insurance Number: ${patient.insuranceNumber}`, 20, yPosition);
    }
  }

  // Footer
  yPosition = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('This is a computer-generated invoice. No signature required.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text('For inquiries, please contact MSIMBAZI EYE CARE', pageWidth / 2, yPosition, { align: 'center' });

  // Save PDF
  const filename = `Invoice-${invoiceNumber}-${getCurrentDate()}.pdf`;
  doc.save(filename);
};

/**
 * Generate Receipt PDF after payment is processed
 */
export const generateReceiptPDF = async (patient: Patient, paymentMethod: string = 'Cash'): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Add hospital header with logo
  let yPosition = await addPDFHeader(doc, pageWidth);

  // Receipt Title
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 10;

  // Receipt Details
  const receiptNumber = `RCP-${patient.id}-${Date.now().toString().slice(-6)}`;
  const receiptDate = formatDate(getCurrentDate());
  const currentTime = formatTime(new Date().toTimeString().substring(0, 5));

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  
  // Left side - Patient Info
  doc.text('Received From:', 20, yPosition);
  doc.setFont('helvetica', 'bold');
  doc.text(patient.name, 20, yPosition + 6);
  doc.setFont('helvetica', 'normal');
  if (patient.phone) {
    doc.text(`Phone: ${patient.phone}`, 20, yPosition + 12);
  }
  doc.text(`Patient ID: ${patient.id}`, 20, yPosition + 18);

  // Right side - Receipt Info
  doc.text('Receipt Number:', pageWidth - 20, yPosition, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(receiptNumber, pageWidth - 20, yPosition + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${receiptDate}`, pageWidth - 20, yPosition + 12, { align: 'right' });
  doc.text(`Time: ${currentTime}`, pageWidth - 20, yPosition + 18, { align: 'right' });
  doc.text(`Payment Method: ${paymentMethod}`, pageWidth - 20, yPosition + 24, { align: 'right' });

  yPosition += 35;

  // Services Rendered Table
  if (patient.billItems && patient.billItems.length > 0) {
    const tableData = patient.billItems.map((item, index) => [
      String(index + 1),
      item.description || item.name || 'Service',
      item.category || 'GENERAL',
      `TZS ${item.amount.toLocaleString()}`,
    ]);

    (doc as any).autoTable({
      head: [['#', 'Service Description', 'Category', 'Amount (TZS)']],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { 
        fillColor: [0, 102, 51], // Brand green
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 80 },
        2: { cellWidth: 40 },
        3: { cellWidth: 35, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 20;
    yPosition = finalY + 10;
  }

  // Payment Summary
  const grossTotal = calculateBillTotal(patient.billItems);
  const insuranceCoverage = calculateInsuranceCoverage(patient);
  const netTotal = grossTotal - insuranceCoverage;
  const amountPaid = netTotal; // For cash clients, amount paid equals net total

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Gross Total
  doc.text('Total Services:', pageWidth - 60, yPosition, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`TZS ${grossTotal.toLocaleString()}`, pageWidth - 20, yPosition, { align: 'right' });
  
  yPosition += 7;
  
  // Insurance Coverage (if applicable)
  if (insuranceCoverage > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 150, 0);
    doc.text('Insurance Coverage:', pageWidth - 60, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`- TZS ${insuranceCoverage.toLocaleString()}`, pageWidth - 20, yPosition, { align: 'right' });
    yPosition += 7;
  }
  
  // Amount Paid
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text('Amount Paid:', pageWidth - 60, yPosition, { align: 'right' });
  doc.setFontSize(14);
  doc.setTextColor(0, 102, 51); // Green for paid amount
  doc.text(`TZS ${amountPaid.toLocaleString()}`, pageWidth - 20, yPosition, { align: 'right' });

  yPosition += 15;

  // Payment Confirmation
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 51);
  doc.text('✓ PAYMENT RECEIVED', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your payment!', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  doc.text('Please keep this receipt for your records', pageWidth / 2, yPosition, { align: 'center' });

  // Footer
  yPosition = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('This is a computer-generated receipt. No signature required.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text('For inquiries, please contact MSIMBAZI EYE CARE', pageWidth / 2, yPosition, { align: 'center' });

  // Save PDF
  const filename = `Receipt-${receiptNumber}-${getCurrentDate()}.pdf`;
  doc.save(filename);
};
