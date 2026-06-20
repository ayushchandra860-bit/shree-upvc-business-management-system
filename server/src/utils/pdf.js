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

function formatDocumentDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function drawLogo(doc, x, y) {
  doc.save();
  doc.roundedRect(x, y, 54, 54, 10).fill('#0b2d5c');
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

function drawBox(doc, x, y, width, height, options = {}) {
  const {
    fill = '#ffffff',
    stroke = '#d7dce3',
    radius = 10,
    lineWidth = 1
  } = options;

  doc.save();
  doc.lineWidth(lineWidth);
  doc.roundedRect(x, y, width, height, radius);

  if (fill && stroke) {
    doc.fillAndStroke(fill, stroke);
  } else if (fill) {
    doc.fill(fill);
  } else if (stroke) {
    doc.stroke(stroke);
  }

  doc.restore();
}

function drawMetaCard(doc, { label, value, x, y, width }) {
  drawBox(doc, x, y, width, 50, { fill: '#ffffff', stroke: '#d7dce3', radius: 10 });
  doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(8.5).text(label, x + 12, y + 10, {
    width: width - 24
  });
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10.5).text(String(value || '-'), x + 12, y + 24, {
    width: width - 24
  });
}

function drawDocumentHeader(doc, settings, { title, subtitle }) {
  const resolvedName = settings.company_name || company.name;
  const resolvedAddress = settings.address || company.addressLines.join(' ');
  const logoBuffer = imageBufferFromDataUrl(settings.logo_url);

  drawBox(doc, 42, 36, 511, 88, { fill: '#f6f8fb', stroke: '#d7dce3', radius: 14 });

  if (logoBuffer) {
    doc.image(logoBuffer, 54, 53, { width: 48, height: 48, fit: [48, 48] });
  } else {
    drawLogo(doc, 54, 53);
  }

  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(17).text(resolvedName, 116, 48, {
    width: 250
  });
  doc.fillColor('#4b5563').font('Helvetica').fontSize(8.7)
    .text(resolvedAddress, 116, 70, { width: 250 })
    .text(company.businessType, 116, 84, { width: 250 })
    .text(`GSTIN: ${settings.gst_number || '-'} | Mobile: ${settings.mobile_number || '-'}`, 116, 98, { width: 250 });

  drawBox(doc, 388, 48, 153, 64, { fill: '#0b2d5c', stroke: '#0b2d5c', radius: 12 });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text(title, 402, 62, {
    width: 125,
    align: 'center'
  });
  doc.font('Helvetica').fontSize(8.5).text(subtitle, 402, 85, {
    width: 125,
    align: 'center'
  });

  return 142;
}

