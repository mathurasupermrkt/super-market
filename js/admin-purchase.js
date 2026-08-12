export function initPurchaseModule() {
  window._currentPurchaseBill = [];
  
  window.renderAdminPurchaseEntry = function() {
    // Populate suppliers dropdown
    const select = document.getElementById('pe-supplier');
    if (select && window._cachedSuppliers) {
      select.innerHTML = '<option value="">Select Supplier...</option>' + 
        window._cachedSuppliers.map(s => `<option value="${s.id}">${s.company || s.name}</option>`).join('');
    }
    
    // Set default date to today
    const dateInput = document.getElementById('pe-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    renderPurchaseBillItems();
  };

  window.addPurchaseEntryProduct = function() {
    const barcode = document.getElementById('pe-prod-barcode').value;
    const name = document.getElementById('pe-prod-name').value;
    const category = document.getElementById('pe-prod-category').value;
    const brand = document.getElementById('pe-prod-brand').value;
    const unit = document.getElementById('pe-prod-unit').value;
    const qty = parseInt(document.getElementById('pe-prod-qty').value) || 1;
    const buyPrice = parseFloat(document.getElementById('pe-prod-buy').value) || 0;
    const sellPrice = parseFloat(document.getElementById('pe-prod-sell').value) || 0;
    const mrp = parseFloat(document.getElementById('pe-prod-mrp').value) || 0;
    const batch = document.getElementById('pe-prod-batch').value;
    const expiry = document.getElementById('pe-prod-expiry').value;
    const gst = parseFloat(document.getElementById('pe-prod-gst').value) || 0;

    if (!name || buyPrice <= 0 || sellPrice <= 0) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Please enter Name, Buy Price, and Sell Price', 'warning');
      return;
    }

    const itemTotal = (buyPrice * qty) * (1 + gst / 100);

    window._currentPurchaseBill.push({
      id: 'prod_' + Date.now(),
      barcode, name, category, brand, unit, qty, buyPrice, sellPrice, mrp, batch, expiry, gst, itemTotal
    });

    renderPurchaseBillItems();
    
    // Clear form inputs
    ['barcode', 'name', 'category', 'brand', 'unit', 'buy', 'sell', 'mrp', 'batch', 'expiry', 'gst'].forEach(id => {
      const el = document.getElementById('pe-prod-' + id);
      if (el && id !== 'gst') el.value = '';
    });
    document.getElementById('pe-prod-qty').value = 1;
    if (document.getElementById('pe-prod-gst')) document.getElementById('pe-prod-gst').value = 0;
  };

  window.removePurchaseEntryProduct = function(index) {
    window._currentPurchaseBill.splice(index, 1);
    renderPurchaseBillItems();
  };

  function renderPurchaseBillItems() {
    const tbody = document.getElementById('pe-items-tbody');
    const grandTotalEl = document.getElementById('pe-grand-total');
    if (!tbody) return;

    if (window._currentPurchaseBill.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No items added yet</td></tr>';
      grandTotalEl.textContent = '₹0';
      return;
    }

    let grandTotal = 0;
    tbody.innerHTML = window._currentPurchaseBill.map((item, index) => {
      grandTotal += item.itemTotal;
      return `
      <tr>
        <td><strong>${item.name}</strong><br><small>${item.barcode}</small></td>
        <td>${item.qty} ${item.unit}</td>
        <td>₹${item.buyPrice}</td>
        <td>${item.gst}%</td>
        <td>₹${item.itemTotal.toFixed(2)}</td>
        <td>₹${item.sellPrice}</td>
        <td><button class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="removePurchaseEntryProduct(${index})">🗑️</button></td>
      </tr>
    `}).join('');
    
    grandTotalEl.textContent = '₹' + grandTotal.toFixed(2);
  }

  window.savePurchaseBill = async function() {
    if (!window.FirebaseDB || !window.Firestore) return;
    
    const supplierId = document.getElementById('pe-supplier').value;
    const date = document.getElementById('pe-date').value;
    const notes = document.getElementById('pe-notes').value;
    
    if (!supplierId || window._currentPurchaseBill.length === 0) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Select a supplier and add at least one product.', 'warning');
      return;
    }

    const fs = window.Firestore;
    const db = window.FirebaseDB;
    
    // Get supplier name
    const supplierName = window._cachedSuppliers?.find(s => s.id === supplierId)?.company || 'Unknown Supplier';
    
    let grandTotal = window._currentPurchaseBill.reduce((sum, i) => sum + i.itemTotal, 0);
    
    const billData = {
      billNumber: 'PB-' + Date.now(),
      supplierId,
      supplierName,
      date,
      notes,
      totalAmount: grandTotal,
      items: window._currentPurchaseBill,
      status: 'Paid',
      createdAt: fs.serverTimestamp()
    };

    try {
      // 1. Save Purchase Bill
      await fs.addDoc(fs.collection(db, 'purchaseBills'), billData);
      
      // 2. Update/Create Products & Inventory
      for (const item of window._currentPurchaseBill) {
        // Look for existing product by barcode or name
        let q = null;
        if (item.barcode) {
          q = fs.query(fs.collection(db, 'products'), fs.where('barcode', '==', item.barcode));
        } else {
          q = fs.query(fs.collection(db, 'products'), fs.where('name', '==', item.name));
        }
        
        const existingSnap = await fs.getDocs(q);
        
        if (!existingSnap.empty) {
          // Update existing
          const docRef = existingSnap.docs[0].ref;
          const currentStock = existingSnap.docs[0].data().stock || 0;
          await fs.updateDoc(docRef, {
            stock: currentStock + item.qty,
            purchasePrice: item.buyPrice,
            price: item.sellPrice,
            mrp: item.mrp || item.sellPrice,
            batch: item.batch,
            expiry: item.expiry,
            supplierId: supplierId,
            supplierName: supplierName,
            updatedAt: fs.serverTimestamp()
          });
        } else {
          // Create new product
          await fs.addDoc(fs.collection(db, 'products'), {
            name: item.name,
            barcode: item.barcode,
            category: item.category,
            brand: item.brand,
            unit: item.unit,
            stock: item.qty,
            purchasePrice: item.buyPrice,
            price: item.sellPrice,
            mrp: item.mrp || item.sellPrice,
            batch: item.batch,
            expiry: item.expiry,
            gst: item.gst,
            supplierId: supplierId,
            supplierName: supplierName,
            image: '', // Needs manual upload later
            createdAt: fs.serverTimestamp()
          });
        }
      }
      
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Purchase Bill Saved successfully! Stock updated.', 'success');
      
      // Clear current bill
      window._currentPurchaseBill = [];
      renderPurchaseBillItems();
      document.getElementById('pe-notes').value = '';
      
    } catch (e) {
      console.error(e);
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Error saving purchase bill', 'error');
    }
  };

  window.renderAdminPurchaseBills = async function() {
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'purchaseBills'), fs.orderBy('createdAt', 'desc')));
      const bills = [];
      snap.forEach(doc => bills.push({ id: doc.id, ...doc.data() }));

      const tbody = document.getElementById('admin-pb-tbody');
      if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No purchase bills found.</td></tr>';
        return;
      }
      
      tbody.innerHTML = bills.map(b => `
        <tr>
          <td><strong>${b.billNumber}</strong></td>
          <td>${b.date}</td>
          <td>${b.supplierName || 'Unknown'}</td>
          <td>${b.items ? b.items.length : 0} items</td>
          <td><strong>₹${b.totalAmount.toFixed(2)}</strong></td>
          <td><span class="badge badge-green">${b.status}</span></td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="MathuraQuickMart.toast('Printing Bill...', 'info')">🖨️</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error("Error loading purchase bills:", e);
    }
  };
}
