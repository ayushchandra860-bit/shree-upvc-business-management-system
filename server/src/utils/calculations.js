const SQMM_PER_SQFT = 92903.04;

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toArea(value) {
  return Number(Number(value || 0).toFixed(3));
}

function calculateQuotation(items, charges = {}) {
  const calculatedItems = items.map((item) => {
    const width = Number(item.width_mm);
    const height = Number(item.height_mm);
    const quantity = Number(item.quantity);
    const rate = Number(item.rate_per_sqft);
    const areaSqft = width * height / SQMM_PER_SQFT;
    const totalSqft = areaSqft * quantity;
    const productAmount = totalSqft * rate;

    return {
      ...item,
      width_mm: width,
      height_mm: height,
      quantity,
      rate_per_sqft: toMoney(rate),
      area_sqft: toArea(areaSqft),
      total_sqft: toArea(totalSqft),
      product_amount: toMoney(productAmount)
    };
  });

  const productTotal = calculatedItems.reduce((sum, item) => sum + Number(item.product_amount), 0);
  const transportation = Number(charges.transportation_charges || 0);
  const installation = Number(charges.installation_charges || 0);
  const manufacturing = Number(charges.manufacturing_charges || 0);
  const discount = Number(charges.discount || 0);
  const gstPercent = Number(charges.gst_percent ?? 18);
  const subtotal = Math.max(productTotal + transportation + installation + manufacturing - discount, 0);
  const gstAmount = subtotal * gstPercent / 100;
  const grandTotal = subtotal + gstAmount;

  return {
    items: calculatedItems,
    totals: {
      subtotal: toMoney(subtotal),
      gst_percent: toMoney(gstPercent),
      gst_amount: toMoney(gstAmount),
      grand_total: toMoney(grandTotal)
    }
  };
}

module.exports = {
  SQMM_PER_SQFT,
  calculateQuotation,
  toMoney
};
