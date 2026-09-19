(function () {
  const payBtn = document.querySelector('button[data-view="payments"]');
  if (window.role !== "tenant" && payBtn) {
    payBtn.style.display = "none";
  }
})();

(function () {
  const historyStack = [];
  const backBtn = document.getElementById("back-btn");

  function updateBackButton() {
    if (historyStack.length > 0) {
      backBtn.textContent = "← Go Back";
      backBtn.classList.remove("hidden");
    } else {
      backBtn.classList.add("hidden");
    }
  }
  window.recordView = (fn) => {
    historyStack.push(fn);
    updateBackButton();
  };

  backBtn.addEventListener("click", () => {
    if (historyStack.length === 0) return; // nothing to do
    const prev = historyStack.pop();
    updateBackButton();
    prev();
  });

  const logoutNavBtn = document.getElementById("logout");
  if (logoutNavBtn) {
    logoutNavBtn.addEventListener("click", () => {
      // Create confirm div
      const messageBox = document.createElement("div");
      messageBox.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 2000;
        display: flex; align-items: center; justify-content: center;
      `;
      messageBox.innerHTML = `
        <div style="
          background: white; padding: 2rem; border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3); max-width: 300px; text-align: center;
        ">
          <h3 style="margin: 0 0 1rem 0; color: #333;">Confirm Logout</h3>
          <p style="margin: 0 0 1.5rem 0; color: #666;">Are you sure you want to logout?</p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button id="cancel-logout" style="background: #6c757d; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="confirm-logout" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Logout</button>
          </div>
        </div>
      `;

      document.body.appendChild(messageBox);

      document.getElementById("cancel-logout").onclick = () =>
        messageBox.remove();
      document.getElementById("confirm-logout").onclick = () => {
        localStorage.removeItem("token");
        window.location.reload();
      };

      messageBox.onclick = (e) => {
        if (e.target === messageBox) messageBox.remove();
      };
    });
  }

  // Initialize hidden
  updateBackButton();
})();
