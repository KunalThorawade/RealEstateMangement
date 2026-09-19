// Notification system
function Notify(message, type = "info") {
  const dialogDiv = document.createElement("div");
  dialogDiv.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 2000;
    display: flex; align-items: center; justify-content: center;
  `;
  dialogDiv.innerHTML = `
    <div style="background: white; padding: 2rem; border-radius: 12px;box-shadow: 0 20px 40px rgba(0,0,0,0.3); max-width: 400px; text-align: center;">
      <p style="margin: 0 0 1.5rem 0; color: #333; font-size: 1rem;">${message}</p>
      <button id="dialog-ok" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">OK</button>
    </div>
  `;

  document.body.appendChild(dialogDiv);

  document.getElementById("dialog-ok").onclick = () => dialogDiv.remove();
  dialogDiv.onclick = (e) => {
    if (e.target === dialogDiv) dialogDiv.remove();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const maintBtn = document.querySelector('button[data-view="maintenance"]');
  const viewContainer = document.getElementById("view-container");

  maintBtn.addEventListener("click", () => {
    recordView(currentView);
    currentView = loadMaintenance;
    loadMaintenance();
    if (window.refreshBadge) window.refreshBadge();
  });

  async function loadMaintenance() {
    recordView(loadMaintenance);
    viewContainer.innerHTML = `
      <h2>Maintenance Requests</h2>
      ${role === "tenant" ? '<button id="new-req">New Request</button>' : ""}
      <ul id="maint-list">Loading…</ul>
    `;
    if (role === "tenant") {
      document
        .getElementById("new-req")
        .addEventListener("click", reqForm);
    }
    await refreshList();
  }

  async function refreshList() {
    const ul = document.getElementById("maint-list");
    ul.innerHTML = "";
    try {
      const res = await fetch(`${apiBase}/maintenance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const reqs = await res.json();
      if (reqs.length === 0) {
        ul.innerHTML = "<li>No maintenance requests.</li>";
        return;
      }
      reqs.forEach((r) => {
        const li = document.createElement("li");
        li.innerHTML = `
        <strong>#${r.id}</strong> (Status: ${r.status})<br>
        Property ID: ${r.property_id}<br>
        ${r.desec}<br>
        ${r.assigned_staff_id ? `Staff: ${r.staff_email}<br>` : ""}
        ${role === "tenant"
          ? `
          ${r.status === "pending" ? `<button class="edit-req" data-id="${r.id}">Edit</button>` : ""}
          <button class="del-req" data-id="${r.id}">Delete</button>`
                  : role === "admin" && r.status === "pending"
                    ? `
          <button class="mark-done" data-id="${r.id}">Mark Done</button>
          <button class="assign-req" data-id="${r.id}">Assign</button>`
                    : role === "staff" && r.status === "pending"
                      ? `
          <button class="mark-done" data-id="${r.id}">Mark Done</button>`
                      : ""
                }

      `;
        ul.appendChild(li);
      });
      attachButtons();
    } catch {
      ul.innerHTML = "<li>Error loading requests.</li>";
    }
  }

  function attachButtons() {
    if (role === "tenant") {
      document
        .querySelectorAll(".edit-req")
        .forEach((btn) =>
          btn.addEventListener("click", () => editForm(btn.dataset.id)),
        );
      document.querySelectorAll(".del-req").forEach((btn) =>
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this request?")) return;
          await fetch(`${apiBase}/maintenance/${btn.dataset.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          refreshList();
        }),
      );
    } else {
      document.querySelectorAll(".mark-done").forEach((btn) =>
        btn.addEventListener("click", async () => {
          await fetch(`${apiBase}/maintenance/${btn.dataset.id}/status`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: "completed" }),
          });
          refreshList();
        }),
      );

      document.querySelectorAll(".assign-req").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          let staffList;
          try {
            const res = await fetch(`${apiBase}/staff`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            staffList = await res.json();
          } catch (err) {
            return Notify(
              `Could not load staff: ${err.message}`,
              "error",
            );
          }

          // dropdown + confirm/cancel button
          const container = document.createElement("div");
          container.classList.add("assign-form");
          const select = document.createElement("select");
          select.id = `staff-select-${id}`;
          staffList.forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.email;
            select.appendChild(opt);
          });

          const confirmBtn = document.createElement("button");
          confirmBtn.textContent = "Assign";

          const cancelBtn = document.createElement("button");
          cancelBtn.textContent = "Cancel";

          container.appendChild(select);
          container.appendChild(confirmBtn);
          container.appendChild(cancelBtn);

          const li = btn.closest("li");
          li.querySelectorAll(".assign-form").forEach((f) => f.remove());
          li.appendChild(container);

          // Canceler
          cancelBtn.addEventListener("click", () => {
            container.remove();
          });

          // Assigner
          confirmBtn.addEventListener("click", async () => {
            const staffId = select.value;
            try {
              const assignRes = await fetch(
                `${apiBase}/maintenance/${id}/assign`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ staffId }),
                },
              );
              const data = await assignRes.json();
              if (!assignRes.ok)
                throw new Error(data.message || assignRes.statusText);
              Notify("Assigned successfully", "success");
              refreshList();
            } catch (err) {
              Notify(`Assignment failed: ${err.message}`, "error");
            }
          });
        }),
      );
    }
  }

  function reqForm() {
    viewContainer.innerHTML = `
      <h2>New Maintenance Request</h2>
      <form id="req-form">
        <label>Property ID:
          <input type="number" id="prop-id" required />
        </label><br>
        <label>desec:<br>
          <textarea id="desc" required></textarea>
        </label><br>
        <button type="submit">Submit</button>
        <button type="button" id="cancel">Cancel</button>
      </form>
      <ul id="maint-list"></ul>
    `;

    // cancel button
    document
      .getElementById("cancel")
      .addEventListener("click", loadMaintenance);

    document
      .getElementById("req-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const property_id = +document.getElementById("prop-id").value;
        const desec = document.getElementById("desc").value;
        // Send the request
        const res = await fetch(`${apiBase}/maintenance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ property_id, desec }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Check if error
          if (res.status === 403 && data.message.includes("property")) {
            Notify(
              "Wrong Property ID - You can only create maintenance requests for properties you lease.",
              "error",
            );
          } else {
            Notify(
              data.message || "Error creating maintenance request",
              "error",
            );
          }
          return;
        }
        // Success
        Notify("Maintenance request created successfully", "success");
        loadMaintenance();
        if (window.refreshBadge) window.refreshBadge();
      });
  }

  function editForm(id) {
    const li = document
      .querySelector(`button.edit-req[data-id="${id}"]`)
      .closest("li");
    const currentDesc = li
      .querySelector("br + br")
      .nextSibling.textContent.trim();
    viewContainer.innerHTML = `
      <h2>Edit Request #${id}</h2>
      <form id="edit-form">
        <label>desec:<br>
          <textarea id="edit-desc" required>${currentDesc}</textarea>
        </label><br>
        <button type="submit">Save</button>
        <button type="button" id="cancel">Cancel</button>
      </form>
      <ul id="maint-list"></ul>
    `;
    document
      .getElementById("cancel")
      .addEventListener("click", loadMaintenance);
    document
      .getElementById("edit-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const desec = document.getElementById("edit-desc").value;
        await fetch(`${apiBase}/maintenance/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ desec }),
        });
        loadMaintenance();
        if (window.refreshBadge) window.refreshBadge();
      });
  }
});
