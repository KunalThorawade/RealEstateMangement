//notification system
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
  const profileBtn = document.querySelector('button[data-view="tenants"]');
  const viewContainer = document.getElementById("view-container");

  profileBtn.addEventListener("click", () => {
    if (typeof currentView === "function") recordView(currentView);
    currentView = showProfile;
    showProfile();
  });

  async function showProfile() {
    viewContainer.innerHTML = "<h2>My Profile</h2><p>Loading…</p>";
    try {
      const res = await fetch(`${apiBase}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");

      let html = `
        <p><strong>User ID:</strong> ${data.userId}</p>
        <p><strong>Email:</strong>   ${data.email}</p>
        <p><strong>Role:</strong>    ${data.role}</p>
      `;

      if (data.role === "tenant") {
        html += `
          <p><strong>Name:</strong> ${data.name || "—"}</p>
          <p><strong>Phone:</strong>${data.phone || "—"}</p>
          <p><strong>Properties Held:</strong> ${data.properties}</p>
        `;
      }

      // Update email section
      html += `
        <h3>Update Email</h3>
        <form id="update-form">
          <label>New Email:
            <input type="email" id="new-email" required />
          </label><br>
          <label>Current Password:
            <input type="password" id="current-pwd" required />
          </label><br>
          <button type="submit">Update Email</button>
        </form>

        <h3>Delete Account</h3>
        <p style="color: #d73527; font-size: 0.9rem;">⚠️ This will permanently delete your account and all data.</p>
        <form id="delete-form">
          <label>Current Password:
            <input type="password" id="delete-pwd" required />
          </label><br>
          <div class="checkbox-wrapper">
            <input type="checkbox" id="confirm-delete" required />
            <label for="confirm-delete">I understand this cannot be undone</label>
          </div>
          <button type="submit" style="background: #e53e3e;">Delete Account</button>
        </form>
      `;

      // Admin section
      if (data.role === "admin") {
        html += `
          <h3>Admin: Delete User</h3>
          <p style="color: #b7791f; font-size: 0.9rem;">🔧 Admin only - delete any user account.</p>
          <form id="delete-user-form">
            <label>User ID to delete:
              <input type="text" id="target-user-id" required />
            </label><br>
            <label>Your Password:
              <input type="password" id="admin-password" required />
            </label><br>
            <label>Super Secret Key:
              <input type="password" id="super-key" required />
            </label><br>
            <div class="checkbox-wrapper">
              <input type="checkbox" id="confirm-admin-delete" required />
              <label for="confirm-admin-delete">Confirm deletion</label>
            </div>
            <button type="submit" style="background: #e53e3e;">Delete User</button>
          </form>
        `;
      }

      viewContainer.innerHTML = `<h2>My Profile</h2>${html}`;

      // Update email handler
      document
        .getElementById("update-form")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const newEmail = document.getElementById("new-email").value.trim();
          const pwd = document.getElementById("current-pwd").value;

          const resp = await fetch(`${apiBase}/profile`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email: newEmail, currentPassword: pwd }),
          });

          const resData = await resp.json();
          if (resp.ok) {
            Notify("Email updated successfully!", "success");
            showProfile();
          } else {
            Notify("Error: " + resData.message, "error");
          }
        });

      // Delete own account
      document
        .getElementById("delete-form")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const pwd = document.getElementById("delete-pwd").value;
          const confirmChecked =
            document.getElementById("confirm-delete").checked;

          if (!confirmChecked) {
            Notify("Please check the confirmation box.", "warning");
            return;
          }

          if (!confirm("This will delete your account forever. Continue?"))
            return;

          const resp = await fetch(`${apiBase}/profile`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ currentPassword: pwd }),
          });

          const resData = await resp.json();
          if (resp.ok) {
            Notify(
              "Account deleted. You will be logged out.",
              "success",
            );
            localStorage.removeItem("token");
            window.location.reload();
          } else {
            Notify("Error: " + resData.message, "error");
          }
        });

      // Admin deletes any user
      if (data.role === "admin") {
        document
          .getElementById("delete-user-form")
          .addEventListener("submit", async (e) => {
            e.preventDefault();
            const targetId = document
              .getElementById("target-user-id")
              .value.trim();
            const password = document.getElementById("admin-password").value;
            const secret = document.getElementById("super-key").value;
            const confirmChecked = document.getElementById(
              "confirm-admin-delete",
            ).checked;

            if (!confirmChecked) {
              Notify("Please check the confirmation box.", "warning");
              return;
            }

            if (!confirm(`Really delete user #${targetId}?`)) return;

            const resp = await fetch(`${apiBase}/admin/delete-user`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                targetUserId: targetId,
                adminPassword: password,
                superSecretKey: secret,
              }),
            });

            const result = await resp.json();
            if (resp.ok) {
              Notify(
                result.message || "User deleted successfully.",
                "success",
              );
              showProfile();
            } else {
              Notify("Error: " + result.message, "error");
            }
          });
      }
    } catch (err) {
      console.error("tenant.js profile error:", err);
      viewContainer.innerHTML = `<p>Error loading profile: ${err.message}</p>`;
    }
  }
});
