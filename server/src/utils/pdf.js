const PDFDocument = require('pdfkit');

// --- PDF Theme and Constants ---
const PAGE_MARGIN = 42;
const HEADER_HEIGHT = 100; // Increased for more info
const FOOTER_HEIGHT = 80;
const CARD_RADIUS = 8;
const TABLE_ROW_HEIGHT = 28;
const TABLE_HEADER_FILL = '#0b2d5c';
const TABLE_HEADER_TEXT_COLOR = '#ffffff';
const TABLE_ROW_EVEN_FILL = '#f8fafc';
const TABLE_BORDER_COLOR = '#e2e8f0';
const PRIMARY_COLOR = '#0b2d5c';
const SECONDARY_TEXT_COLOR = '#4b5563';
const BODY_TEXT_COLOR = '#1f2937';
const LABEL_TEXT_COLOR = '#5b6575';
const ACCENT_COLOR = '#143e78'; // For grand total

const company = {
  name: 'SHREE UPVC WINDOWS & DOORS',
  addressLines: [
    'Baba Market, Lekha Nagar,',
    'Danapur, Patna - 801105, Bihar'
  ],
  businessType: 'UPVC Windows & Doors Manufacturing, Supply and Installation',
  mobile: '9876543210', // Placeholder, will be overridden by settings
  email: 'info@shreeupvc.com', // Placeholder, will be overridden by settings
  website: 'www.shreeupvc.com' // Placeholder, will be overridden by settings
};

// Set default font for PDFKit
PDFDocument.prototype.addPage = (function (original) {
  return function () {
    return original.apply(this, arguments).font('Helvetica');
  };
})(PDFDocument.prototype.addPage);

function normalizeSettings(settings = {}) {
  return {
    company_name: settings.company_name || company.name,
    address: settings.address || company.addressLines.join(' '),
    gst_number: settings.gst_number || '',
    mobile_number: settings.mobile_number || '',
    email: settings.email || company.email,
    website: settings.website || company.website,
    bank_details: settings.bank_details || '',
    bank_name: settings.bank_name || '',
    account_number: settings.account_number || '',
    ifsc: settings.ifsc || '',
    upi_id: settings.upi_id || '',
    terms_conditions: settings.terms_conditions || '',
    authorized_signature: settings.authorized_signature || 'Authorized Signatory',
    logo_url: settings.logo_url || '',
    qr_code_url: settings.qr_code_url || '',
    signature_url: settings.signature_url || ''
  };
}

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
  doc.roundedRect(x, y, 60, 60, CARD_RADIUS).fill(PRIMARY_COLOR); // Consistent logo box
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('SU', x, y + 18, {
    width: 60,
    align: 'center',
  });
  doc.restore();
}

function imageBufferFromDataUrl(value) {
  if (!value || !String(value).startsWith('data:image/')) return null;
  const [, base64] = String(value).split(',');
  if (!base64) return null; // Handle empty base64 string
  return Buffer.from(base64, 'base64');
}

function tryDrawDataUrlImage(doc, dataUrl, x, y, options = {}) {
  const imageBuffer = imageBufferFromDataUrl(dataUrl);
  if (!imageBuffer) return false;

  try {
    doc.image(imageBuffer, x, y, options);
    return true;
  } catch (error) {
    return false;
  }
}

