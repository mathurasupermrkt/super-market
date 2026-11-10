export function initPurchaseModule() {
  window._currentPurchaseBill = [];
  let _savingPurchase = false; // Prevent duplicate submissions
  let _addingProduct = false; // Prevent double-trigger from onclick + addEventListener

  // Firestore transaction / batch operation limit
  const FIRESTORE_MAX_OPS = 500;

  // ── Load Categories into Purchase Entry Dropdown ──────────────────────
  window.loadPurchaseCategories = async function() {
    const select = document.getElementById('pe-prod-category');
    if (!select) return;

    // Show loading state
    const currentVal = select.value;
    select.innerHTML = '<option value="">Loading categories...</option>';
    select.disabled = true;

    // 1. Try Firestore first
    if (window.FirebaseDB && window.Firestore) {
      const fs = window.Firestore;
      const db = window.FirebaseDB;
      try {
        const snap = await fs.getDocs(fs.collection(db, 'categories'));
        const cats = [];
        snap.forEach(doc => {
          const c = { docId: doc.id, ...doc.data() };
          if (c.name) cats.push(c);
        });

        if (cats.length > 0) {
          cats.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
          select.innerHTML = '<option value="">Select Category...</option>' +
            cats.map(c => `<option value="${c.name}" data-id="${c.id || c.docId}">${c.icon ? c.icon + ' ' : ''}${c.name}</option>`).join('');
          select.disabled = false;
          if (currentVal) select.value = currentVal;
          return;
        }
      } catch (e) {
        console.warn('Error loading categories from Firestore, falling back to API.categories:', e);
      }
    }

    // 2. Fallback: use cached API.categories
    if (window.API && Array.isArray(window.API.categories) && window.API.categories.length > 0) {
      const cats = window.API.categories.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      select.innerHTML = '<option value="">Select Category...</option>' +
        cats.map(c => `<option value="${c.name}" data-id="${c.id}">${c.icon ? c.icon + ' ' : ''}${c.name}</option>`).join('');
      select.disabled = false;
      if (currentVal) select.value = currentVal;
      return;
    }

    // 3. Empty or offline state
    select.innerHTML = '<option value="">No categories available</option>';
    select.disabled = false;
  };

  // ── Load Unique Brands into Purchase Entry Dropdown ───────────────────
  window.loadPurchaseBrands = async function(forceRefresh = false) {
    const select = document.getElementById('pe-prod-brand');
    if (!select) return;

    const currentVal = select.value;

    if (!forceRefresh && window._cachedPurchaseBrands && window._cachedPurchaseBrands.length > 0) {
      renderBrandSelectOptions(currentVal);
      return;
    }

    const brandMap = new Map(); // lowercase -> original name

    // 1. Fetch from Firestore products collection (Requirement: unique brands from products)
    if (window.FirebaseDB && window.Firestore) {
      const fs = window.Firestore;
      const db = window.FirebaseDB;
      try {
        const prodSnap = await fs.getDocs(fs.collection(db, 'products'));
        prodSnap.forEach(d => {
          const data = d.data();
          const b = (data.brand || data.brandName || '').trim();
          if (b && !brandMap.has(b.toLowerCase())) {
            brandMap.set(b.toLowerCase(), b);
          }
        });
      } catch (err) {
        console.warn("Notice: could not load brands from products collection:", err);
      }

      // Also check Firestore brands collection
      try {
        const brandSnap = await fs.getDocs(fs.collection(db, 'brands'));
        brandSnap.forEach(d => {
          const b = (d.data().name || '').trim();
          if (b && !brandMap.has(b.toLowerCase())) {
            brandMap.set(b.toLowerCase(), b);
          }
        });
      } catch (err) {
        console.warn("Notice: could not load brands collection:", err);
      }
    }

    // 2. Also incorporate API.brands from memory
    if (window.API && Array.isArray(window.API.brands)) {
      window.API.brands.forEach(b => {
        const name = (b.name || '').trim();
        if (name && !brandMap.has(name.toLowerCase())) {
          brandMap.set(name.toLowerCase(), name);
        }
      });
    }

    // 3. Also incorporate brands from API.products in memory
    if (window.API && Array.isArray(window.API.products)) {
      window.API.products.forEach(p => {
        const name = (p.brand || '').trim();
        if (name && !brandMap.has(name.toLowerCase())) {
          brandMap.set(name.toLowerCase(), name);
        }
      });
    }

    const brandList = Array.from(brandMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    window._cachedPurchaseBrands = brandList;
    renderBrandSelectOptions(currentVal);
  };

  function renderBrandSelectOptions(selectedBrand = '') {
    const select = document.getElementById('pe-prod-brand');
    if (!select) return;

    const brands = window._cachedPurchaseBrands || [];
    let html = '<option value="">Select Brand...</option>';
    brands.forEach(b => {
      html += `<option value="${b}">${b}</option>`;
    });
    html += '<option value="__new__">➕ Add New Brand...</option>';

    select.innerHTML = html;

    if (selectedBrand && (brands.includes(selectedBrand) || selectedBrand === '__new__')) {
      select.value = selectedBrand;
    } else {
      select.value = '';
    }

    // Toggle custom input visibility
    const newBrandInput = document.getElementById('pe-new-brand-input');
    if (newBrandInput) {
      if (select.value === '__new__') {
        newBrandInput.classList.remove('hidden');
      } else {
        newBrandInput.classList.add('hidden');
      }
    }
  }

  // ── Brand Change Handler (handles inline "+ Add New Brand") ──────────
  window.handlePurchaseBrandChange = function(selectEl) {
    const newBrandInput = document.getElementById('pe-new-brand-input');
    if (!newBrandInput) return;

    if (selectEl.value === '__new__') {
      newBrandInput.classList.remove('hidden');
      newBrandInput.focus();
    } else {
      newBrandInput.classList.add('hidden');
      newBrandInput.value = '';
    }
  };

  // ── Render Purchase Entry Tab ─────────────────────────────────────────
  window.renderAdminPurchaseEntry = async function() {
    // Populate suppliers dropdown (fetches if cache empty)
    const supSelect = document.getElementById('pe-supplier');
    if (supSelect) {
      if (!window._cachedSuppliers || window._cachedSuppliers.length === 0) {
        if (window.FirebaseDB && window.Firestore) {
          try {
            const fs = window.Firestore;
            const db = window.FirebaseDB;
            const supSnap = await fs.getDocs(fs.collection(db, 'suppliers'));
            const sups = [];
            supSnap.forEach(d => sups.push({ id: d.id, ...d.data() }));
            window._cachedSuppliers = sups;
          } catch (e) {
            console.warn("Could not fetch suppliers directly:", e);
          }
        }
      }
      if (window._cachedSuppliers && window._cachedSuppliers.length > 0) {
        const curSup = supSelect.value;
        supSelect.innerHTML = '<option value="">Select Supplier...</option>' + 
          window._cachedSuppliers.map(s => `<option value="${s.id}">${s.company || s.name}</option>`).join('');
        if (curSup) supSelect.value = curSup;
      }
    }
    
    // Set default date to today
    const dateInput = document.getElementById('pe-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Load categories and brands
    window.loadPurchaseCategories();
    window.loadPurchaseBrands();

    // Render table
    renderPurchaseBillItems();
  };

  // ── Add Product to Bill ───────────────────────────────────────────────
  window.addPurchaseEntryProduct = function() {
    if (_addingProduct) return;
    _addingProduct = true;
    setTimeout(() => { _addingProduct = false; }, 200);

    const barcode = (document.getElementById('pe-prod-barcode')?.value || '').trim();
    const name = (document.getElementById('pe-prod-name')?.value || '').trim();
    const categorySelect = document.getElementById('pe-prod-category');
    const category = categorySelect?.value || '';
    const categoryId = categorySelect?.selectedOptions?.[0]?.dataset?.id || '';

    // Handle Brand (Select or Custom New Brand)
    const brandSelect = document.getElementById('pe-prod-brand');
    const newBrandInput = document.getElementById('pe-new-brand-input');
    let brand = '';

    if (brandSelect) {
      if (brandSelect.value === '__new__') {
        brand = (newBrandInput?.value || '').trim();
        if (!brand) {
          if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Please enter a name for the new brand', 'warning');
          newBrandInput?.focus();
          return;
        }
        // Add new brand to cached list so it becomes a regular option
        if (!window._cachedPurchaseBrands) window._cachedPurchaseBrands = [];
        if (!window._cachedPurchaseBrands.some(b => b.toLowerCase() === brand.toLowerCase())) {
          window._cachedPurchaseBrands.push(brand);
          window._cachedPurchaseBrands.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          renderBrandSelectOptions(brand);
        }
      } else {
        brand = brandSelect.value.trim();
      }
    }

    const unit = (document.getElementById('pe-prod-unit')?.value || '').trim();
    const qtyInput = document.getElementById('pe-prod-qty');
    const qty = parseInt(qtyInput?.value, 10);
    const buyPrice = parseFloat(document.getElementById('pe-prod-buy')?.value);
    const sellPrice = parseFloat(document.getElementById('pe-prod-sell')?.value);
    const mrp = parseFloat(document.getElementById('pe-prod-mrp')?.value) || 0;
    const batchNo = (document.getElementById('pe-prod-batch')?.value || '').trim();
    const expiry = document.getElementById('pe-prod-expiry')?.value || '';
    const gst = parseFloat(document.getElementById('pe-prod-gst')?.value) || 0;

    // ── Field Validations ──
    if (!name) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Please enter a Product Name', 'warning');
      document.getElementById('pe-prod-name')?.focus();
      return;
    }
    if (!category) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Please select a valid Category', 'warning');
      categorySelect?.focus();
      return;
    }
    if (isNaN(buyPrice) || buyPrice <= 0) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Buy Price must be greater than 0', 'warning');
      document.getElementById('pe-prod-buy')?.focus();
      return;
    }
    if (isNaN(sellPrice) || sellPrice <= 0) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Sell Price must be greater than 0', 'warning');
      document.getElementById('pe-prod-sell')?.focus();
      return;
    }
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Quantity must be an integer of at least 1', 'warning');
      qtyInput?.focus();
      return;
    }
    if (isNaN(gst) || gst < 0 || gst > 100) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('GST must be between 0 and 100%', 'warning');
      document.getElementById('pe-prod-gst')?.focus();
      return;
    }
    if (isNaN(mrp) || mrp < 0) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('MRP cannot be negative', 'warning');
      document.getElementById('pe-prod-mrp')?.focus();
      return;
    }
    if (mrp > 0 && mrp < sellPrice) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('MRP cannot be less than Sell Price', 'warning');
      document.getElementById('pe-prod-mrp')?.focus();
      return;
    }

    const finalMrp = mrp > 0 ? mrp : sellPrice;
    const itemTotal = (buyPrice * qty) * (1 + gst / 100);

    // Add item to bill array
    window._currentPurchaseBill.push({
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      barcode,
      name,
      category,
      categoryId,
      brand,
      unit,
      qty,
      buyPrice,
      sellPrice,
      mrp: finalMrp,
      batch: batchNo,
      expiry,
      gst,
      itemTotal
    });

    // Re-render items and totals
    renderPurchaseBillItems();

    // Show success message
    if (window.MathuraQuickMart) {
      window.MathuraQuickMart.toast(`Added "${name}" to bill`, 'success');
    }

    // Clear product-specific inputs while PRESERVING category and brand selections
    ['barcode', 'name', 'unit', 'buy', 'sell', 'mrp', 'batch', 'expiry'].forEach(id => {
      const el = document.getElementById('pe-prod-' + id);
      if (el) el.value = '';
    });
    if (qtyInput) qtyInput.value = 1;
    const gstInput = document.getElementById('pe-prod-gst');
    if (gstInput) gstInput.value = 0;
  };

  // ── Remove Product from Bill ──────────────────────────────────────────
  window.removePurchaseEntryProduct = function(index) {
    if (index >= 0 && index < window._currentPurchaseBill.length) {
      window._currentPurchaseBill.splice(index, 1);
      renderPurchaseBillItems();
    }
  };

  // ── Render Bill Items Table & Recalculate Grand Total ──────────────────
  function renderPurchaseBillItems() {
    const tbody = document.getElementById('pe-items-tbody');
    const grandTotalEl = document.getElementById('pe-grand-total');
    if (!tbody) return;

    if (!window._currentPurchaseBill || window._currentPurchaseBill.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No items added yet</td></tr>';
      if (grandTotalEl) grandTotalEl.textContent = '₹0';
      return;
    }

    let grandTotal = 0;
    tbody.innerHTML = window._currentPurchaseBill.map((item, index) => {
      grandTotal += (item.itemTotal || 0);
      return `
      <tr>
        <td><strong>${item.name}</strong>${item.barcode ? `<br><small style="color:var(--gray-500);">${item.barcode}</small>` : ''}</td>
        <td>${item.qty} ${item.unit || ''}</td>
        <td>₹${item.buyPrice.toFixed(2)}</td>
        <td>${item.gst}%</td>
        <td>₹${item.itemTotal.toFixed(2)}</td>
        <td>₹${item.sellPrice.toFixed(2)}</td>
        <td><button type="button" class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="removePurchaseEntryProduct(${index})">🗑️</button></td>
      </tr>
    `}).join('');
    
    if (grandTotalEl) grandTotalEl.textContent = '₹' + grandTotal.toFixed(2);
  }

  // ── Save Purchase Bill (Atomic Transaction + Safe Product Aggregation) ─
  window.savePurchaseBill = async function() {
    if (!window.FirebaseDB || !window.Firestore) {
      if (window.MathuraQuickMart) {
        window.MathuraQuickMart.toast('Database connection is not ready. Please wait...', 'error');
      }
      return;
    }

    // Prevent duplicate submissions
    if (_savingPurchase) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Save already in progress...', 'info');
      return;
    }
    
    const supplierId = (document.getElementById('pe-supplier')?.value || '').trim();
    const date = (document.getElementById('pe-date')?.value || '').trim();
    const notes = (document.getElementById('pe-notes')?.value || '').trim();
    
    if (!supplierId) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Please select a supplier.', 'warning');
      document.getElementById('pe-supplier')?.focus();
      return;
    }
    if (!date) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Please enter a purchase date.', 'warning');
      document.getElementById('pe-date')?.focus();
      return;
    }
    if (!window._currentPurchaseBill || window._currentPurchaseBill.length === 0) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Add at least one product to the bill.', 'warning');
      return;
    }

    // 500-operation guard
    const totalOps = 1 + window._currentPurchaseBill.length;
    if (totalOps > FIRESTORE_MAX_OPS) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast(
        `Too many items (${window._currentPurchaseBill.length}). Maximum ${FIRESTORE_MAX_OPS - 1} products per bill.`, 'error');
      return;
    }

    const fs = window.Firestore;
    const db = window.FirebaseDB;
    
    // Get supplier name
    const supplierName = window._cachedSuppliers?.find(s => s.id === supplierId)?.company || 
                         window._cachedSuppliers?.find(s => s.id === supplierId)?.name || 'Unknown Supplier';
    
    let grandTotal = window._currentPurchaseBill.reduce((sum, i) => sum + (i.itemTotal || 0), 0);
    
    const billData = {
      billNumber: 'PB-' + Date.now(),
      supplierId,
      supplierName,
      date,
      notes,
      totalAmount: Number(grandTotal.toFixed(2)) || 0,
      items: window._currentPurchaseBill.map(i => ({
        id: i.id || 'prod_' + Date.now(),
        barcode: i.barcode || '',
        name: i.name || '',
        category: i.category || '',
        categoryId: i.categoryId || '',
        brand: i.brand || '',
        unit: i.unit || '',
        qty: parseInt(i.qty) || 1,
        buyPrice: parseFloat(i.buyPrice) || 0,
        sellPrice: parseFloat(i.sellPrice) || 0,
        mrp: parseFloat(i.mrp) || parseFloat(i.sellPrice) || 0,
        batch: i.batch || '',
        expiry: i.expiry || '',
        gst: parseFloat(i.gst) || 0,
        itemTotal: parseFloat(i.itemTotal) || 0
      })),
      status: 'Paid',
      createdAt: fs.serverTimestamp()
    };

    _savingPurchase = true;
    const saveBtn = document.getElementById('admin-save-purchase-btn') || 
                    document.querySelector('button[onclick*="savePurchaseBill"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.dataset.origText = saveBtn.textContent;
      saveBtn.textContent = '⏳ Saving Purchase...';
    }

    try {
      // Step 1: Query existing products outside transaction
      const productLookups = [];
      for (const item of window._currentPurchaseBill) {
        let q = null;
        if (item.barcode) {
          q = fs.query(fs.collection(db, 'products'), fs.where('barcode', '==', item.barcode));
        } else {
          q = fs.query(fs.collection(db, 'products'), fs.where('name', '==', item.name));
        }
        productLookups.push(fs.getDocs(q));
      }
      const lookupResults = await Promise.all(productLookups);

      // Step 2: Consolidate updates per product to avoid double-write conflicts if the same product is added twice
      const existingProductMap = new Map(); // docRefPath -> { ref, totalQty, latestItem }
      const newProductMap = new Map();      // uniqueKey (barcode or name) -> { totalQty, latestItem }

      for (let i = 0; i < window._currentPurchaseBill.length; i++) {
        const item = window._currentPurchaseBill[i];
        const snap = lookupResults[i];

        if (!snap.empty) {
          const docRef = snap.docs[0].ref;
          const key = docRef.path;
          if (existingProductMap.has(key)) {
            const entry = existingProductMap.get(key);
            entry.totalQty += item.qty;
            entry.latestItem = item;
          } else {
            existingProductMap.set(key, { ref: docRef, totalQty: item.qty, latestItem: item });
          }
        } else {
          const key = (item.barcode || item.name).toLowerCase();
          if (newProductMap.has(key)) {
            const entry = newProductMap.get(key);
            entry.totalQty += item.qty;
            entry.latestItem = item;
          } else {
            newProductMap.set(key, { totalQty: item.qty, latestItem: item });
          }
        }
      }

      const consolidatedExisting = Array.from(existingProductMap.values());
      const consolidatedNew = Array.from(newProductMap.values());

      // Step 3: Run atomic Firestore transaction
      await fs.runTransaction(db, async (transaction) => {
        // 3a. READ PHASE: All reads must occur before any writes
        const freshReads = [];
        for (const entry of consolidatedExisting) {
          freshReads.push(transaction.get(entry.ref));
        }
        const freshDocs = await Promise.all(freshReads);

        // 3b. WRITE PHASE: Writes begin
        const billRef = fs.doc(fs.collection(db, 'purchaseBills'));
        transaction.set(billRef, billData);

        // Update existing products with cumulative stock
        for (let i = 0; i < consolidatedExisting.length; i++) {
          const { ref, totalQty, latestItem } = consolidatedExisting[i];
          const freshDoc = freshDocs[i];
          const hasDoc = typeof freshDoc.exists === 'function' ? freshDoc.exists() : Boolean(freshDoc.exists);
          const currentStock = (hasDoc && freshDoc.data().stock ? parseInt(freshDoc.data().stock) : 0) || 0;

          transaction.update(ref, {
            stock: currentStock + totalQty,
            purchasePrice: latestItem.buyPrice,
            price: latestItem.sellPrice,
            mrp: latestItem.mrp || latestItem.sellPrice,
            batch: latestItem.batch || '',
            expiry: latestItem.expiry || '',
            supplierId: supplierId || '',
            supplierName: supplierName || '',
            category: latestItem.category || '',
            categoryId: latestItem.categoryId || '',
            brand: latestItem.brand || '',
            updatedAt: fs.serverTimestamp()
          });
        }

        // Create new products with consolidated stock
        for (const { totalQty, latestItem } of consolidatedNew) {
          const newProductRef = fs.doc(fs.collection(db, 'products'));
          transaction.set(newProductRef, {
            name: latestItem.name,
            barcode: latestItem.barcode || '',
            category: latestItem.category || '',
            categoryId: latestItem.categoryId || '',
            brand: latestItem.brand || '',
            unit: latestItem.unit || '',
            stock: totalQty,
            purchasePrice: latestItem.buyPrice,
            price: latestItem.sellPrice,
            mrp: latestItem.mrp || latestItem.sellPrice,
            batch: latestItem.batch || '',
            expiry: latestItem.expiry || '',
            gst: latestItem.gst || 0,
            supplierId: supplierId || '',
            supplierName: supplierName || '',
            image: '',
            createdAt: fs.serverTimestamp(),
            updatedAt: fs.serverTimestamp()
          });
        }
      });

      // Clear current bill ONLY on confirmed success
      window._currentPurchaseBill = [];
      renderPurchaseBillItems();
      const notesEl = document.getElementById('pe-notes');
      if (notesEl) notesEl.value = '';

      if (window.MathuraQuickMart) {
        window.MathuraQuickMart.toast('Purchase Bill Saved successfully! Stock updated.', 'success');
      }

      // Refresh Inventory and Purchase History views immediately
      if (window.renderAdminInventory) window.renderAdminInventory();
      if (window.renderAdminPurchaseBills) window.renderAdminPurchaseBills();
      
    } catch (e) {
      console.error('Error saving purchase bill:', e);
      const errMsg = e?.message || e?.code || String(e);
      if (window.MathuraQuickMart) {
        window.MathuraQuickMart.toast('Error saving purchase bill: ' + errMsg, 'error');
      }
    } finally {
      _savingPurchase = false;
      const btn = document.getElementById('admin-save-purchase-btn') || 
                  document.querySelector('button[onclick*="savePurchaseBill"]');
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
      }
    }
  };

  // ── Render Purchase Bills History ─────────────────────────────────────
  window.renderAdminPurchaseBills = async function() {
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'purchaseBills'), fs.orderBy('createdAt', 'desc')));
      const billMap = new Map();
      snap.forEach(doc => {
        const b = { id: doc.id, ...doc.data() };
        const key = String(b.id || b.billNumber || doc.id);
        if (!billMap.has(key)) billMap.set(key, b);
      });
      const bills = Array.from(billMap.values());

      window._cachedPurchaseBills = bills;

      const tbody = document.getElementById('admin-pb-tbody');
      if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No purchase bills found.</td></tr>';
        return;
      }
      
      tbody.innerHTML = bills.map(b => `
        <tr>
          <td><strong>${b.billNumber}</strong></td>
          <td>${b.date || 'N/A'}</td>
          <td>${b.supplierName || 'Unknown'}</td>
          <td>${b.items ? b.items.length : 0} items</td>
          <td><strong>₹${(b.totalAmount || 0).toFixed(2)}</strong></td>
          <td><span class="badge badge-green">${b.status || 'Paid'}</span></td>
          <td>
            <button type="button" class="btn btn-ghost btn-sm" title="View Details" onclick="viewPurchaseBillDetails('${b.id}')">👁️</button>
            <button type="button" class="btn btn-ghost btn-sm" title="Print Bill" onclick="MathuraQuickMart.toast('Printing Bill...', 'info')">🖨️</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error("Error loading purchase bills:", e);
    }
  };

  // ── View Purchase Bill Details Modal ──────────────────────────────────
  window.viewPurchaseBillDetails = function(billId) {
    const bill = (window._cachedPurchaseBills || []).find(b => b.id === billId);
    if (!bill) return;

    const sub = document.getElementById('pb-modal-subtitle');
    if (sub) sub.textContent = `Bill #${bill.billNumber || bill.id}`;
    const sup = document.getElementById('pb-modal-supplier');
    if (sup) sup.textContent = bill.supplierName || 'N/A';
    const dt = document.getElementById('pb-modal-date');
    if (dt) dt.textContent = bill.date || 'N/A';
    const st = document.getElementById('pb-modal-status');
    if (st) st.textContent = bill.status || 'Paid';
    
    const notesBox = document.getElementById('pb-modal-notes-box');
    const notesEl = document.getElementById('pb-modal-notes');
    if (notesBox && notesEl) {
      if (bill.notes && bill.notes.trim()) {
        notesEl.textContent = bill.notes;
        notesBox.classList.remove('hidden');
      } else {
        notesBox.classList.add('hidden');
      }
    }

    const items = bill.items || [];
    const tbody = document.getElementById('pb-modal-tbody');
    if (tbody) {
      tbody.innerHTML = items.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No items recorded</td></tr>' :
        items.map(item => `
          <tr>
            <td><strong>${item.name || 'Unnamed'}</strong>${item.barcode ? `<br><small style="color:var(--gray-500);">${item.barcode}</small>` : ''}</td>
            <td>${item.category || 'N/A'}</td>
            <td>${item.qty || 1} ${item.unit || ''}</td>
            <td>₹${(item.buyPrice || 0).toFixed(2)}</td>
            <td>${item.gst || 0}%</td>
            <td>₹${(item.itemTotal || 0).toFixed(2)}</td>
          </tr>
        `).join('');
    }

    const countEl = document.getElementById('pb-modal-item-count');
    if (countEl) countEl.textContent = `${items.length} items`;
    const grandEl = document.getElementById('pb-modal-grand-total');
    if (grandEl) grandEl.textContent = `₹${(bill.totalAmount || 0).toFixed(2)}`;

    const modal = document.getElementById('purchase-bill-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closePurchaseBillModal = function() {
    const modal = document.getElementById('purchase-bill-modal');
    if (modal) modal.classList.add('hidden');
  };

  // ── Attach Explicit Button Listeners on ID if Available ──────────────
  const addBtn = document.getElementById('pe-add-to-bill-btn');
  if (addBtn && !addBtn._hasAddListener) {
    addBtn._hasAddListener = true;
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.addPurchaseEntryProduct();
    });
  }

  const saveBtn = document.getElementById('admin-save-purchase-btn');
  if (saveBtn && !saveBtn._hasSaveListener) {
    saveBtn._hasSaveListener = true;
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.savePurchaseBill();
    });
  }
}
