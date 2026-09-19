console.log("Config loaded");

// Put everything onto window
window.apiBase = "http://localhost:5001/api";
window.token = localStorage.getItem("token") || "";
window.currView = null;

// decode role once
(function () {
  const t = window.token;
  if (!t) return;
  try {
    const user = JSON.parse(atob(t.split(".")[1]));
    window.role = user.role;
  } catch {
    window.role = "";
  }
})();
