//Notification system
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
  const propBtn = document.querySelector('button[data-view="properties"]');
  const container = document.getElementById("view-container");
  let allProps = [];

  // 1)record previous view, set current then load
  propBtn.addEventListener("click", () => {
    if (typeof currentView === "function") recordView(currentView);
    currentView = loadProperties;
    loadProperties();
  });

  // 2) Loader
  async function loadProperties() {
    container.innerHTML = `
      <h2>Properties</h2>
      ${role === "admin" ? '<button id="add-prop-btn">Add Property</button>' : ""}
      <div id="filters" class="search-filters">
        <div class="search-row">
          <input type="text" id="f-text" placeholder="🔍 Search name, address, or type..." />
          <button id="clear-search" title="Clear search">×</button>
        </div>
        <div class="filter-row">
          <div class="price-filters">
            <input type="number" id="f-min-price" placeholder="Min ₹" min="0" />
            <span>-</span>
            <input type="number" id="f-max-price" placeholder="Max ₹" min="0" />
          </div>
          <select id="f-min-rating">
            <option value="">Any Rating</option>
            ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}+ Stars</option>`).join("")}
          </select>
          <select id="f-sort-by">
            <option value="">Sort by</option>
            <option value="price">Price</option>
            <option value="rating">Rating</option>
            <option value="name">Name</option>
          </select>
          <select id="f-sort-order">
            <option value="asc">↑ Low to High</option>
            <option value="desc">↓ High to Low</option>
          </select>
        </div>
        <div class="filter-actions">
          <button id="apply-filters" class="small-btn">Apply Filters</button>
          <button id="clear-filters" class="small-btn secondary">Clear All</button>
        </div>
        <div id="results-count"></div>
      </div>
      <ul id="prop-list">Loading…</ul>
    `;

    // Add button if admin
    if (role === "admin") {
      document
        .getElementById("add-prop-btn")
        .addEventListener("click", showAddForm);
    }
    // filter buttons and search
    document
      .getElementById("apply-filters")
      .addEventListener("click", applyFilters);
    document.getElementById("clear-filters").addEventListener("click", () => {
      document
        .querySelectorAll("#filters input,#filters select")
        .forEach((el) => (el.value = ""));
      renderList(allProps);
      updateResultsCount(allProps);
    });
    document.getElementById("clear-search").addEventListener("click", () => {
      document.getElementById("f-text").value = "";
      applyFilters();
    });

    //search as user types
    document
      .getElementById("f-text")
      .addEventListener("input", debounce(applyFilters, 300));
    document
      .getElementById("f-min-price")
      .addEventListener("input", debounce(applyFilters, 500));
    document
      .getElementById("f-max-price")
      .addEventListener("input", debounce(applyFilters, 500));

    //show data
    try {
      const res = await fetch(`${apiBase}/properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      allProps = await res.json();
      renderList(allProps);
      document
        .getElementById("prop-list")
        .addEventListener("click", onPropListClick);
    } catch (err) {
      console.error("loadProperties error:", err);
      document.getElementById("prop-list").innerHTML =
        `<li>Error: ${err.message}</li>`;
    }
  }

  // 3) Apply filters + sort
  function applyFilters() {
    const text = document.getElementById("f-text").value.trim().toLowerCase();
    const minP =
      parseFloat(document.getElementById("f-min-price").value) || -Infinity;
    const maxP =
      parseFloat(document.getElementById("f-max-price").value) || Infinity;
    const minR = parseInt(document.getElementById("f-min-rating").value, 10);
    const sortBy = document.getElementById("f-sort-by").value;
    const order = document.getElementById("f-sort-order").value;

    const filtered = allProps
      .filter((p) => {
        // name, address, type, and features
        const searchText = (
          p.name +
          " " +
          p.address +
          " " +
          (p.type || "") +
          " " +
          (p.features || "")
        ).toLowerCase();
        if (text && !searchText.includes(text)) return false;
        if (p.price < minP || p.price > maxP) return false;
        const r = p.avgRating ? parseFloat(p.avgRating) : 0;
        if (!isNaN(minR) && r < minR) return false;
        return true;
      })
      .sort((a, b) => {
        if (!sortBy) return 0;
        let va, vb;
        if (sortBy === "rating") {
          va = a.avgRating ? +a.avgRating : 0;
          vb = b.avgRating ? +b.avgRating : 0;
        } else if (sortBy === "price") {
          va = a.price;
          vb = b.price;
        } else if (sortBy === "name") {
          va = a.name.toLowerCase();
          vb = b.name.toLowerCase();
          return order === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
        }
        return order === "desc" ? vb - va : va - vb;
      });

    renderList(filtered);
    updateResultsCount(filtered);
  }

  // Helper function for debouncing
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

  // Update results count
  function updateResultsCount(filtered) {
    const countEl = document.getElementById("results-count");
    if (countEl) {
      const total = allProps.length;
      const shown = filtered.length;
      countEl.textContent =
        total === shown
          ? `${total} properties`
          : `${shown} of ${total} properties`;
    }
  }

  function renderList(props) {
    const ul = document.getElementById("prop-list");
    ul.innerHTML = props.length
      ? props
          .map(
            (p) => `
          <li>
            <strong>${p.name}</strong> — ${p.address}<br>
            ₹${p.price}/mo<br>
            Rating: ${p.avgRating || "N/A"} (${p.feedbackCount || 0})<br>
            <button class="view-details" data-id="${p.id}">Details</button>
            ${
              role === "admin"
                ? `<button class="edit-prop"   data-id="${p.id}">Edit</button>
                 <button class="delete-prop" data-id="${p.id}">Remove</button>`
                : ""
            }
          </li>
        `,
          )
          .join("")
      : `<li>No properties match filters.</li>`;

    // attach click handlers
    // View edit can stay direct
    document
      .querySelectorAll(".view-details")
      .forEach((b) =>
        b.addEventListener("click", () => showDetails(b.dataset.id)),
      );
    document
      .querySelectorAll(".edit-prop")
      .forEach((b) =>
        b.addEventListener("click", () => showEditForm(b.dataset.id)),
      );
  }
  function onPropListClick(e) {
    const btn = e.target.closest(".delete-prop");
    if (!btn) return;
    const id = btn.dataset.id;
    deleteProperty(id);
  }
  // 5) Delete handler
  async function deleteProperty(id) {
    if (!confirm(`Remove property #${id}?`)) return;
    try {
      const res = await fetch(`${apiBase}/properties/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Notify("Property removed", "success");
      loadProperties();
      if (window.refreshBadge) window.refreshBadge();
    } catch (err) {
      console.error("delete error:", err);
      Notify("Error deleting property: " + err.message, "error");
    }
  }

  // Admin add property
  function showAddForm() {
    container.innerHTML = `
      <h2>Add Property</h2>
      <form id="prop-form">
        <label>Name: <input type="text" id="prop-name" required /></label><br>
        <label>Address: <input type="text" id="prop-address" required /></label><br>
        <label>Type: <input type="text" id="prop-type" required /></label><br>
        <label>Price: <input type="number" id="prop-price" required /></label><br>
        <label>Features: <textarea id="prop-features"></textarea></label><br>
        <label>Image URL: <input type="url" id="prop-image_url" /></label><br>
        <label>Detail URL: <input type="url" id="prop-detail_url" /></label><br>
        <label>Staff ID: <input type="number" id="prop-staff_id" required /></label><br>
        <label>Available From: <input type="date" id="prop-available_from" required /></label><br>
        <button type="submit">Create</button>
        <button type="button" id="cancel-prop">Cancel</button>
      </form>
      <div id="prop-list"></div>
    `;
    document
      .getElementById("cancel-prop")
      .addEventListener("click", loadProperties);
    document
      .getElementById("prop-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = {
          name: document.getElementById("prop-name").value,
          address: document.getElementById("prop-address").value,
          type: document.getElementById("prop-type").value,
          price: document.getElementById("prop-price").value,
          features: document.getElementById("prop-features").value,
          image_url: document.getElementById("prop-image_url").value,
          detail_url: document.getElementById("prop-detail_url").value,
          staff_id: document.getElementById("prop-staff_id").value,
          available_from: document.getElementById("prop-available_from").value,
        };
        try {
          const res = await fetch(`${apiBase}/properties`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);
          Notify("Property added", "success");
          if (window.refreshBadge) window.refreshBadge();
          loadProperties();
        } catch (err) {
          console.error("create error:", err);
          Notify("Error: " + err.message, "error");
        }
      });
  }

  // Admin edit property
  async function showEditForm(id) {
    const resp = await fetch(`${apiBase}/properties/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const p = await resp.json();
    container.innerHTML = `
      <h2>Edit Property</h2>
      <form id="prop-form">
        <label>Name: <input type="text" id="prop-name" value="${p.name}" required /></label><br>
        <label>Address: <input type="text" id="prop-address" value="${p.address}" required /></label><br>
        <label>Type: <input type="text" id="prop-type" value="${p.type}" required /></label><br>
        <label>Price: <input type="number" id="prop-price" value="${p.price}" required /></label><br>
        <label>Features: <textarea id="prop-features">${p.features || ""}</textarea></label><br>
        <label>Image URL: <input type="url" id="prop-image_url" value="${p.image_url || ""}" /></label><br>
        <label>Detail URL: <input type="url" id="prop-detail_url" value="${p.detail_url || ""}" /></label><br>
        <label>Staff ID: <input type="number" id="prop-staff_id" value="${p.staff_id || ""}" required /></label><br>
        <label>Available From: <input type="date" id="prop-available_from" value="${p.available_from.split("T")[0]}" required /></label><br>
        <label>Active: <input type="checkbox" id="prop-active" ${p.is_active ? "checked" : ""} /></label><br>
        <button type="submit">Update</button>
        <button type="button" id="cancel-prop">Cancel</button>
      </form>
    `;
    document
      .getElementById("cancel-prop")
      .addEventListener("click", loadProperties);
    document
      .getElementById("prop-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = {
          name: document.getElementById("prop-name").value,
          address: document.getElementById("prop-address").value,
          type: document.getElementById("prop-type").value,
          price: document.getElementById("prop-price").value,
          features: document.getElementById("prop-features").value,
          image_url: document.getElementById("prop-image_url").value,
          detail_url: document.getElementById("prop-detail_url").value,
          staff_id: document.getElementById("prop-staff_id").value,
          available_from: document.getElementById("prop-available_from").value,
          is_active: document.getElementById("prop-active").checked,
        };
        try {
          const res = await fetch(`${apiBase}/properties/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);
          Notify("Property updated", "success");
          loadProperties();
        } catch (err) {
          console.error("update error:", err);
          Notify("Error: " + err.message, "error");
        }
      });
  }

  // Admin delete property
  async function deleteProperty(id) {
    if (!confirm("Remove this property?")) return;
    try {
      const res = await fetch(`${apiBase}/properties/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Notify("Property removed", "success");
      loadProperties();
    } catch (err) {
      console.error("delete error:", err);
      Notify("Error: " + err.message, "error");
    }
  }

  // Tenant
  async function showDetails(id) {
    try {
      const res = await fetch(`${apiBase}/properties/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const p = await res.json();
      if (!res.ok) throw new Error(p.message || "Failed to load details");

      // two top comments
      const topComments = p.feedbacks.slice(0, 2);

      container.innerHTML = `
        <h2>Property #${p.id}: ${p.name}</h2>
        ${p.image_url ? `<img src="${p.image_url}" style="max-width:200px" /><br>` : ""}
        <a href="${p.detail_url}" target="_blank">More details</a><br>
        <p>${p.address}</p>
        <p>Price: ₹${p.price}/mo</p>
        <p>Features: ${p.features}</p>
        <p>Rating: ${p.avgRating || "N/A"} (${p.feedbackCount || 0} reviews)</p>

        ${
          topComments.length
            ? `<h3>Top Ratings</h3>
             <ul>
               ${topComments
                 .map(
                   (c) => `
                 <li>
                   <strong>${c.rating}★</strong> by ${c.tenant_name} on
                   ${new Date(c.created_at).toLocaleDateString()}<br>
                   ${c.comment}
                 </li>
               `,
                 )
                 .join("")}
             </ul>`
            : "<p>No feedback yet.</p>"
        }

        ${role === "tenant" ? `<button id="purchase-btn">Purchase</button>` : ""}
        ${
          role === "tenant"
            ? `
          <h3>Leave Feedback</h3>
          <form id="feedback-form">
            <label>Rating: <input type="number" id="f-rating" min="1" max="5" required /></label><br>
            <label>Comment:<br><textarea id="f-comment"></textarea></label><br>
            <button type="submit">Submit</button>
          </form>`
            : ""
        }
      `;

      if (role === "tenant") {
        document
          .getElementById("purchase-btn")
          .addEventListener("click", () => {
            localStorage.setItem("purchasePropertyId", id);
            document.querySelector('button[data-view="payments"]').click();
          });

        document
          .getElementById("feedback-form")
          .addEventListener("submit", async (e) => {
            e.preventDefault();
            const rating = +document.getElementById("f-rating").value;
            const comment = document.getElementById("f-comment").value;
            try {
              const resp = await fetch(`${apiBase}/properties/${id}/feedback`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ rating, comment }),
              });
              if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.message);
              }
              Notify("Feedback submitted", "success");
              showDetails(id);
            } catch (err) {
              console.error("feedback error:", err);
              Notify("Error: " + err.message, "error");
            }
          });
      }
    } catch (err) {
      console.error("showDetails error:", err);
      container.innerHTML = `<p>Error loading details: ${err.message}</p>`;
    }
  }
});
