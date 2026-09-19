//Notification system
function Notify(message, type = "info") {
  const displayBox = document.createElement("div");
  displayBox.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 2000;
    display: flex; align-items: center; justify-content: center;
  `;
  displayBox.innerHTML = `
    <div style="background: white; padding: 2rem; border-radius: 12px;box-shadow: 0 20px 40px rgba(0,0,0,0.3); max-width: 400px; text-align: center;">
      <p style="margin: 0 0 1.5rem 0; color: #333; font-size: 1rem;">${message}</p>
      <button id="dialog-ok" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">OK</button>
    </div>
  `;

  document.body.appendChild(displayBox);

  document.getElementById("dialog-ok").onclick = () => displayBox.remove();
  displayBox.onclick = (e) => {
    if (e.target === displayBox) displayBox.remove();
  };
}

if (typeof window.apiBase === "undefined") {
  console.error(
    "lease.js error",
  );
} else {
  document.addEventListener("DOMContentLoaded", () => {
    const leaseBtn = document.querySelector('button[data-view="leases"]');
    leaseBtn.addEventListener("click", () => {
      if (typeof currView === "function") recordView(currView);
      currView = loadLeases;
      loadLeases();
    });
  });

  async function loadLeases(q = "") {
    const container = document.getElementById("view-container");

    container.innerHTML = `
      <h2>Leases</h2>
      <div class="search-filters">
        <div class="search-row">
          <input type="text" id="lease-search" placeholder="🔍 Search property, address, or lease ID..." value="${q}" />
          <button id="clear-lease-search" title="Clear search">×</button>
        </div>
        <div class="filter-row">
          <select id="lease-status-filter">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
          <select id="lease-sort">
            <option value="start_date_desc">Latest First</option>
            <option value="start_date_asc">Oldest First</option>
            <option value="end_date_asc">Ending Soon</option>
            <option value="amount_desc">Highest Amount</option>
          </select>
        </div>
        <div id="lease-results-count"></div>
      </div>
      <ul id="lease-list">Loading…</ul>
    `;

    //Searching ele
    document.getElementById("lease-search").addEventListener(
      "input",
      debounce(() => {
        const t = document.getElementById("lease-search").value.trim();
        loadLeases(t);
      }, 300),
    );

    document.getElementById("clear-lease-search")
      .addEventListener("click", () => {
        document.getElementById("lease-search").value = "";
        loadLeases("");
      });

    // Sort filters
    document.getElementById("lease-status-filter")
      .addEventListener("change", filterAndSortLeases);
    document.getElementById("lease-sort")
      .addEventListener("change", filterAndSortLeases);

    try {
      const res = await fetch(
        `${window.apiBase}/leases${q ? `?q=${encodeURIComponent(q)}` : ""}`,
        { headers: { Authorization: `Bearer ${window.token}` } },
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const leases = await res.json();
      rendering(leases);
    } catch (err) {
      console.error("Error loading leases ", err);
      document.getElementById("lease-list").innerHTML =
        `<li style="color:red">${err.message}</li>`;
    }
  }

  // Global variable to store all leases
  let allLeases = [];

  // Filter and sort leases locally
  function filterAndSortLeases() {
    const statusFilter =
      document.getElementById("lease-status-filter")?.value || "";
    const sortBy =
      document.getElementById("lease-sort")?.value || "start_date_desc";

    let filtered = allLeases;

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter((lease) => lease.status === statusFilter);
    }

    // Sort leases
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "start_date_asc":
          return new Date(a.start_date) - new Date(b.start_date);
        case "start_date_desc":
          return new Date(b.start_date) - new Date(a.start_date);
        case "end_date_asc":
          return new Date(a.end_date) - new Date(b.end_date);
        case "amount_desc":
          return parseFloat(b.rent_amount) - parseFloat(a.rent_amount);
        default:
          return 0;
      }
    });

    rendering(filtered);
    leaseCount(filtered);
  }

  // Update lease results count
  function leaseCount(filtered) {
    const count = document.getElementById("lease-results-count");
    if (count) {
      const total = allLeases.length;
      const shown = filtered.length;
      count.textContent =
        total === shown ? `${total} leases` : `${shown} of ${total} leases`;
    }
  }

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function rendering(leases) {
    if (arguments.length > 1 || !allLeases.length) {
      allLeases = leases;
    }

    const ul = document.getElementById("lease-list");
    ul.innerHTML = "";
    if (!leases.length) {
      ul.innerHTML = "<li>No leases found.</li>";
      return;
    }

    leases.forEach((l) => {
      const isTenant = window.role === "tenant";
      const isStaffOrAdmin = window.role === "staff" || window.role === "admin";
      const showTenantInfo = !isTenant && isStaffOrAdmin;
      const nowStatus = l.status || "active";

      const tenantInfo = showTenantInfo
        ? `<div><strong>Tenant:</strong> ${l.tenant_name} (ID ${l.tenant_id})</div>`
        : "";
      const amountLeftInfo = `
        <div><strong>Rent Amount:</strong> ₹${Number(l.rent_amount).toFixed(2)}</div>
        <div><strong>Amount Left:</strong> ₹${Number(l.amount_left).toFixed(2)}</div>
      `;

      const tenantActions =
        isTenant && nowStatus === "active"
          ? `<button class="repay" data-id="${l.lease_id}">Repay</button>
           <button class="cancel-lease" data-id="${l.lease_id}">Cancel Lease</button>`
          : "";

      const adminCancel =
        window.role === "admin" && nowStatus === "active"
          ? `<button class="cancel-lease" data-id="${l.lease_id}">Cancel Lease</button>`
          : "";

      const li = document.createElement("li");
      li.innerHTML = `
        <div><strong>Lease #${l.lease_id}</strong></div>
        <div><strong>Property:</strong> ${l.property_name || `#${l.property_id}`}${l.property_address ? `, ${l.property_address}` : ""}</div>
        ${tenantInfo}
        <div><strong>Start:</strong> ${new Date(l.start_date).toLocaleDateString()}</div>
        <div><strong>End:</strong> ${new Date(l.end_date).toLocaleDateString()}</div>
        ${amountLeftInfo}
        <div><strong>Status:</strong> ${nowStatus}</div>
        <div class="actions">
          ${tenantActions}
          ${adminCancel}
        </div>
      `;
      ul.appendChild(li);
    });

    // Attach event handlers
    document.querySelectorAll(".repay").forEach((b) => {
      b.addEventListener("click", () => {
        // Store the details for the payment
        localStorage.setItem("repayLeaseId", b.dataset.id);
        document.querySelector('button[data-view="payments"]').click();
        if (window.refreshBadge) window.refreshBadge();
      });
    });

    document.querySelectorAll(".cancel-lease").forEach((b) => {
      b.addEventListener("click", async () => {
        const leaseId = +b.dataset.id;
        if (!confirm("Cancel this lease?")) return;
        try {
          const res = await fetch(`${window.apiBase}/leases/${leaseId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${window.token}` },
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || "Failed to cancel lease");
          }
          Notify(
            data.message || "Lease canceled successfully",
            "success",
          );
          if (window.refreshBadge) window.refreshBadge();
          loadLeases();
        } catch (err) {
          Notify("Error: " + err.message, "error");
        }
      });
    });
  }
}
