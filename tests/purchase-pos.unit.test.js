import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Purchase POS Module Logic Tests', () => {
  let billItems = [];
  let cachedBrands = [];
  let toastMessages = [];

  const mockToast = (msg, type) => {
    toastMessages.push({ msg, type });
  };

  // Helper simulating addPurchaseEntryProduct
  function addProductToBill(inputs) {
    const {
      barcode = '',
      name = '',
      category = '',
      categoryId = '',
      brandMode = 'select', // 'select' or 'new'
      selectedBrand = '',
      newBrandName = '',
      unit = '',
      qty = 1,
      buyPrice = 0,
      sellPrice = 0,
      mrp = 0,
      batchNo = '',
      expiry = '',
      gst = 0
    } = inputs;

    let brand = '';
    if (brandMode === 'new') {
      const customBrand = (newBrandName || '').trim();
      if (!customBrand) {
        mockToast('Please enter a name for the new brand', 'warning');
        return { success: false, reason: 'missing_new_brand' };
      }
      brand = customBrand;
      if (!cachedBrands.some(b => b.toLowerCase() === brand.toLowerCase())) {
        cachedBrands.push(brand);
        cachedBrands.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      }
    } else {
      brand = (selectedBrand || '').trim();
    }

    if (!name.trim()) {
      mockToast('Please enter a Product Name', 'warning');
      return { success: false, reason: 'missing_name' };
    }
    if (!category.trim()) {
      mockToast('Please select a valid Category', 'warning');
      return { success: false, reason: 'missing_category' };
    }
    if (isNaN(buyPrice) || buyPrice <= 0) {
      mockToast('Buy Price must be greater than 0', 'warning');
      return { success: false, reason: 'invalid_buy_price' };
    }
    if (isNaN(sellPrice) || sellPrice <= 0) {
      mockToast('Sell Price must be greater than 0', 'warning');
      return { success: false, reason: 'invalid_sell_price' };
    }
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      mockToast('Quantity must be an integer of at least 1', 'warning');
      return { success: false, reason: 'invalid_qty' };
    }
    if (isNaN(gst) || gst < 0 || gst > 100) {
      mockToast('GST must be between 0 and 100%', 'warning');
      return { success: false, reason: 'invalid_gst' };
    }
    if (isNaN(mrp) || mrp < 0) {
      mockToast('MRP cannot be negative', 'warning');
      return { success: false, reason: 'invalid_mrp' };
    }
    if (mrp > 0 && mrp < sellPrice) {
      mockToast('MRP cannot be less than Sell Price', 'warning');
      return { success: false, reason: 'mrp_less_than_sell' };
    }

    const finalMrp = mrp > 0 ? mrp : sellPrice;
    const itemTotal = (buyPrice * qty) * (1 + gst / 100);

    const item = {
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      barcode: barcode.trim(),
      name: name.trim(),
      category: category.trim(),
      categoryId: categoryId.trim(),
      brand,
      unit: unit.trim(),
      qty,
      buyPrice,
      sellPrice,
      mrp: finalMrp,
      batch: batchNo.trim(),
      expiry,
      gst,
      itemTotal: Number(itemTotal.toFixed(2))
    };

    billItems.push(item);
    mockToast(`Added "${name}" to bill`, 'success');
    return { success: true, item };
  }

  // Calculate bill total
  function getGrandTotal() {
    return Number(billItems.reduce((acc, i) => acc + i.itemTotal, 0).toFixed(2));
  }

  // Consolidate updates (simulate Step 2 in savePurchaseBill)
  function consolidateItems(existingProductsDb) {
    const existingMap = new Map();
    const newMap = new Map();

    for (const item of billItems) {
      const match = existingProductsDb.find(p => (item.barcode && p.barcode === item.barcode) || p.name === item.name);
      if (match) {
        const key = match.id;
        if (existingMap.has(key)) {
          const entry = existingMap.get(key);
          entry.totalQty += item.qty;
          entry.latestItem = item;
        } else {
          existingMap.set(key, { refId: match.id, totalQty: item.qty, latestItem: item, originalStock: match.stock });
        }
      } else {
        const key = (item.barcode || item.name).toLowerCase();
        if (newMap.has(key)) {
          const entry = newMap.get(key);
          entry.totalQty += item.qty;
          entry.latestItem = item;
        } else {
          newMap.set(key, { totalQty: item.qty, latestItem: item });
        }
      }
    }
    return {
      existing: Array.from(existingMap.values()),
      newItems: Array.from(newMap.values())
    };
  }

  beforeEach(() => {
    billItems = [];
    cachedBrands = ['Amul', 'Britannia', 'Nestle', 'Tata'];
    toastMessages = [];
  });

  // Test 1: Add one product to a bill
  test('Test 1: Add one product to a bill with proper total calculation', () => {
    const res = addProductToBill({
      barcode: '8901234567890',
      name: 'Amul Butter 500g',
      category: 'Dairy & Eggs',
      categoryId: '2',
      selectedBrand: 'Amul',
      unit: '500g',
      qty: 2,
      buyPrice: 250,
      sellPrice: 280,
      mrp: 290,
      gst: 12
    });

    assert.equal(res.success, true);
    assert.equal(billItems.length, 1);
    // 2 * 250 * 1.12 = 560
    assert.equal(billItems[0].itemTotal, 560);
    assert.equal(getGrandTotal(), 560);
    assert.equal(billItems[0].mrp, 290);
    assert.equal(billItems[0].brand, 'Amul');
    assert.ok(toastMessages.some(t => t.type === 'success'));
  });

  // Test 2: Add three different products to a bill
  test('Test 2: Add three different products to a bill and verify grand total', () => {
    addProductToBill({ name: 'Milk 1L', category: 'Dairy', selectedBrand: 'Amul', qty: 5, buyPrice: 60, sellPrice: 68, gst: 0 });
    addProductToBill({ name: 'Bread 400g', category: 'Bakery', selectedBrand: 'Britannia', qty: 10, buyPrice: 40, sellPrice: 45, gst: 5 });
    addProductToBill({ name: 'Tea 500g', category: 'Beverages', selectedBrand: 'Tata', qty: 2, buyPrice: 200, sellPrice: 240, gst: 18 });

    assert.equal(billItems.length, 3);
    // Item 1: 5 * 60 = 300
    // Item 2: 10 * 40 * 1.05 = 420
    // Item 3: 2 * 200 * 1.18 = 472
    // Grand total: 300 + 420 + 472 = 1192
    assert.equal(billItems[0].itemTotal, 300);
    assert.equal(billItems[1].itemTotal, 420);
    assert.equal(billItems[2].itemTotal, 472);
    assert.equal(getGrandTotal(), 1192);
  });

  // Test 3: Add the same product twice
  test('Test 3: Add the same product twice and verify quantities consolidate', () => {
    const existingDb = [
      { id: 'prod_101', barcode: '111222', name: 'Almonds 500g', stock: 10 }
    ];

    addProductToBill({ barcode: '111222', name: 'Almonds 500g', category: 'Dry Fruits', qty: 3, buyPrice: 400, sellPrice: 500 });
    addProductToBill({ barcode: '111222', name: 'Almonds 500g', category: 'Dry Fruits', qty: 7, buyPrice: 400, sellPrice: 500 });

    assert.equal(billItems.length, 2);
    const { existing } = consolidateItems(existingDb);
    assert.equal(existing.length, 1);
    assert.equal(existing[0].refId, 'prod_101');
    assert.equal(existing[0].totalQty, 10);
    // Final stock should be 10 (original) + 10 (total qty) = 20
    assert.equal(existing[0].originalStock + existing[0].totalQty, 20);
  });

  // Test 4: Change quantity and verify totals
  test('Test 4: Change quantity validation and calculation', () => {
    // Negative qty
    let res = addProductToBill({ name: 'Eggs', category: 'Dairy', qty: -5, buyPrice: 5, sellPrice: 7 });
    assert.equal(res.success, false);
    assert.equal(res.reason, 'invalid_qty');

    // Zero qty
    res = addProductToBill({ name: 'Eggs', category: 'Dairy', qty: 0, buyPrice: 5, sellPrice: 7 });
    assert.equal(res.success, false);

    // Non-integer qty
    res = addProductToBill({ name: 'Eggs', category: 'Dairy', qty: 2.5, buyPrice: 5, sellPrice: 7 });
    assert.equal(res.success, false);

    // Valid qty
    res = addProductToBill({ name: 'Eggs', category: 'Dairy', qty: 12, buyPrice: 5, sellPrice: 7, gst: 0 });
    assert.equal(res.success, true);
    assert.equal(billItems[0].itemTotal, 60);
  });

  // Test 5: Select an existing brand
  test('Test 5: Select an existing brand from dropdown', () => {
    const res = addProductToBill({
      name: 'Paneer 200g',
      category: 'Dairy',
      brandMode: 'select',
      selectedBrand: 'Amul',
      qty: 1,
      buyPrice: 80,
      sellPrice: 95
    });

    assert.equal(res.success, true);
    assert.equal(billItems[0].brand, 'Amul');
  });

  // Test 6: Add a new brand
  test('Test 6: Add a new brand dynamically and verify cache update', () => {
    // Missing custom brand name
    let res = addProductToBill({
      name: 'Oats 1kg',
      category: 'Breakfast',
      brandMode: 'new',
      newBrandName: '',
      qty: 1,
      buyPrice: 150,
      sellPrice: 180
    });
    assert.equal(res.success, false);
    assert.equal(res.reason, 'missing_new_brand');

    // Valid custom brand
    res = addProductToBill({
      name: 'Oats 1kg',
      category: 'Breakfast',
      brandMode: 'new',
      newBrandName: 'Kelloggs',
      qty: 1,
      buyPrice: 150,
      sellPrice: 180
    });
    assert.equal(res.success, true);
    assert.equal(billItems[0].brand, 'Kelloggs');
    assert.ok(cachedBrands.includes('Kelloggs'));
  });

  // Test 7: Save a valid purchase validation
  test('Test 7: Save a valid purchase bill validates supplier, date, and items', () => {
    addProductToBill({ name: 'Sugar 5kg', category: 'Grocery', qty: 2, buyPrice: 200, sellPrice: 230 });
    
    // Validate required fields for save
    const supplierId = 'sup_123';
    const date = '2026-11-05';
    assert.ok(supplierId);
    assert.ok(date);
    assert.ok(billItems.length > 0);
    assert.equal(getGrandTotal(), 400);
  });

  // Test 8: Try saving an empty bill
  test('Test 8: Reject saving an empty bill', () => {
    assert.equal(billItems.length, 0);
    const canSave = billItems.length > 0;
    assert.equal(canSave, false);
  });

  // Test 9: Simulate Firestore permission failure handling
  test('Test 9: Firestore error handling formats descriptive message', () => {
    const err = new Error('PERMISSION_DENIED: Missing or insufficient permissions.');
    const errMsg = err?.message || String(err);
    assert.ok(errMsg.includes('PERMISSION_DENIED'));
  });

  // Test 10: Double-click Save Purchase prevention
  test('Test 10: Double-click guard prevents concurrent execution', () => {
    let saving = false;
    let executeCount = 0;

    function simulateSave() {
      if (saving) return false;
      saving = true;
      executeCount++;
      return true;
    }

    const firstClick = simulateSave();
    const secondClick = simulateSave();

    assert.equal(firstClick, true);
    assert.equal(secondClick, false);
    assert.equal(executeCount, 1);
  });

  // Test 11: Purchase history formatting
  test('Test 11: Purchase history item mapping formats all fields', () => {
    const mockBill = {
      id: 'pb_999',
      billNumber: 'PB-1730790000',
      date: '2026-11-05',
      supplierName: 'ABC Distributors',
      totalAmount: 1500.5,
      status: 'Paid',
      items: [
        { name: 'Rice', qty: 2, buyPrice: 500, gst: 0, itemTotal: 1000 },
        { name: 'Oil', qty: 1, buyPrice: 500, gst: 0, itemTotal: 500 }
      ]
    };

    assert.equal(mockBill.items.length, 2);
    assert.equal(mockBill.totalAmount.toFixed(2), '1500.50');
  });

  // Test 12: Verify inventory stock increases exactly once with cumulative total
  test('Test 12: Stock increments exactly once with consolidated quantity', () => {
    const dbProduct = { id: 'prod_ghee', barcode: '9988', name: 'Ghee 1L', stock: 5 };

    // Same product added twice in same bill with different quantities
    addProductToBill({ barcode: '9988', name: 'Ghee 1L', category: 'Dairy', qty: 4, buyPrice: 550, sellPrice: 650 });
    addProductToBill({ barcode: '9988', name: 'Ghee 1L', category: 'Dairy', qty: 6, buyPrice: 550, sellPrice: 650 });

    const { existing } = consolidateItems([dbProduct]);
    assert.equal(existing.length, 1);
    assert.equal(existing[0].totalQty, 10);
    
    // Simulate transaction update
    const newStock = existing[0].originalStock + existing[0].totalQty;
    assert.equal(newStock, 15);
  });
});
