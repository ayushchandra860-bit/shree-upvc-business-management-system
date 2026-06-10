const PDFDocument = require('pdfkit');

const company = {
  name: 'SHREE UPVC WINDOWS & DOORS',
  addressLines: [
    'Baba Market, Lekha Nagar,',
    'Danapur, Patna - 801105, Bihar'
  ],
  businessType: 'UPVC Windows & Doors Manufacturing, Supply and Installation'
};

function currency(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function drawLogo(doc, x, y) {
  doc.save();
  doc.roundedRect(x, y, 54, 54, 8).fill('#0b2d5c');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text('SU', x, y + 14, {
    width: 54,
    align: 'center'
  });
  doc.restore();
}

function imageBufferFromDataUrl(value) {
  if (!value || !String(value).startsWith('data:image/')) return null;
  const [, base64] = String(value).split(',');
  if (!base64) return null;
  return Buffer.from(base64, 'base64');
}

function textLine(doc, label, value, x, y, width) {
  doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(9).text(label, x, y, { width });
  doc.fillColor('#1f2937').font('Helvetica').fontSize(10).text(String(value || '-'), x, y + 13, { width });
}

function generateInvoicePdf(invoice, items, outputStream, settings = company) {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  if (outputStream) {
    doc.pipe(outputStream);
  }

  if (invoice.payment_status === 'Paid') {
    doc.save();
    doc.rotate(-35, { origin: [300, 390] });
    doc.fillColor('#d7dce3').opacity(0.32).font('Helvetica-Bold').fontSize(86)
      .text('PAID', 145, 330, { width: 340, align: 'center' });
    doc.restore();
    doc.opacity(1);
  }

  const logoBuffer = imageBufferFromDataUrl(settings.logo_url);
  if (logoBuffer) {
    doc.image(logoBuffer, 42, 40, { width: 54, height: 54, fit: [54, 54] });
  } else {
    drawLogo(doc, 42, 40);
  }
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(17).text(settings.company_name || company.name, 110, 42);
  doc.fillColor('#4b5563').font('Helvetica').fontSize(9)
    .text(settings.address || company.addressLines.join(' '), 110, 65)
    .text(company.businessType, 110, 79)
    .text(`GST: ${settings.gst_number || '-'} | Mobile: ${settings.mobile_number || '-'}`, 110, 93);

  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(20).text('TAX INVOICE', 410, 42, {
    width: 140,
    align: 'right'
  });
  doc.moveTo(42, 112).lineTo(553, 112).strokeColor('#d7dce3').stroke();

  textLine(doc, 'Invoice Number', invoice.invoice_number, 42, 130, 150);
  textLine(doc, 'Invoice Date', invoice.invoice_date, 220, 130, 120);
  textLine(doc, 'Payment Status', invoice.payment_status, 390, 130, 130);
  textLine(doc, 'Customer Name', invoice.customer_name, 42, 178, 240);
  textLine(doc, 'Mobile Number', invoice.mobile_number, 310, 178, 160);
  textLine(doc, 'Site Address', invoice.site_address, 42, 226, 430);

  const tableTop = 290;
  const columns = [
    { label: 'Product', x: 42, width: 145 },
    { label: 'Size (mm)', x: 190, width: 85 },
    { label: 'Qty', x: 280, width: 45 },
    { label: 'Sq.Ft', x: 330, width: 65 },
    { label: 'Rate', x: 400, width: 65 },
    { label: 'Amount', x: 468, width: 84 }
  ];

  doc.rect(42, tableTop, 511, 24).fill('#0b2d5c');
  columns.forEach((column) => {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
      .text(column.label, column.x, tableTop + 7, { width: column.width });
  });

  let y = tableTop + 31;
  items.forEach((item, index) => {
    if (y > 690) {
      doc.addPage();
      y = 56;
    }

    if (index % 2 === 0) {
      doc.rect(42, y - 6, 511, 27).fill('#f3f5f8');
    }

    doc.fillColor('#1f2937').font('Helvetica').fontSize(9)
      .text(item.product_type, 42, y, { width: 145 })
      .text(`${item.width_mm} x ${item.height_mm}`, 190, y, { width: 85 })
      .text(String(item.quantity), 280, y, { width: 45 })
      .text(Number(item.total_sqft).toFixed(3), 330, y, { width: 65 })
      .text(currency(item.rate_per_sqft), 400, y, { width: 65 })
      .text(currency(item.product_amount), 468, y, { width: 84, align: 'right' });
    y += 28;
  });

  y += 16;
  const totalX = 350;
  const valueX = 455;
  doc.moveTo(totalX, y - 8).lineTo(553, y - 8).strokeColor('#d7dce3').stroke();

  [
    ['Subtotal', invoice.subtotal],
    ['Transportation', invoice.transportation_charges],
    ['Installation', invoice.installation_charges],
    ['Manufacturing', invoice.manufacturing_charges],
    ['Discount', -Number(invoice.discount || 0)],
    [`GST (${invoice.gst_percent}%)`, invoice.gst_amount],
    ['Final Amount', invoice.final_amount]
  ].forEach(([label, value], index) => {
    const isFinal = label === 'Final Amount';
    doc.fillColor(isFinal ? '#0b2d5c' : '#374151')
      .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFinal ? 12 : 10)
      .text(label, totalX, y, { width: 100 })
      .text(currency(value), valueX, y, { width: 98, align: 'right' });
    y += isFinal ? 22 : 18;
  });

  y += 8;
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9).text('Payment Summary', 42, y);
  doc.font('Helvetica').fontSize(9)
    .text(`Paid: ${currency(invoice.paid_amount)} | Remaining: ${currency(invoice.remaining_amount)}`, 42, y + 14);
  doc.font('Helvetica-Bold').text('Notes', 42, y + 42);
  doc.font('Helvetica').text(invoice.notes || '-', 42, y + 56, { width: 235 });
  doc.font('Helvetica-Bold').text('Terms & Conditions', 310, y + 42);
  doc.font('Helvetica').text(invoice.terms_conditions || settings.terms_conditions || '-', 310, y + 56, { width: 230 });

  const bankText = settings.bank_details || [
    settings.bank_name && `Bank: ${settings.bank_name}`,
    settings.account_number && `Account: ${settings.account_number}`,
    settings.ifsc && `IFSC: ${settings.ifsc}`,
    settings.upi_id && `UPI: ${settings.upi_id}`
  ].filter(Boolean).join('\n') || '-';
  doc.font('Helvetica-Bold').text('Bank Details', 42, 652);
  doc.font('Helvetica').text(bankText, 42, 666, { width: 230 });
  doc.font('Helvetica-Bold').text('QR Payment', 310, 652);
  const qrBuffer = imageBufferFromDataUrl(settings.qr_code_url);
  if (qrBuffer) {
    doc.image(qrBuffer, 310, 666, { width: 64, height: 64, fit: [64, 64] });
  } else {
    doc.font('Helvetica').text(settings.qr_code_url || 'QR code not configured', 310, 666, { width: 230 });
  }

  const signatureBuffer = imageBufferFromDataUrl(settings.signature_url);
  if (signatureBuffer) {
    doc.image(signatureBuffer, 42, 704, { width: 120, height: 34, fit: [120, 34] });
  }
  doc.font('Helvetica').fillColor('#1f2937')
    .text(settings.authorized_signature || 'Authorized Signatory', 42, 738)
    .text('Customer Signature', 390, 738);
  doc.moveTo(42, 748).lineTo(553, 748).strokeColor('#d7dce3').stroke();
  doc.fillColor('#5b6575').font('Helvetica').fontSize(8)
    .text('Thank you for choosing SHREE UPVC WINDOWS & DOORS.', 42, 760, { align: 'center' });

  doc.end();
  return doc;
}

