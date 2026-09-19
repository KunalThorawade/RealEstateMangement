// Nnotification system
function Notify(message, type = "info") {
  const messageBox = document.createElement("div");
  messageBox.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 2000;
    display: flex; align-items: center; justify-content: center;
  `;
  messageBox.innerHTML = `
    <div style="background: white; padding: 2rem; border-radius: 12px;box-shadow: 0 20px 40px rgba(0,0,0,0.3); max-width: 400px; text-align: center;">
      <p style="margin: 0 0 1.5rem 0; color: #333; font-size: 1rem;">${message}</p>
      <button id="dialog-ok" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">OK</button>
    </div>
  `;

  document.body.appendChild(messageBox);

  document.getElementById("dialog-ok").onclick = () => messageBox.remove();
  messageBox.onclick = (e) => {
    if (e.target === messageBox) messageBox.remove();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const paymentsBtn = document.querySelector('button[data-view="payments"]');
  const container = document.getElementById("view-container");

  paymentsBtn.addEventListener("click", () => {
    if (typeof currentView === "function") recordView(currentView);
    currentView = loadPayments;
    loadPayments();
  });

  async function loadPayments() {
    // 1) Record view
    if (window.role !== "tenant") {
      container.innerHTML = `
      <h2>Payments</h2>
      <p style="color:red">You are not authorized to view payments.</p>
    `;
      return;
    }
    recordView(loadPayments);

    // 2) Grab any redirect markers
    const comingFromPurchase = localStorage.getItem("purchasePropertyId");
    const comingFromRepay = localStorage.getItem("repayLeaseId");

    // 3) Render the payments UI
    container.innerHTML = `
      <h2>Payments</h2>

      <div class="payment-tabs">
        <button class="payment-tab active" data-tab="repay">Repayment</button>
        <button class="payment-tab" data-tab="purchase">Purchase</button>
      </div>

      <div id="repay-form" class="payment-tab-content">
        <form id="payment-form">
          <label>Lease ID: <input type="number" id="lease-id" required /></label><br>
          <label>Amount: <input type="number" id="amount" step="0.01" required /></label><br>
          <label>Method:
            <select id="method">
              <option value="credit card">Credit Card</option>
              <option value="bank transfer">Bank Transfer</option>
            </select>
          </label><br>
          <label>Your Password: <input type="password" id="pay-password" required /></label><br>
          <button type="submit">Pay Repayment</button>
        </form>
      </div>

      <div id="purchase-form" class="payment-tab-content" style="display:none">
        <form id="purchase-form-inner">
          <label>Property ID: <input type="number" id="property-id" required /></label><br>
          <label>Amount: <input type="number" id="purchase-amount" step="0.01" required /></label><br>
          <label>Method:
            <select id="purchase-method">
              <option value="credit card">Credit Card</option>
              <option value="bank transfer">Bank Transfer</option>
            </select>
          </label><br>
          <label>Your Password: <input type="password" id="pay-password-purchase" required /></label><br>
          <button type="submit">Pay Purchase</button>
        </form>
      </div>

<h3>Previous Payments
  <button id="clear-history-btn" style="margin-left:1em">Clear History</button></h3>
      <ul id="payment-list">Loading…</ul>
    `;
    // Clear‑history button
    const toggleBtn = document.getElementById("clear-history-btn");
    const ul = document.getElementById("payment-list");
    let hidden = false;
    toggleBtn.textContent = "Hide History";
    toggleBtn.addEventListener("click", () => {
      hidden = !hidden;
      ul.style.display = hidden ? "none" : "";
      toggleBtn.textContent = hidden ? "Show History" : "Hide History";
    });
    // 4) switching between tabs
    document.querySelectorAll(".payment-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        // Remove active class from all tabs
        document
          .querySelectorAll(".payment-tab")
          .forEach((t) => t.classList.remove("active"));
        // Add active class to clicked tab
        tab.classList.add("active");

        // Show/hide content
        const tabName = tab.dataset.tab;
        document.getElementById("repay-form").style.display =
          tabName === "repay" ? "" : "none";
        document.getElementById("purchase-form").style.display =
          tabName === "purchase" ? "" : "none";
      });
    });

    // 5) Pre‑select & pre‑fill
    if (comingFromRepay) {
      const repayTab = document.querySelector('.payment-tab[data-tab="repay"]');
      if (repayTab) {
        repayTab.click();
        document.getElementById("lease-id").value = comingFromRepay;
      }
      localStorage.removeItem("repayLeaseId");
    }
    if (comingFromPurchase) {
      const purchaseTab = document.querySelector(
        '.payment-tab[data-tab="purchase"]',
      );
      if (purchaseTab) {
        purchaseTab.click();
        document.getElementById("property-id").value = comingFromPurchase;
      }
      localStorage.removeItem("purchasePropertyId");
    }

    // 6) repayment 
    document
      .getElementById("payment-form")
      .addEventListener("submit", submitRepayment);

    // 7)  purchase
    document
      .getElementById("purchase-form-inner")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const propertyId = +document.getElementById("property-id").value;
        const amount = +document.getElementById("purchase-amount").value;

        // 1) Fetch the property price
        const propRes = await fetch(`${apiBase}/properties/${propertyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const prop = await propRes.json();
        if (!propRes.ok) {
          return Notify(
            `Cannot load property: ${prop.message}`,
            "error",
          );
        }
        // 2) Enforce full payment
        if (amount !== Number(prop.price)) {
          return Notify(
            `You must pay the exact price: ₹${Number(prop.price).toFixed(2)}`,
            "warning",
          );
        }

        const method = document.getElementById("purchase-method").value;
        const password = document.getElementById("pay-password-purchase").value;

        try {
          const res = await fetch(
            `${apiBase}/properties/${propertyId}/purchase`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ amount, method, password }),
            },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Purchase failed");
          Notify(data.message || "Purchase successful", "success");
          if (window.refreshBadge) window.refreshBadge();
          loadPayments();
        } catch (err) {
          Notify("Error: " + err.message, "error");
        }
      });

    // 8) Load payment history
    await refreshPayments();
  }

  async function submitRepayment(e) {
    e.preventDefault();
    const leaseId = +document.getElementById("lease-id").value;
    const amount = +document.getElementById("amount").value;
    const method = document.getElementById("method").value;
    const password = document.getElementById("pay-password").value;

    try {
      const res = await fetch(`${apiBase}/leases/${leaseId}/repay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lease_id: leaseId, amount, method, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Repayment failed");
      Notify(data.message, "success");
      if (window.refreshBadge) window.refreshBadge();

      await refreshPayments();
    } catch (err) {
      Notify("Error: " + err.message, "error");
    }
  }

  async function refreshPayments() {
    const ul = document.getElementById("payment-list");
    ul.innerHTML = "";

    try {
      const res = await fetch(`${apiBase}/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      let payments = await res.json();

      // Sort newest → oldest
      payments = payments.sort(
        (a, b) => new Date(b.payment_date) - new Date(a.payment_date),
      );

      if (!payments.length) {
        ul.innerHTML = "<li>No payments yet.</li>";
      } else {
        payments.forEach((p) => {
          const when = new Date(p.payment_date).toLocaleString();
          const amt = Number(p.amount); // coerce to number
          const li = document.createElement("li");
          li.textContent = `Lease ${p.lease_id}: ₹${amt.toFixed(2)} on ${when} (${p.method})`;
          ul.appendChild(li);
        });
      }
    } catch (err) {
      console.error("refreshPayments error:", err);
      ul.innerHTML = `<li style="color:red">Error loading payments: ${err.message}</li>`;
    }
  }
});
