import jsPDF from 'jspdf';

export interface ReportData {
  title: string;
  date: string;
  generatedBy: string;
  data: any[];
}

export function generatePDF(reportData: ReportData) {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text(reportData.title, 20, 20);
  
  // Metadata
  doc.setFontSize(10);
  doc.text(`Generated: ${reportData.date}`, 20, 30);
  doc.text(`By: ${reportData.generatedBy}`, 20, 35);
  
  // Table header
  let y = 50;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  
  const headers = Object.keys(reportData.data[0] || {});
  headers.forEach((header, index) => {
    doc.text(header, 20 + index * 40, y);
  });
  
  // Table data
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  reportData.data.forEach((row, rowIndex) => {
    y += 10;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    
    headers.forEach((header, colIndex) => {
      const value = String(row[header] || '');
      doc.text(value.substring(0, 20), 20 + colIndex * 40, y);
    });
  });
  
  // Save
  doc.save(`${reportData.title.replace(/\s+/g, '_')}.pdf`);
}

export function generatePurchaseOrderPDF(orderData: {
  orderNumber: string;
  supplier: string;
  items: Array<{ sku: string; name: string; quantity: number; unitCost: number }>;
  total: number;
}) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Purchase Order', 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Order #: ${orderData.orderNumber}`, 20, 35);
  doc.text(`Supplier: ${orderData.supplier}`, 20, 42);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 49);
  
  // Items table
  let y = 65;
  doc.setFont('helvetica', 'bold');
  doc.text('SKU', 20, y);
  doc.text('Item', 60, y);
  doc.text('Qty', 140, y);
  doc.text('Unit Cost', 170, y);
  doc.text('Total', 200, y);
  
  y += 10;
  doc.setFont('helvetica', 'normal');
  
  orderData.items.forEach((item) => {
    doc.text(item.sku, 20, y);
    doc.text(item.name.substring(0, 30), 60, y);
    doc.text(String(item.quantity), 140, y);
    doc.text(`$${item.unitCost.toFixed(2)}`, 170, y);
    doc.text(`$${(item.quantity * item.unitCost).toFixed(2)}`, 200, y);
    y += 10;
  });
  
  // Total
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: $${orderData.total.toFixed(2)}`, 200, y);
  
  doc.save(`PO_${orderData.orderNumber}.pdf`);
}