function drawCustomerCard(doc, record, y, label = 'Customer Details') {
  drawBox(doc, 42, y, 511, 90, { fill: '#ffffff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11).text(label, 56, y + 14);
  doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(8.5)
    .text('Customer Name', 56, y + 34)
    .text('Mobile Number', 310, y + 34)
    .text('Site Address', 56, y + 58);
  doc.fillColor('#1f2937').font('Helvetica').fontSize(10)
    .text(record.customer_name || '-', 56, y + 45, { width: 228 })
    .text(record.mobile_number || '-', 310, y + 45, { width: 182 })
    .text(record.site_address || '-', 56, y + 69, { width: 436 });
}

function drawTableHeader(doc, y, columns) {
  drawBox(doc, 42, y, 511, 28, { fill: '#0b2d5c', stroke: '#0b2d5c', radius: 10 });
  columns.forEach((column) => {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.7)
      .text(column.label, column.x, y + 9, { width: column.width, align: column.align || 'left' });
  });
}

function drawItemsTable(doc, items, y, columns, mapper) {
  drawTableHeader(doc, y, columns);
  let currentY = y + 34;

  items.forEach((item, index) => {
    if (currentY > 708) {
      doc.addPage();
      currentY = 56;
      drawTableHeader(doc, currentY, columns);
      currentY += 34;
    }

    if (index % 2 === 0) {
      drawBox(doc, 42, currentY - 6, 511, 24, { fill: '#f8fafc', stroke: null, radius: 6 });
    }

    mapper(item).forEach((cell, cellIndex) => {
      const column = columns[cellIndex];
      doc.fillColor('#1f2937').font('Helvetica').fontSize(9.1)
        .text(cell, column.x, currentY, { width: column.width, align: column.align || 'left' });
    });

    currentY += 25;
  });

  return currentY;
}

function drawSummaryBox(doc, { title, x, y, width, rows }) {
  const height = 48 + rows.length * 19 + 12;
  drawBox(doc, x, y, width, height, { fill: '#f8fbff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11).text(title, x + 14, y + 14);

  let currentY = y + 40;
  rows.forEach(([label, value], index) => {
    const isFinal = index === rows.length - 1;
    if (isFinal) {
      doc.moveTo(x + 14, currentY - 6).lineTo(x + width - 14, currentY - 6).strokeColor('#d7dce3').stroke();
    }

    doc.fillColor(isFinal ? '#0b2d5c' : '#374151')
      .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFinal ? 10.8 : 9.4)
      .text(label, x + 14, currentY, { width: width - 110 });
    doc.text(currency(value), x + width - 112, currentY, {
      width: 98,
      align: 'right'
    });
    currentY += isFinal ? 22 : 18;
  });

  return height;
}

function drawTextPanel(doc, { title, x, y, width, height, sections }) {
  drawBox(doc, x, y, width, height, { fill: '#ffffff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11).text(title, x + 14, y + 14);

  let currentY = y + 38;
  sections.forEach(([label, value]) => {
    doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(8.5).text(label, x + 14, currentY);
    currentY += 12;
    doc.fillColor('#1f2937').font('Helvetica').fontSize(9.2).text(value || '-', x + 14, currentY, {
      width: width - 28
    });
    currentY = doc.y + 10;
  });
}

function ensureInvoicePageSpace(doc, currentY, neededHeight, top = 48) {
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (currentY + neededHeight > pageBottom) {
    doc.addPage();
    return top;
  }

  return currentY;
}

function drawInvoiceHeaderSimple(doc, invoice, settings) {
  const resolvedName = settings.company_name || company.name;
  const resolvedAddress = settings.address || company.addressLines.join(' ');
  const logoBuffer = imageBufferFromDataUrl(settings.logo_url);
  const leftX = 116;
  const leftWidth = 220;
  const rightX = 360;
  const rightWidth = 171;
  const infoText = [
    resolvedAddress,
    company.businessType,
    `GSTIN: ${settings.gst_number || '-'}`,
    `Mobile: ${settings.mobile_number || '-'}`
  ].filter(Boolean).join('\n');
  const nameHeight = doc.heightOfString(resolvedName, {
    width: leftWidth
  });
  const infoHeight = doc.heightOfString(infoText, {
    width: leftWidth,
    lineGap: 2
  });
  const headerHeight = Math.max(102, 24 + nameHeight + infoHeight);

  drawBox(doc, 42, 38, 511, headerHeight, { fill: '#ffffff', stroke: '#d7dce3', radius: 12 });
  doc.save();
  doc.rect(42, 38, 511, 6).fill('#0b2d5c');
  doc.restore();

  if (logoBuffer) {
    doc.image(logoBuffer, 56, 52, { width: 46, height: 46, fit: [46, 46] });
  } else {
    drawLogo(doc, 52, 48);
  }

  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(18).text(resolvedName, leftX, 52, {
    width: leftWidth
  });
  doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(infoText, leftX, doc.y + 6, {
    width: leftWidth,
    lineGap: 2
  });

  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(16).text('TAX INVOICE', rightX, 54, {
    width: rightWidth,
    align: 'right'
  });
  doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(8.5)
    .text('Invoice No', rightX, 82, { width: 72 })
    .text('Invoice Date', rightX, 98, { width: 72 })
    .text('Payment Status', rightX, 114, { width: 72 });
  doc.fillColor('#1f2937').font('Helvetica').fontSize(10)
    .text(invoice.invoice_number || '-', rightX + 78, 82, { width: 93, align: 'right' })
    .text(formatDocumentDate(invoice.invoice_date), rightX + 78, 98, { width: 93, align: 'right' })
    .text(invoice.payment_status || 'Unpaid', rightX + 78, 114, { width: 93, align: 'right' });

  return 38 + headerHeight + 16;
}

function drawInvoiceCustomerSection(doc, invoice, y) {
  const address = String(invoice.site_address || '-');
  const addressHeight = doc.heightOfString(address, {
    width: 467,
    lineGap: 2
  });
  const sectionHeight = Math.max(78, 50 + addressHeight);

  drawBox(doc, 42, y, 511, sectionHeight, { fill: '#ffffff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11).text('Billed To', 56, y + 14);
  doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(8.5)
    .text('Customer Name', 56, y + 34, { width: 200 })
    .text('Mobile Number', 330, y + 34, { width: 110 });
  doc.fillColor('#1f2937').font('Helvetica').fontSize(10)
    .text(invoice.customer_name || '-', 56, y + 46, { width: 240 })
    .text(invoice.mobile_number || '-', 330, y + 46, { width: 167 });
  doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(8.5)
    .text('Site Address', 56, y + 64);
  doc.fillColor('#1f2937').font('Helvetica').fontSize(9.6).text(address, 56, y + 76, {
    width: 467,
    lineGap: 2
  });

  return sectionHeight;
}

function drawInvoiceItemsTableSimple(doc, items, y) {
  const columns = [
    { label: 'Product', x: 50, width: 168 },
    { label: 'Size (mm)', x: 222, width: 84 },
    { label: 'Qty', x: 312, width: 34, align: 'right' },
    { label: 'Sq.Ft', x: 352, width: 58, align: 'right' },
    { label: 'Rate', x: 416, width: 58, align: 'right' },
    { label: 'Amount', x: 478, width: 63, align: 'right' }
  ];

  drawTableHeader(doc, y, columns);
  let currentY = y + 34;

  items.forEach((item, index) => {
    const cells = [
      String(item.product_type || '-'),
      `${item.width_mm} x ${item.height_mm}`,
      String(item.quantity || 0),
      Number(item.total_sqft || 0).toFixed(3),
      currency(item.rate_per_sqft),
      currency(item.product_amount)
    ];
    const rowHeight = Math.max(
      22,
      ...cells.map((cell, cellIndex) => doc.heightOfString(cell, {
        width: columns[cellIndex].width,
        align: columns[cellIndex].align || 'left',
        lineGap: 1
      })) + 8
    );

    if (currentY + rowHeight > doc.page.height - 56) {
      doc.addPage();
      currentY = 48;
      drawTableHeader(doc, currentY, columns);
      currentY += 34;
    }

    if (index % 2 === 0) {
      doc.save();
      doc.rect(42, currentY - 4, 511, rowHeight + 4).fill('#f8fafc');
      doc.restore();
    }

    cells.forEach((cell, cellIndex) => {
      const column = columns[cellIndex];
      doc.fillColor('#1f2937').font('Helvetica').fontSize(9.1).text(cell, column.x, currentY, {
        width: column.width,
        align: column.align || 'left',
        lineGap: 1
      });
    });

    currentY += rowHeight;
  });

  return currentY;
}

function drawInvoiceSummarySection(doc, invoice, y) {
  const rows = [
    ['Product Subtotal', invoice.subtotal],
    ['TRANSPORTATION', invoice.transportation_charges],
    ['Installation', invoice.installation_charges],
    ['Manufacturing', invoice.manufacturing_charges],
    ['Discount', -Number(invoice.discount || 0)],
    [`GST (${invoice.gst_percent}%)`, invoice.gst_amount],
    ['Final Amount', invoice.final_amount]
  ];
  const sectionHeight = 44 + rows.length * 18 + 10;
  const boxX = 323;
  const boxWidth = 230;

  y = ensureInvoicePageSpace(doc, y, sectionHeight + 10);
  drawBox(doc, boxX, y, boxWidth, sectionHeight, { fill: '#f8fbff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11).text('Billing Summary', boxX + 14, y + 14);

  let currentY = y + 38;
  rows.forEach(([label, value], index) => {
    const isFinal = index === rows.length - 1;
    if (isFinal) {
      doc.moveTo(boxX + 14, currentY - 6).lineTo(boxX + boxWidth - 14, currentY - 6).strokeColor('#d7dce3').stroke();
    }

    doc.fillColor(isFinal ? '#0b2d5c' : '#374151')
      .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFinal ? 10.8 : 9.5)
      .text(label, boxX + 14, currentY, { width: 104 });
    doc.text(currency(value), boxX + 118, currentY, {
      width: 98,
      align: 'right'
    });
    currentY += isFinal ? 22 : 18;
  });

  return y + sectionHeight + 12;
}

function drawInvoiceTextSection(doc, title, value, y) {
  const text = String(value || '-');
  const textHeight = doc.heightOfString(text, {
    width: 483,
    lineGap: 2
  });
  const sectionHeight = 40 + textHeight + 14;

  y = ensureInvoicePageSpace(doc, y, sectionHeight + 10);
  drawBox(doc, 42, y, 511, sectionHeight, { fill: '#ffffff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11).text(title, 56, y + 14);
  doc.fillColor('#1f2937').font('Helvetica').fontSize(9.4).text(text, 56, y + 30, {
    width: 483,
    lineGap: 2
  });

  return y + sectionHeight + 12;
}

function drawInvoicePaymentSection(doc, invoice, settings, y) {
  const bankText = settings.bank_details || [
    settings.bank_name && `Bank: ${settings.bank_name}`,
    settings.account_number && `Account: ${settings.account_number}`,
    settings.ifsc && `IFSC: ${settings.ifsc}`,
    settings.upi_id && `UPI: ${settings.upi_id}`
  ].filter(Boolean).join('\n') || '-';
  const bankHeight = doc.heightOfString(bankText, {
    width: 260,
    lineGap: 2
  });
  const sectionHeight = Math.max(98, 40 + bankHeight);

  y = ensureInvoicePageSpace(doc, y, sectionHeight + 10);
  drawBox(doc, 42, y, 511, sectionHeight, { fill: '#ffffff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11)
    .text('Bank Details', 56, y + 14)
    .text('Payment Summary', 372, y + 14);
  doc.fillColor('#1f2937').font('Helvetica').fontSize(9.4).text(bankText, 56, y + 32, {
    width: 260,
    lineGap: 2
  });
  doc.fillColor('#5b6575').font('Helvetica-Bold').fontSize(8.5)
    .text('Received', 372, y + 36, { width: 74 })
    .text('Outstanding', 372, y + 54, { width: 74 })
    .text('Status', 372, y + 72, { width: 74 });
  doc.fillColor('#1f2937').font('Helvetica').fontSize(9.6)
    .text(currency(invoice.paid_amount), 446, y + 36, { width: 90, align: 'right' })
    .text(currency(invoice.remaining_amount), 446, y + 54, { width: 90, align: 'right' })
    .text(invoice.payment_status || 'Unpaid', 446, y + 72, { width: 90, align: 'right' });

  return y + sectionHeight + 12;
}

function drawInvoiceQrSection(doc, settings, y) {
  const qrBuffer = imageBufferFromDataUrl(settings.qr_code_url);
  if (!qrBuffer) return y;

  const sectionHeight = 116;
  y = ensureInvoicePageSpace(doc, y, sectionHeight + 10);
  drawBox(doc, 42, y, 511, sectionHeight, { fill: '#ffffff', stroke: '#d7dce3', radius: 12 });
  doc.fillColor('#0b2d5c').font('Helvetica-Bold').fontSize(11).text('QR Payment', 56, y + 14);
  doc.fillColor('#4b5563').font('Helvetica').fontSize(9.2)
    .text('Customers can use this code for direct payment confirmation.', 56, y + 34, {
      width: 280
    });
  doc.image(qrBuffer, 420, y + 20, { width: 72, height: 72, fit: [72, 72] });

  return y + sectionHeight + 12;
}

function drawInvoiceSignatureSection(doc, settings, y) {
  const signatureBuffer = imageBufferFromDataUrl(settings.signature_url);
  const sectionHeight = 78;

  y = ensureInvoicePageSpace(doc, y, sectionHeight + 10);
  if (signatureBuffer) {
    doc.image(signatureBuffer, 42, y, { width: 118, height: 30, fit: [118, 30] });
  }

  const lineY = y + 34;
  doc.moveTo(42, lineY).lineTo(210, lineY).strokeColor('#9ca3af').stroke();
  doc.moveTo(385, lineY).lineTo(553, lineY).strokeColor('#9ca3af').stroke();
  doc.fillColor('#5b6575').font('Helvetica').fontSize(8.5)
    .text(settings.authorized_signature || 'Authorized Signatory', 42, lineY + 6, { width: 168 })
    .text('Customer Signature', 385, lineY + 6, { width: 168, align: 'right' });
  doc.fillColor('#5b6575').font('Helvetica').fontSize(8)
    .text('This is a computer-generated tax invoice issued by SHREE UPVC WINDOWS & DOORS.', 42, lineY + 28, {
      width: 511,
      align: 'center'
    });

  return y + sectionHeight;
}

function generateInvoicePdf(invoice, items, outputStream, settings = company) {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  if (outputStream) {
    doc.pipe(outputStream);
  }

  if (invoice.payment_status === 'Paid') {
    doc.save();
    doc.rotate(-35, { origin: [300, 390] });
    doc.fillColor('#d7dce3').opacity(0.26).font('Helvetica-Bold').fontSize(88)
      .text('PAID', 145, 330, { width: 340, align: 'center' });
    doc.restore();
    doc.opacity(1);
  }

  let currentY = drawInvoiceHeaderSimple(doc, invoice, settings);
  currentY += drawInvoiceCustomerSection(doc, invoice, currentY) + 14;
  currentY = drawInvoiceItemsTableSimple(doc, items, currentY);
  currentY += 12;
  currentY = drawInvoiceSummarySection(doc, invoice, currentY);
  currentY = drawInvoiceTextSection(doc, 'Notes', invoice.notes || '-', currentY);
  currentY = drawInvoiceTextSection(doc, 'Terms & Conditions', invoice.terms_conditions || settings.terms_conditions || '-', currentY);
  currentY = drawInvoicePaymentSection(doc, invoice, settings, currentY);
  currentY = drawInvoiceQrSection(doc, settings, currentY);
  drawInvoiceSignatureSection(doc, settings, currentY);

  doc.end();
  return doc;
}

function generateQuotationPdf(quotation, items, outputStream, settings = company) {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  if (outputStream) {
    doc.pipe(outputStream);
  }

  let currentY = drawDocumentHeader(doc, settings, {
    title: 'QUOTATION',
    subtitle: 'Customer approval document'
  });

  drawMetaCard(doc, {
    label: 'Quotation Number',
    value: quotation.quotation_number,
    x: 42,
    y: currentY,
    width: 162
  });
  drawMetaCard(doc, {
    label: 'Quotation Date',
    value: formatDocumentDate(quotation.quotation_date),
    x: 216,
    y: currentY,
    width: 162
  });
  drawMetaCard(doc, {
    label: 'Status',
    value: quotation.status || 'Quotation Created',
    x: 390,
    y: currentY,
    width: 163
  });

  currentY += 68;
  drawCustomerCard(doc, quotation, currentY, 'Prepared For');

  currentY += 112;
  const columns = [
    { label: 'Product', x: 50, width: 142 },
    { label: 'Size (mm)', x: 196, width: 84 },
    { label: 'Qty', x: 286, width: 36 },
    { label: 'Sq.Ft', x: 330, width: 58, align: 'right' },
    { label: 'Rate', x: 396, width: 62, align: 'right' },
    { label: 'Amount', x: 465, width: 76, align: 'right' }
  ];

  currentY = drawItemsTable(doc, items, currentY, columns, (item) => ([
    item.product_type,
    `${item.width_mm} x ${item.height_mm}`,
    String(item.quantity),
    Number(item.total_sqft).toFixed(3),
    currency(item.rate_per_sqft),
    currency(item.product_amount)
  ]));

  currentY += 14;
  if (currentY > 570) {
    doc.addPage();
    currentY = 56;
  }

  drawTextPanel(doc, {
    title: 'Commercial Notes',
    x: 42,
    y: currentY,
    width: 268,
    height: 172,
    sections: [
      ['Notes', quotation.notes || '-'],
      ['Terms & Conditions', quotation.terms_conditions || settings.terms_conditions || '-']
    ]
  });

  drawSummaryBox(doc, {
    title: 'Quotation Summary',
    x: 330,
    y: currentY,
    width: 223,
    rows: [
      ['Product Subtotal', items.reduce((sum, item) => sum + Number(item.product_amount || 0), 0)],
      ['TRANSPORTATION', quotation.transportation_charges],
      ['Installation', quotation.installation_charges],
      ['Manufacturing', quotation.manufacturing_charges],
      ['Discount', -Number(quotation.discount || 0)],
      [`GST (${quotation.gst_percent}%)`, quotation.gst_amount],
      ['Grand Total', quotation.grand_total]
    ]
  });

  currentY += 188;
  if (currentY > 700) {
    doc.addPage();
    currentY = 56;
  }

  const signatureBuffer = imageBufferFromDataUrl(settings.signature_url);
  if (signatureBuffer) {
    doc.image(signatureBuffer, 42, currentY - 24, { width: 118, height: 30, fit: [118, 30] });
  }

  doc.moveTo(42, currentY).lineTo(210, currentY).strokeColor('#9ca3af').stroke();
  doc.moveTo(385, currentY).lineTo(553, currentY).strokeColor('#9ca3af').stroke();
  doc.fillColor('#5b6575').font('Helvetica').fontSize(8.5)
    .text(settings.authorized_signature || 'Authorized Signatory', 42, currentY + 6, { width: 168 })
    .text('Customer Acceptance', 385, currentY + 6, { width: 168, align: 'right' });
  doc.fillColor('#5b6575').font('Helvetica').fontSize(8)
    .text('Prepared by SHREE UPVC WINDOWS & DOORS for project review, approval and execution planning.', 42, currentY + 28, {
      width: 511,
      align: 'center'
    });

  doc.end();
  return doc;
}

module.exports = {
  company,
  generateInvoicePdf,
  generateQuotationPdf,
  currency
};
