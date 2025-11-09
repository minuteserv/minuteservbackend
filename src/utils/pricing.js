const TAX_FEE_SLABS = [
  { max: 400, fee: 59 },
  { max: 800, fee: 78 },
  { max: 1200, fee: 97 },
  { max: 1500, fee: 109 },
  { max: 2000, fee: 119 },
  { max: 2500, fee: 138 },
  { max: 3000, fee: 167 },
  { max: 3500, fee: 188 },
  { max: 4000, fee: 209 },
  { max: 5000, fee: 249 },
  { max: 6000, fee: 269 },
];

function getTaxFee(amount) {
  const value = Math.max(Number(amount) || 0, 0);
  if (value === 0) return 0;

  for (const slab of TAX_FEE_SLABS) {
    if (value <= slab.max) {
      return slab.fee;
    }
  }

  return 279;
}

/**
 * Calculate booking pricing
 */
function calculatePricing(services, promoDiscount = 0) {
  // Calculate subtotal
  // Support both 'product_cost' and 'price' fields
  const subtotal = services.reduce((sum, service) => {
    const cost = parseFloat(service.product_cost || service.price || 0);
    const quantity = service.quantity || 1;
    return sum + cost * quantity;
  }, 0);

  // Calculate savings (market_price - product_cost/price)
  const savings = services.reduce((sum, service) => {
    const cost = parseFloat(service.product_cost || service.price || 0);
    const marketPrice = parseFloat(service.market_price || 0);
    if (marketPrice && cost) {
      const saving = (marketPrice - cost) * (service.quantity || 1);
      return sum + (saving > 0 ? saving : 0);
    }
    return sum;
  }, 0);

  // Apply promo discount
  const discount = promoDiscount || 0;

  // Calculate final price before tax
  // Note: Savings are already shown separately, don't subtract from price
  const finalPrice = subtotal - discount;

  // Ensure final price is not negative
  const priceAfterDiscount = finalPrice > 0 ? finalPrice : 0;

  // Calculate tax/service fee based on slabs
  const tax = getTaxFee(priceAfterDiscount);

  // Calculate grand total
  const grandTotal = Math.floor((priceAfterDiscount + tax) * 100) / 100;

  return {
    subtotal: Math.floor(subtotal * 100) / 100,
    savings: Math.floor(savings * 100) / 100,
    discount: Math.floor(discount * 100) / 100,
    final_price: Math.floor(finalPrice * 100) / 100,
    tax: Math.floor(tax * 100) / 100,
    grand_total: grandTotal,
  };
}

module.exports = {
  calculatePricing,
};

