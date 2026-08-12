export function initReportsModule() {
  let purchaseSalesChartInstance = null;
  let categoryChartInstance = null;

  window.renderAdminReports = async function() {
    if (!window.FirebaseDB || !window.Firestore) return;
    const fs = window.Firestore;
    const db = window.FirebaseDB;

    try {
      // ── Fetch all data ──
      const [productsSnap, billsSnap, ordersSnap] = await Promise.all([
        fs.getDocs(fs.collection(db, 'products')),
        fs.getDocs(fs.collection(db, 'purchaseBills')),
        fs.getDocs(fs.collection(db, 'orders'))
      ]);

      const products = [];
      productsSnap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));

      const bills = [];
      billsSnap.forEach(doc => bills.push({ id: doc.id, ...doc.data() }));

      const orders = [];
      ordersSnap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

      // ── KPI Cards ──
      const today = new Date().toISOString().split('T')[0];
      const todayPurchase = bills
        .filter(b => b.date === today)
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      const inventoryValue = products.reduce((sum, p) => sum + ((p.purchasePrice || p.price || 0) * (p.stock || 0)), 0);
      const sellingValue   = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
      const expectedProfit = sellingValue - inventoryValue;
      const lowStockCount  = products.filter(p => !p.stock || p.stock <= 10).length;

      setTextSafe('report-today-purchase', '₹' + todayPurchase.toFixed(0));
      setTextSafe('report-inventory-value', '₹' + inventoryValue.toFixed(0));
      setTextSafe('report-expected-profit', '₹' + expectedProfit.toFixed(0));
      setTextSafe('report-low-stock', lowStockCount);

      // ── Expiring Soon List ──
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const expiringSoon = products.filter(p => {
        if (!p.expiry) return false;
        const expMs = new Date(p.expiry).getTime();
        return expMs > nowMs && expMs - nowMs <= thirtyDaysMs;
      });
      const expList = document.getElementById('report-expiring-list');
      if (expList) {
        expList.innerHTML = expiringSoon.length === 0
          ? '<li style="color:var(--gray-500);">No items expiring in the next 30 days.</li>'
          : expiringSoon.map(p => `<li>⚠️ <strong>${p.name}</strong> — expires ${p.expiry}</li>`).join('');
      }

      // ── Top Selling Products ──
      const salesMap = {};
      orders.forEach(o => {
        (o.items || []).forEach(item => {
          const key = item.name || item.id;
          salesMap[key] = (salesMap[key] || 0) + (item.qty || 1);
        });
      });
      const topSelling = Object.entries(salesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const topList = document.getElementById('report-topselling-list');
      if (topList) {
        topList.innerHTML = topSelling.length === 0
          ? '<li style="color:var(--gray-500);">No sales data yet.</li>'
          : topSelling.map(([name, qty]) => `<li>🏆 <strong>${name}</strong> — ${qty} units sold</li>`).join('');
      }

      // ── Charts ──
      renderPurchaseSalesChart(bills, orders);
      renderCategoryChart(products);

    } catch (e) {
      console.error('Error rendering reports:', e);
    }
  };

  function setTextSafe(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderPurchaseSalesChart(bills, orders) {
    const ctx = document.getElementById('purchaseSalesChart');
    if (!ctx) return;

    // Aggregate by month for the last 6 months
    const months = [];
    const purchaseData = [];
    const salesData = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const yearMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      months.push(label);

      const monthPurchases = bills
        .filter(b => b.date && b.date.startsWith(yearMonth))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      purchaseData.push(monthPurchases);

      const monthSales = orders
        .filter(o => {
          const oDate = o.date || (o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toISOString() : '');
          return oDate.startsWith(yearMonth);
        })
        .reduce((sum, o) => sum + (o.total || o.subtotal || 0), 0);
      salesData.push(monthSales);
    }

    if (purchaseSalesChartInstance) purchaseSalesChartInstance.destroy();

    purchaseSalesChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Purchases (₹)',
            data: purchaseData,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderRadius: 4,
          },
          {
            label: 'Sales (₹)',
            data: salesData,
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderCategoryChart(products) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const catMap = {};
    products.forEach(p => {
      const cat = p.category || 'Uncategorized';
      catMap[cat] = (catMap[cat] || 0) + (p.stock || 0);
    });

    const labels = Object.keys(catMap);
    const data = Object.values(catMap);
    const colors = [
      '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    if (categoryChartInstance) categoryChartInstance.destroy();

    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#fff',
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'right' } }
      }
    });
  }
}
