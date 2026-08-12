export function initInventoryModule() {
  window.renderAdminSuppliers = async function() {
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;
    try {
      const snap = await fs.getDocs(fs.collection(db, 'suppliers'));
      const suppliers = [];
      snap.forEach(doc => suppliers.push({ id: doc.id, ...doc.data() }));
      
      // Cache suppliers globally so purchase entry can use it
      window._cachedSuppliers = suppliers;

      const tbody = document.getElementById('admin-suppliers-tbody');
      if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No suppliers found.</td></tr>';
        return;
      }
      
      tbody.innerHTML = suppliers.map(s => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.company || 'N/A'}</td>
          <td>${s.mobile || ''} <br> <small>${s.email || ''}</small></td>
          <td>${s.gst || 'N/A'}</td>
          <td>${s.paymentTerms || 'N/A'}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editSupplier('${s.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="deleteSupplier('${s.id}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error("Error loading suppliers:", e);
    }
  };

  window.openSupplierModal = function(editId = null) {
    document.getElementById('supplier-modal-title').textContent = editId ? 'Edit Supplier' : 'Add New Supplier';
    document.getElementById('edit-supplier-id').value = editId || '';
    
    // Clear form
    ['sup-name', 'sup-company', 'sup-mobile', 'sup-email', 'sup-gst', 'sup-address', 'sup-city', 'sup-state', 'sup-pin'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('sup-terms').value = 'Net 30';

    // If editing, populate fields
    if (editId && window._cachedSuppliers) {
      const sup = window._cachedSuppliers.find(s => s.id === editId);
      if (sup) {
        document.getElementById('sup-name').value = sup.name || '';
        document.getElementById('sup-company').value = sup.company || '';
        document.getElementById('sup-mobile').value = sup.mobile || '';
        document.getElementById('sup-email').value = sup.email || '';
        document.getElementById('sup-gst').value = sup.gst || '';
        document.getElementById('sup-address').value = sup.address || '';
        document.getElementById('sup-city').value = sup.city || '';
        document.getElementById('sup-state').value = sup.state || '';
        document.getElementById('sup-pin').value = sup.pin || '';
        document.getElementById('sup-terms').value = sup.paymentTerms || 'Net 30';
      }
    }

    document.getElementById('supplier-modal').classList.remove('hidden');
  };

  window.closeSupplierModal = function() {
    document.getElementById('supplier-modal').classList.add('hidden');
  };

  window.editSupplier = function(id) {
    window.openSupplierModal(id);
  };

  window.submitSupplierForm = async function() {
    const editId = document.getElementById('edit-supplier-id').value;
    const data = {
      name: document.getElementById('sup-name').value.trim(),
      company: document.getElementById('sup-company').value.trim(),
      mobile: document.getElementById('sup-mobile').value.trim(),
      email: document.getElementById('sup-email').value.trim(),
      gst: document.getElementById('sup-gst').value.trim(),
      address: document.getElementById('sup-address').value.trim(),
      city: document.getElementById('sup-city').value.trim(),
      state: document.getElementById('sup-state').value.trim(),
      pin: document.getElementById('sup-pin').value.trim(),
      paymentTerms: document.getElementById('sup-terms').value,
    };
    if (!data.name) {
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Supplier name is required', 'warning');
      return;
    }
    
    if (editId) {
      await updateSupplier(editId, data);
    } else {
      await saveSupplier(data);
    }
    window.closeSupplierModal();
  };

  async function updateSupplier(id, data) {
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;
    try {
      await fs.updateDoc(fs.doc(db, 'suppliers', id), {
        ...data,
        updatedAt: fs.serverTimestamp()
      });
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Supplier Updated!', 'success');
      window.renderAdminSuppliers();
    } catch (e) {
      console.error(e);
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Error updating supplier', 'error');
    }
  }

  async function saveSupplier(data) {
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;
    try {
      await fs.addDoc(fs.collection(db, 'suppliers'), {
        ...data,
        createdAt: fs.serverTimestamp()
      });
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Supplier Added!', 'success');
      window.renderAdminSuppliers();
    } catch (e) {
      console.error(e);
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Error saving supplier', 'error');
    }
  }

  window.deleteSupplier = async function(id) {
    if(!confirm("Are you sure you want to delete this supplier?")) return;
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;
    try {
      await fs.deleteDoc(fs.doc(db, 'suppliers', id));
      if (window.MathuraQuickMart) window.MathuraQuickMart.toast('Supplier Deleted!', 'success');
      window.renderAdminSuppliers();
    } catch (e) {
      console.error(e);
    }
  };

  window.renderAdminInventory = async function() {
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;
    try {
      // Fetch from 'inventory' collection, but 'products' is the source of truth for display
      const snap = await fs.getDocs(fs.collection(db, 'products'));
      let products = [];
      snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));

      // Apply Filters
      const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
      const stockFilter = document.getElementById('inv-filter-stock')?.value || 'all';

      if (search) {
        products = products.filter(p => 
          (p.name || '').toLowerCase().includes(search) || 
          (p.barcode || '').toLowerCase().includes(search)
        );
      }

      if (stockFilter === 'low') {
        products = products.filter(p => p.stock > 0 && p.stock <= 10);
      } else if (stockFilter === 'out') {
        products = products.filter(p => !p.stock || p.stock <= 0);
      }

      const tbody = document.getElementById('admin-inventory-tbody');
      if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">No inventory records found.</td></tr>';
        return;
      }

      tbody.innerHTML = products.map(p => {
        let stockClass = p.stock > 10 ? 'badge-green' : (p.stock > 0 ? 'badge-orange' : 'badge-red');
        let stockLabel = p.stock > 10 ? 'In Stock' : (p.stock > 0 ? 'Low Stock' : 'Out of Stock');

        return `
        <tr>
          <td><img src="${p.image || p.image_url || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></td>
          <td><strong>${p.name}</strong></td>
          <td>${p.barcode || p.sku || 'N/A'}</td>
          <td>${p.category || 'N/A'}</td>
          <td>${p.supplierName || p.supplier || 'N/A'}</td>
          <td>
            <span class="badge ${stockClass}">${p.stock || 0}</span>
          </td>
          <td>${p.batch || 'N/A'}</td>
          <td>${p.expiry || 'N/A'}</td>
          <td>₹${p.purchasePrice || p.price || 0}</td>
          <td>₹${p.mrp || p.price || 0}</td>
          <td>₹${p.price || 0}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editProduct('${p.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--error);" onclick="deleteProduct('${p.id}')">🗑️</button>
          </td>
        </tr>
      `}).join('');
    } catch (e) {
      console.error("Error loading inventory:", e);
    }
  };
}