function generateQuotationPdf(quotation, items, outputStream, settings = company) {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  if (outputStream) doc.pipe(outputStream);

  const logoBuffer = imageBufferFromDataUrl(settings.logo_url);
  if (logoBuffer) {
    doc.image(logoBuffer, 42, 40, { width: 54, height: 54, fit: [54, 54] });
  } else {
    drawLogo(doc, 42, 40);
  }

  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(17).text(settings.company_name || company.name, 110, 42);
  doc.fillColor('#4b5563').font('Helvetica').fontSize(9)
    .text(settings.address || company.addressLines.join(' '), 110, 65)
    .text(`GST: ${settings.gst_number || '-'} | Mobile: ${settings.mobile_number || '-'}`, 110, 79);
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(18).text('WINDOWS & DOORS QUOTATION', 330, 42, {
    width: 220,
    align: 'right'
  });
  doc.moveTo(42, 112).lineTo(553, 112).strokeColor('#d7dce3').stroke();

  textLine(doc, 'Quotation Number', quotation.quotation_number, 42, 130, 150);
  textLine(doc, 'Quotation Date', quotation.quotation_date, 220, 130, 120);
  textLine(doc, 'Customer Name', quotation.customer_name, 42, 178, 240);
  textLine(doc, 'Mobile Number', quotation.mobile_number, 310, 178, 160);
  textLine(doc, 'Site Address', quotation.site_address, 42, 226, 430);

  const tableTop = 290;
  const columns = [
    { label: 'Product', x: 42, width: 145 },
    { label: 'Size (mm)', x: 190, width: 85 },
    { label: 'Qty', x: 280, width: 45 },
    { label: 'Sq.Ft', x: 330, width: 65 },
    { label: 'Rate', x: 400, width: 65 },
    { label: 'Amount', x: 468, width: 84 }
  ];

  doc.rect(42, tableTop, 511, 24).fill('#0b2d5c');
  columns.forEach((column) => doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    .text(column.label, column.x, tableTop + 7, { width: column.width }));

  let y = tableTop + 31;
  items.forEach((item, index) => {
    if (index % 2 === 0) doc.rect(42, y - 6, 511, 27).fill('#f3f5f8');
    doc.fillColor('#1f2937').font('Helvetica').fontSize(9)
      .text(item.product_type, 42, y, { width: 145 })
      .text(`${item.width_mm} x ${item.height_mm}`, 190, y, { width: 85 })
      .text(String(item.quantity), 280, y, { width: 45 })
      .text(Number(item.total_sqft).toFixed(3), 330, y, { width: 65 })
      .text(currency(item.rate_per_sqft), 400, y, { width: 65 })
      .text(currency(item.product_amount), 468, y, { width: 84, align: 'right' });
    y += 28;
  });

  const totalX = 340;
  const valueX = 455;
  y += 14;
  [
    ['Product Subtotal', items.reduce((sum, item) => sum + Number(item.product_amount || 0), 0)],
    ['Transportation', quotation.transportation_charges],
    ['Installation', quotation.installation_charges],
    ['Manufacturing', quotation.manufacturing_charges],
    ['Discount', -Number(quotation.discount || 0)],
    [`GST (${quotation.gst_percent}%)`, quotation.gst_amount],
    ['Grand Total', quotation.grand_total]
  ].forEach(([label, value]) => {
    const isFinal = label === 'Grand Total';
    doc.fillColor(isFinal ? '#0b2d5c' : '#374151')
      .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFinal ? 12 : 10)
      .text(label, totalX, y, { width: 110 })
      .text(currency(value), valueX, y, { width: 98, align: 'right' });
    y += isFinal ? 22 : 18;
  });

  doc.font('Helvetica-Bold').fillColor('#374151').fontSize(9).text('Notes', 42, 650);
  doc.font('Helvetica').text(quotation.notes || '-', 42, 665, { width: 235 });
  doc.font('Helvetica-Bold').text('Terms & Conditions', 310, 650);
  doc.font('Helvetica').text(quotation.terms_conditions || settings.terms_conditions || '-', 310, 665, { width: 230 });
  doc.moveTo(42, 748).lineTo(553, 748).strokeColor('#d7dce3').stroke();
  doc.fillColor('#5b6575').font('Helvetica').fontSize(8)
    .text('This quotation is system generated for SHREE UPVC WINDOWS & DOORS.', 42, 760, { align: 'center' });
  doc.end();
  return doc;
}

module.exports = {
  company,
  generateInvoicePdf,
  generateQuotationPdf,
  currency
};
