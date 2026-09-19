//parsing the JWT
function AuthParse(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

//Notification generating fn
function Notify(message, type = "info") {
  const messagebox = document.createElement("div");
  messagebox.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 2000;
    display: flex; align-items: center; justify-content: center;
  `;
  messagebox.innerHTML = `
    <div style="background: white; padding: 2rem; border-radius: 12px;box-shadow: 0 20px 40px rgba(0,0,0,0.3); max-width: 400px; text-align: center;">
      <p style="margin: 0 0 1.5rem 0; color: #333; font-size: 1rem;">${message}</p>
      <button id="dialog-ok" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">OK</button>
    </div>
  `;

  document.body.appendChild(messagebox);

  document.getElementById("dialog-ok").onclick = () => messagebox.remove();
  messagebox.onclick = (e) => {
    if (e.target === messagebox) messagebox.remove();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  // Load stored token
  window.token = localStorage.getItem("token") || "";
  if (window.token) {
    const decoded = AuthParse(window.token);
    window.userId = decoded.id || decoded.sub;
    window.role = decoded.role;
  }

  //Elements
  const authSec = document.getElementById("auth-section");
  const regSec = document.getElementById("register-section");
  const mainApp = document.getElementById("main-app");
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");
  const showRegLink = document.getElementById("show-register");
  const showLoginLink = document.getElementById("show-login");
  const selectRole = document.getElementById("reg-role");
  const secret = document.getElementById("secret-code-field");
  const loginPwd = document.getElementById("login-password");
  const loginFlag = document.getElementById("show-password-login");
  const regPwd = document.getElementById("reg-password");
  const regFlag = document.getElementById("show-password-reg");

  //Password toggle
  if (loginFlag && loginPwd) {
    loginFlag.addEventListener("change", () => {
      loginPwd.type = loginFlag.checked ? "text" : "password";
    });
  }
  if (regFlag && regPwd) {
    regFlag.addEventListener("change", () => {
      regPwd.type = regFlag.checked ? "text" : "password";
    });
  }

  //Mail icon control
  const mailIcon = document.getElementById("inbox-btn");

  //Section switcher
  function showSec(sec) {
    [authSec, regSec, mainApp].forEach((e) =>
      e.classList.add("hidden"),
    );
    sec.classList.remove("hidden");
  }
  if (window.token) showSec(mainApp);
  else showSec(authSec);
  showRegLink.addEventListener("click", (e) => {
    e.preventDefault();
    showSec(regSec);
  });
  showLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    showSec(authSec);
  });

  //Show/hide admin code
  selectRole.addEventListener("change", () => {
    secret.style.display = selectRole.value === "admin" ? "block" : "none";
  });

  //LOGIN
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pwd = loginPwd.value;

    try {
      const res = await fetch(`${window.apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pwd }),
      });

      if (!res.ok) {
        // read whatever the server returned
        let msg_err;
        try {
          msg_err = (await res.json()).message;
        } catch {
          msg_err = await res.text();
        }
        return Notify(`Login failed: ${msg_err}`, "error");
      }

      // parse
      let data;
      try {
        data = await res.json();
      } catch {
        const txt = await res.text();
        console.error("Login response not JSON:", txt);
        return Notify("Unexpected server response: " + txt, "error");
      }

      if (!data.token) {
        return Notify("Login failed No token returned", "error");
      }

      // Success Lets go
      window.token = data.token;
      localStorage.setItem("token", data.token);
      const decoded = AuthParse(data.token);
      window.userId = decoded.id || decoded.sub;
      window.role = decoded.role;
      window.location.reload();
    } catch (err) {
      console.error("Error:", err);
      Notify("Login failed", "error");
    }
  });

  //REGISTER
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("reg-email").value.trim();
    const pwd = regPwd.value;
    const role = selectRole.value;
    const secretAdmin = document.getElementById("reg-admin-code").value.trim();

    const regUser = { email, password: pwd, role };
    if (role === "admin") regUser.secretAdmin = secretAdmin;

    try {
      const res = await fetch(`${window.apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regUser),
      });

      if (!res.ok) {
        let msg_err;
        try {
          msg_err = (await res.json()).message;
        } catch {
          msg_err = await res.text();
        }
        return Notify(`Registration failed ${msg_err}`, "error");
      }

      let data;
      try {
        data = await res.json();
      } catch {
        const txt = await res.text();
        console.error("Register response not JSON", txt);
        return Notify("Unexpected response " + txt, "error");
      }
      if (!data.token) {
        return Notify("Registration done but no token","warning");
      }
      window.token = data.token;
      localStorage.setItem("token", data.token);
      const decoded = AuthParse(data.token);
      window.userId = decoded.id || decoded.sub;
      window.role = decoded.role;
      window.location.reload();
    } catch (err) {
      console.error("Registration error ", err);
      Notify("Registration failed","error",);
    }
  });
});