function drawBox(doc, x, y, width, height, options = {}) {
  const {
    fill = INFO_CARD_FILL, // Default fill for boxes
    stroke = '#d7dce3',
    radius = CARD_RADIUS,
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

/**
 * Draws a standardized document header.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {object} settings - Company settings.
 * @param {string} documentTitle - Main title of the document (e.g., "QUOTATION", "TAX INVOICE").
 * @param {string} [documentSubtitle] - Optional subtitle for the document.
 * @returns {number} The Y-coordinate after drawing the header.
 */
function drawCompanyHeader(doc, settings, documentTitle, documentSubtitle) {
  const resolvedSettings = normalizeSettings(settings);
  const resolvedName = resolvedSettings.company_name;
  const resolvedAddress = resolvedSettings.address;
  const startY = PAGE_MARGIN;
  const logoX = PAGE_MARGIN + 4;
  const logoY = startY + 4;
  const textX = logoX + 70;
  const textWidth = 280;

  drawBox(doc, PAGE_MARGIN, startY, 595 - 2 * PAGE_MARGIN, HEADER_HEIGHT, { fill: '#f6f8fb', stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });

  if (!tryDrawDataUrlImage(doc, resolvedSettings.logo_url, logoX, logoY, { width: 60, height: 60, fit: [60, 60] })) {
    drawLogo(doc, logoX, logoY);
  }

  doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(16).text(resolvedName, textX, startY + 8, {
    width: textWidth
  });
  doc.fillColor(SECONDARY_TEXT_COLOR).font('Helvetica').fontSize(8.5)
    .text(company.businessType, textX, doc.y + 2, { width: textWidth })
    .text(resolvedAddress, textX, doc.y + 2, { width: textWidth })
    .text(`GSTIN: ${resolvedSettings.gst_number || '-'} | Mobile: ${resolvedSettings.mobile_number || '-'}`, textX, doc.y + 2, { width: textWidth })
    .text(`Email: ${resolvedSettings.email || '-'} | Web: ${resolvedSettings.website || '-'}`, textX, doc.y + 2, { width: textWidth });

  // Document Title Box
  const titleBoxWidth = 160;
  const titleBoxX = 595 - PAGE_MARGIN - titleBoxWidth;
  drawBox(doc, titleBoxX, startY + 10, titleBoxWidth, 70, { fill: PRIMARY_COLOR, stroke: PRIMARY_COLOR, radius: CARD_RADIUS });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(documentTitle, titleBoxX + 10, startY + 22, {
    width: titleBoxWidth - 20,
    align: 'center'
  });
  if (documentSubtitle) {
    doc.font('Helvetica').fontSize(8.5).text(documentSubtitle, titleBoxX + 10, startY + 48, {
      width: titleBoxWidth - 20,
      align: 'center'
    });
  }

  return startY + HEADER_HEIGHT + 16; // Return Y position after header
}

/**
 * Draws a generic information card with a title and key-value pairs.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} width - Width of the card.
 * @param {string} title - Title of the card.
 * @param {Array<Array<string>>} fields - Array of [label, value] pairs.
 * @returns {number} The height of the drawn card.
 */
function drawInfoCard(doc, x, y, width, title, fields) {
  const lineHeight = 14;
  const padding = 12;
  const contentHeight = fields.length * lineHeight + 10; // Approx height for fields
  const cardHeight = 24 + contentHeight; // Title + padding + content

  drawBox(doc, x, y, width, cardHeight, { fill: '#ffffff', stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });
  doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(10).text(title, x + padding, y + padding);

  let currentY = y + padding + 16;
  fields.forEach(([label, value]) => {
    doc.fillColor(LABEL_TEXT_COLOR).font('Helvetica-Bold').fontSize(8).text(`${label}:`, x + padding, currentY, { continued: true });
    doc.fillColor(BODY_TEXT_COLOR).font('Helvetica').fontSize(8).text(String(value || '-'), x + padding + doc.widthOfString(`${label}: `), currentY, {
      width: width - 2 * padding - doc.widthOfString(`${label}: `)
    });
    currentY += lineHeight;
  });
  return cardHeight;
}

/**
 * Draws the customer details card.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {object} customerData - Customer and document-specific data.
 * @param {number} y - Y coordinate.
 * @param {string} cardTitle - Title for the customer card (e.g., "Prepared For", "Billed To").
 * @param {Array<Array<string>>} documentSpecificFields - Array of [label, value] for document-specific info (e.g., Invoice No, Date).
 * @returns {number} The Y-coordinate after drawing the customer section.
 */
function drawCustomerSection(doc, customerData, y, cardTitle, documentSpecificFields = []) {
  const cardX = PAGE_MARGIN;
  const cardWidth = 595 - 2 * PAGE_MARGIN;
  const padding = 12;
  const customerInfoWidth = cardWidth / 2 - padding;

  const customerFields = [
    ['Name', customerData.customer_name],
    ['Mobile', customerData.mobile_number],
    ['Address', customerData.site_address],
    ['GSTIN', customerData.gst_number || '-'] // Assuming gst_number might be available on customer or settings
  ];

  const customerCardHeight = drawInfoCard(doc, cardX, y, customerInfoWidth, cardTitle, customerFields);
  
  // Draw document specific info card next to customer card
  const docInfoCardX = cardX + cardWidth / 2 + padding / 2;
  const docInfoCardWidth = cardWidth / 2 - padding / 2;
  const docInfoCardHeight = drawInfoCard(doc, docInfoCardX, y, docInfoCardWidth, 'Document Details', documentSpecificFields);

  return y + Math.max(customerCardHeight, docInfoCardHeight) + 16;
}

function drawTableHeader(doc, y, columns, tableWidth) {
  drawBox(doc, PAGE_MARGIN, y, tableWidth, TABLE_ROW_HEIGHT, { fill: TABLE_HEADER_FILL, stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });
  columns.forEach((column) => {
    doc.fillColor(TABLE_HEADER_TEXT_COLOR).font('Helvetica-Bold').fontSize(9.5)
      .text(column.label, column.x, y + 9, { width: column.width, align: column.align || 'left' });
  });
}

function drawItemsTable(doc, items, y, columns, mapper, tableWidth) {
  drawTableHeader(doc, y, columns, tableWidth);
  let currentY = y + TABLE_ROW_HEIGHT + 6; // Start below header with some padding

  items.forEach((item, index) => {
    const rowHeight = TABLE_ROW_HEIGHT; // Consistent row height

    if (currentY + rowHeight > doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT) {
      doc.addPage();
      currentY = PAGE_MARGIN;
      drawTableHeader(doc, currentY, columns, tableWidth);
      currentY += TABLE_ROW_HEIGHT + 6;
    }

    if (index % 2 === 0) {
      drawBox(doc, PAGE_MARGIN, currentY - 4, tableWidth, rowHeight, { fill: TABLE_ROW_EVEN_FILL, stroke: null, radius: 0 });
    }

    mapper(item).forEach((cell, cellIndex) => {
      const column = columns[cellIndex];
      doc.fillColor(BODY_TEXT_COLOR).font('Helvetica').fontSize(9.5)
        .text(cell, column.x, currentY + (rowHeight - doc.currentLineHeight()) / 2 - 2, { width: column.width, align: column.align || 'left' });
    });

    currentY += rowHeight;
  });

  return currentY;
}

/**
 * Draws a financial summary card.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} width - Width of the card.
 * @param {string} title - Title of the summary (e.g., "Quotation Summary", "Billing Summary").
 * @param {Array<Array<string|number>>} rows - Array of [label, value] pairs for summary items.
 * @param {number} grandTotalValue - The value for the grand total, to be highlighted.
 * @returns {number} The height of the drawn card.
 */
function drawFinancialSummaryCard(doc, x, y, width, title, rows, grandTotalValue) {
  const padding = 14;
  const lineHeight = 18;
  const finalLineHeight = 24; // For grand total
  const totalRowsHeight = rows.length * lineHeight;
  const cardHeight = padding * 2 + 16 + totalRowsHeight + finalLineHeight; // Title + padding + rows + grand total

  drawBox(doc, x, y, width, cardHeight, { fill: '#f8fbff', stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });
  doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(11).text(title, x + padding, y + padding);

  let currentY = y + padding + 24;
  rows.forEach(([label, value], index) => {
    const isFinal = index === rows.length - 1;
    if (isFinal) {
      doc.moveTo(x + padding, currentY - 6).lineTo(x + width - padding, currentY - 6).strokeColor(TABLE_BORDER_COLOR).stroke();
    }

    doc.fillColor(isFinal ? PRIMARY_COLOR : BODY_TEXT_COLOR)
      .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFinal ? 10 : 9)
      .text(label, x + padding, currentY, { width: width - padding * 2 - 100 });
    doc.text(currency(value), x + width - padding - 100, currentY, {
      width: 100,
      align: 'right'
    });
    currentY += lineHeight;
  });

  // Grand Total - Visually dominant
  doc.fillColor(ACCENT_COLOR).font('Helvetica-Bold').fontSize(14).text('Grand Total', x + padding, currentY + 6, { continued: true });
  doc.text(currency(grandTotalValue), x + width - padding - 100, currentY + 6, {
    width: 100,
    align: 'right'
  });

  return cardHeight;
}

/**
 * Draws a text panel for notes or terms.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} width - Width of the panel.
 * @param {string} title - Title of the panel.
 * @param {Array<Array<string>>} sections - Array of [label, value] pairs for text sections.
 * @returns {number} The Y-coordinate after drawing the panel.
 */
function drawTextPanel(doc, x, y, width, title, sections) {
  const padding = 14;
  const initialY = y;
  let currentY = y + padding + 20;

  // Calculate height dynamically
  let contentHeight = 0;
  sections.forEach(([label, value]) => {
    contentHeight += doc.heightOfString(label, { width: width - 2 * padding, lineGap: 2 }) + 4;
    contentHeight += doc.heightOfString(value || '-', { width: width - 2 * padding, lineGap: 2 }) + 10;
  });
  const cardHeight = padding * 2 + 16 + contentHeight;

  drawBox(doc, x, initialY, width, cardHeight, { fill: '#ffffff', stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });
  doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(11).text(title, x + padding, initialY + padding);

  sections.forEach(([label, value]) => {
    doc.fillColor(LABEL_TEXT_COLOR).font('Helvetica-Bold').fontSize(8.5).text(label, x + padding, currentY);
    currentY += 10;
    doc.fillColor(BODY_TEXT_COLOR).font('Helvetica').fontSize(9.2).text(value || '-', x + padding, currentY, {
      width: width - 2 * padding,
      lineGap: 2
    });
    currentY = doc.y + 10; // Update currentY based on actual text height
  });
  return initialY + cardHeight;
}

function ensurePageSpace(doc, currentY, neededHeight, top = PAGE_MARGIN) {
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (currentY + neededHeight > pageBottom) {
    doc.addPage();
    return top;
  }

  return currentY;
}

/**
 * Draws the items table for invoices.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {Array<object>} items - Array of item objects.
 * @param {number} y - Y coordinate.
 * @returns {number} The Y-coordinate after drawing the table.
 */
function drawInvoiceItemsTable(doc, items, y) {
  const tableWidth = 595 - 2 * PAGE_MARGIN;
  const columns = [
    { label: 'Product', x: PAGE_MARGIN + 8, width: 168 },
    { label: 'Size (mm)', x: PAGE_MARGIN + 176, width: 84 },
    { label: 'Qty', x: PAGE_MARGIN + 268, width: 34, align: 'right' },
    { label: 'Sq.Ft', x: PAGE_MARGIN + 308, width: 58, align: 'right' },
    { label: 'Rate', x: PAGE_MARGIN + 372, width: 58, align: 'right' },
    { label: 'Amount', x: PAGE_MARGIN + 434, width: 63, align: 'right' }
  ];

  return drawItemsTable(doc, items, y, columns, (item) => ([
    String(item.product_type || '-'),
    `${item.width_mm} x ${item.height_mm}`,
    String(item.quantity || 0),
    Number(item.total_sqft || 0).toFixed(3),
    currency(item.rate_per_sqft),
    currency(item.product_amount)
  ]), tableWidth);
}

/**
 * Draws the financial summary section for invoices.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {object} invoice - Invoice data.
 * @param {number} y - Y coordinate.
 * @returns {number} The Y-coordinate after drawing the summary section.
 */
function drawFinancialSummarySection(doc, invoice, y) {
  const rows = [
    ['Product Subtotal', invoice.subtotal],
    ['TRANSPORTATION', invoice.transportation_charges],
    ['Installation', invoice.installation_charges],
    ['Manufacturing', invoice.manufacturing_charges],
    ['Discount', -Number(invoice.discount || 0)],
    [`GST (${invoice.gst_percent}%)`, invoice.gst_amount],
    ['Final Amount', invoice.final_amount]
  ];
  const boxX = PAGE_MARGIN + (595 - 2 * PAGE_MARGIN) / 2 + 10; // Right half of the page
  const boxWidth = (595 - 2 * PAGE_MARGIN) / 2 - 10;

  const neededHeight = 44 + rows.length * 18 + 10 + 24; // Estimate height for grand total
  y = ensurePageSpace(doc, y, neededHeight);

  const cardHeight = drawFinancialSummaryCard(doc, boxX, y, boxWidth, 'Billing Summary', rows, invoice.final_amount);

  return y + cardHeight + 12;
}

/**
 * Draws a generic text section (e.g., Notes, Terms & Conditions).
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {string} title - Title of the section.
 * @param {string} content - The text content.
 * @param {number} y - Y coordinate.
 * @param {number} [width] - Optional width, defaults to full page width.
 * @returns {number} The Y-coordinate after drawing the section.
 */
function drawTextSection(doc, title, content, y, width = 595 - 2 * PAGE_MARGIN) {
  const text = String(content || '-');
  const padding = 14;
  const textWidth = width - 2 * padding;
  const textHeight = doc.heightOfString(text, {
    width: textWidth,
    lineGap: 2
  });
  const sectionHeight = 40 + textHeight + 14;

  y = ensurePageSpace(doc, y, sectionHeight + 10);
  drawBox(doc, PAGE_MARGIN, y, width, sectionHeight, { fill: '#ffffff', stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });
  doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(11).text(title, PAGE_MARGIN + padding, y + padding);
  doc.fillColor(BODY_TEXT_COLOR).font('Helvetica').fontSize(9.4).text(text, PAGE_MARGIN + padding, y + padding + 16, {
    width: textWidth,
    lineGap: 2
  });

  return y + sectionHeight + 12;
}

/**
 * Draws the payment details section for invoices.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {object} invoice - Invoice data.
 * @param {object} settings - Company settings.
 * @param {number} y - Y coordinate.
 * @returns {number} The Y-coordinate after drawing the section.
 */
function drawPaymentDetailsSection(doc, invoice, settings, y) {
  const resolvedSettings = normalizeSettings(settings);
  const bankText = resolvedSettings.bank_details || [
    resolvedSettings.bank_name && `Bank: ${resolvedSettings.bank_name}`,
    resolvedSettings.account_number && `Account: ${resolvedSettings.account_number}`,
    resolvedSettings.ifsc && `IFSC: ${resolvedSettings.ifsc}`,
    resolvedSettings.upi_id && `UPI: ${resolvedSettings.upi_id}`
  ].filter(Boolean).join('\n') || '-';
  const bankHeight = doc.heightOfString(bankText, {
    width: 260,
    lineGap: 2 // Adjusted for better spacing
  });
  const sectionHeight = Math.max(98, 40 + bankHeight);
  const cardWidth = 595 - 2 * PAGE_MARGIN;

  y = ensurePageSpace(doc, y, sectionHeight + 10);
  drawBox(doc, PAGE_MARGIN, y, cardWidth, sectionHeight, { fill: '#ffffff', stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });
  doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(11).text('Bank Details', PAGE_MARGIN + 14, y + 14)
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

/**
 * Draws the QR code section.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {object} settings - Company settings.
 * @param {number} y - Y coordinate.
 * @returns {number} The Y-coordinate after drawing the section.
 */
function drawQrCodeSection(doc, settings, y) {
  const resolvedSettings = normalizeSettings(settings);
  if (!resolvedSettings.qr_code_url) return y;

  const sectionHeight = 116;
  const cardWidth = 595 - 2 * PAGE_MARGIN;

  y = ensurePageSpace(doc, y, sectionHeight + 10);
  drawBox(doc, PAGE_MARGIN, y, cardWidth, sectionHeight, { fill: '#ffffff', stroke: TABLE_BORDER_COLOR, radius: CARD_RADIUS });
  doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold').fontSize(11).text('QR Payment', PAGE_MARGIN + 14, y + 14);
  doc.fillColor(SECONDARY_TEXT_COLOR).font('Helvetica').fontSize(9.2).text('Customers can use this code for direct payment confirmation.', PAGE_MARGIN + 14, y + 34, { width: 280 });
  if (!tryDrawDataUrlImage(doc, resolvedSettings.qr_code_url, PAGE_MARGIN + cardWidth - 100, y + 20, { width: 72, height: 72, fit: [72, 72] })) {
    doc.fillColor('#5b6575').font('Helvetica').fontSize(9)
      .text('QR image unavailable', 384, y + 48, { width: 140, align: 'center' });
  }

  return y + sectionHeight + 12;
}

/**
 * Draws the document footer with signatures and terms.
 * @param {PDFDocument} doc - The PDFDocument instance.
 * @param {object} settings - Company settings.
 * @param {number} y - Y coordinate.
 * @param {string} [preparedByLabel='Prepared by'] - Label for the preparer.
 * @param {string} [customerAcceptanceLabel='Customer Acceptance'] - Label for customer signature.
 * @param {string} [disclaimer] - Optional disclaimer text.
 * @returns {number} The Y-coordinate after drawing the footer.
 */
function drawDocumentFooter(doc, settings, y, preparedByLabel = 'Prepared by', customerAcceptanceLabel = 'Customer Acceptance', disclaimer) {
  const resolvedSettings = normalizeSettings(settings);
  const footerY = doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT;
  const signatureLineY = footerY + 30;
  const signatureWidth = 168;
  const signatureGap = 50;
  const leftSignatureX = PAGE_MARGIN;
  const rightSignatureX = 595 - PAGE_MARGIN - signatureWidth;

  // Ensure space for footer
  y = ensurePageSpace(doc, y, FOOTER_HEIGHT + 10);

  // Draw signature image if available
  tryDrawDataUrlImage(doc, resolvedSettings.signature_url, leftSignatureX, signatureLineY - 30, { width: 118, height: 30, fit: [118, 30] });

  doc.moveTo(leftSignatureX, signatureLineY).lineTo(leftSignatureX + signatureWidth, signatureLineY).strokeColor(TABLE_BORDER_COLOR).stroke();
  doc.moveTo(rightSignatureX, signatureLineY).lineTo(rightSignatureX + signatureWidth, signatureLineY).strokeColor(TABLE_BORDER_COLOR).stroke();

  doc.fillColor(LABEL_TEXT_COLOR).font('Helvetica').fontSize(8.5)
    .text(resolvedSettings.authorized_signature || 'Authorized Signatory', leftSignatureX, signatureLineY + 6, { width: signatureWidth })
    .text(customerAcceptanceLabel, rightSignatureX, signatureLineY + 6, { width: signatureWidth, align: 'right' });

  doc.fillColor(LABEL_TEXT_COLOR).font('Helvetica').fontSize(8)
    .text(disclaimer || `This is a computer-generated document issued by ${resolvedSettings.company_name}.`, PAGE_MARGIN, signatureLineY + 28, {
      width: 595 - 2 * PAGE_MARGIN,
      align: 'center'
    });

  return footerY + FOOTER_HEIGHT; // Return the Y-coordinate after the footer area
}

function generateInvoicePdf(invoice, items, outputStream, settings = company) {
  const resolvedSettings = normalizeSettings(settings);
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
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

  let currentY = drawCompanyHeader(doc, resolvedSettings, 'TAX INVOICE');

  currentY = drawCustomerSection(doc, {
    customer_name: invoice.customer_name,
    mobile_number: invoice.mobile_number,
    site_address: invoice.site_address,
    gst_number: invoice.gst_number // Assuming invoice might have customer's GST
  }, currentY, 'Billed To', [
    ['Invoice No', invoice.invoice_number || '-'],
    ['Invoice Date', formatDocumentDate(invoice.invoice_date)],
    ['Payment Status', invoice.payment_status || 'Unpaid']
  ]);

  currentY = drawInvoiceItemsTable(doc, items, currentY);
  currentY += 12;

  currentY = drawFinancialSummarySection(doc, invoice, currentY);
  currentY = drawTextSection(doc, 'Notes', invoice.notes || '-', currentY, (595 - 2 * PAGE_MARGIN) / 2 - 10); // Left half
  currentY = drawTextSection(doc, 'Terms & Conditions', invoice.terms_conditions || resolvedSettings.terms_conditions || '-', currentY, (595 - 2 * PAGE_MARGIN) / 2 - 10); // Left half
  currentY = drawPaymentDetailsSection(doc, invoice, resolvedSettings, currentY);
  currentY = drawQrCodeSection(doc, resolvedSettings, currentY);
  drawDocumentFooter(doc, resolvedSettings, currentY, 'Prepared by', 'Customer Signature', `This is a computer-generated tax invoice issued by ${resolvedSettings.company_name}.`);

  doc.end();
  return doc;
}

function generateQuotationPdf(quotation, items, outputStream, settings = company) {
  const resolvedSettings = normalizeSettings(settings); // Ensure settings are normalized
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
  if (outputStream) {
    doc.pipe(outputStream);
  }

  let currentY = drawCompanyHeader(doc, resolvedSettings, 'QUOTATION', 'Customer approval document');

  currentY = drawCustomerSection(doc, {
    customer_name: quotation.customer_name,
    mobile_number: quotation.mobile_number,
    site_address: quotation.site_address,
    gst_number: quotation.gst_number // Assuming quotation might have customer's GST
  }, currentY, 'Prepared For', [
    ['Quotation No', quotation.quotation_number],
    ['Quotation Date', formatDocumentDate(quotation.quotation_date)],
    ['Status', quotation.status || 'Quotation Created']
  ]);

  const tableWidth = 595 - 2 * PAGE_MARGIN;
  const columns = [
    { label: 'Product', x: PAGE_MARGIN + 8, width: 142 },
    { label: 'Size (mm)', x: PAGE_MARGIN + 158, width: 84 },
    { label: 'Qty', x: PAGE_MARGIN + 248, width: 36, align: 'right' },
    { label: 'Sq.Ft', x: PAGE_MARGIN + 292, width: 58, align: 'right' },
    { label: 'Rate', x: PAGE_MARGIN + 358, width: 62, align: 'right' },
    { label: 'Amount', x: PAGE_MARGIN + 427, width: 76, align: 'right' }
  ];

  currentY = drawItemsTable(doc, items, currentY, columns, (item) => ([ // Use the shared drawItemsTable
    item.product_type,
    `${item.width_mm} x ${item.height_mm}`,
    String(item.quantity),
    Number(item.total_sqft).toFixed(3),
    currency(item.rate_per_sqft),
    currency(item.product_amount)
  ]), tableWidth);

  currentY += 14;
  if (currentY > doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT - 200) { // Ensure enough space for summary and notes
    doc.addPage();
    currentY = PAGE_MARGIN;
  }

  const panelWidth = (595 - 2 * PAGE_MARGIN) / 2 - 10;
  const summaryX = PAGE_MARGIN + (595 - 2 * PAGE_MARGIN) / 2 + 10;
  const summaryWidth = panelWidth;

  const notesTermsY = drawTextPanel(doc, PAGE_MARGIN, currentY, panelWidth, 'Commercial Notes', [
    ['Notes', quotation.notes || '-'],
    ['Terms & Conditions', quotation.terms_conditions || resolvedSettings.terms_conditions || '-']
  });

  drawSummaryBox(doc, {
    // This will be replaced by drawFinancialSummaryCard
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
  
  // Use the new drawTextPanel and drawFinancialSummaryCard
  currentY = drawTextPanel(doc, PAGE_MARGIN, currentY, panelWidth, 'Commercial Notes', [
    ['Notes', quotation.notes || '-'],
    ['Terms & Conditions', quotation.terms_conditions || resolvedSettings.terms_conditions || '-']
  ]);

  drawFinancialSummaryCard(doc, summaryX, currentY, summaryWidth, 'Quotation Summary', [
    ['Product Subtotal', items.reduce((sum, item) => sum + Number(item.product_amount || 0), 0)],
    ['TRANSPORTATION', quotation.transportation_charges],
    ['Installation', quotation.installation_charges],
    ['Manufacturing', quotation.manufacturing_charges],
    ['Discount', -Number(quotation.discount || 0)],
    [`GST (${quotation.gst_percent}%)`, quotation.gst_amount],
  ], quotation.grand_total);

  // Use the new drawDocumentFooter
  drawDocumentFooter(doc, resolvedSettings, Math.max(notesTermsY, currentY + summaryWidth), 'Prepared by', 'Customer Acceptance', `Prepared by ${resolvedSettings.company_name} for project review, approval and execution planning.`);

  doc.end();
  return doc;
}

module.exports = {
  company,
  generateInvoicePdf,
  generateQuotationPdf,
  currency,
  formatDocumentDate,
  normalizeSettings,
  drawCompanyHeader,
  drawCustomerSection,
  drawItemsTable,
  drawFinancialSummaryCard,
  drawTextSection,
  drawPaymentDetailsSection,
  drawQrCodeSection,
  drawDocumentFooter
};
