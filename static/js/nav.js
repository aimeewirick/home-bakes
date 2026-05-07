// nav.js
// Universal navigation bar for HomeBakes.
// Import on any page — replaces all hardcoded nav HTML.
//
// Usage in any HTML page's script block:
//   import "/static/js/nav.js";

import { logout } from "/static/js/auth.js";
import { auth } from "/static/js/firebase-init.js";
import { onAuthStateChanged, updateProfile, updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Active page detection ─────────────────────────────────────────────────────
const path = window.location.pathname;

function isActive(href) {
  if (href === "/index.html" && (path === "/" || path === "/index.html")) return true;
  if (href !== "/index.html" && path.includes(href.replace(".html", ""))) return true;
  return false;
}

const links = [
  { href: "/index.html",          label: "Home" },
  { href: "/meal-plans.html",     label: "Meal Plans" },
  { href: "/recipes.html",        label: "Recipes" },
  { href: "/shopping-lists.html", label: "Shopping Lists" },
];

// ── Inject nav styles ─────────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  /* ══════════════════════════════════════════
     UNIVERSAL NAV
     - White space above nav
     - Subtle border top and bottom
     - Circular icon overlaps both borders
  ══════════════════════════════════════════ */

  /* Spacer above nav — white breathing room */
  #hb-nav-spacer {
    height: 18px;
    background: white;
  }

  #hb-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: white;
    /* Subtle border lines top and bottom */
    border-top: 1.5px solid #DDD5C8;
    border-bottom: 1.5px solid #DDD5C8;
    display: flex;
    align-items: center;
    padding: 0 1.5rem;
    height: 72px;
    gap: 1.5rem;
    overflow: visible;   /* allows icon to bleed above/below borders */
  }

  /* ── Brand: circular icon overlaps borders ── */
  .hb-nav-brand {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    text-decoration: none;
    flex-shrink: 0;
    /* Pull icon above top border and below bottom border */
    margin-top: -22px;
    margin-bottom: -22px;
    position: relative;
    z-index: 101;  /* above the nav borders */
  }

  .hb-nav-icon {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
    filter: drop-shadow(0 3px 10px rgba(0,0,0,0.25));
    flex-shrink: 0;
    /* Sits above the border lines */
    position: relative;
    z-index: 101;
  }

  .hb-nav-title {
    font-family: 'Playfair Display', serif;
    font-size: 2rem;
    font-weight: 700;
    color: #2C3E6B;
    letter-spacing: 0.02em;
    white-space: nowrap;
    font-variant: small-caps;
  }

  /* ── Nav links ── */
  .hb-nav-links {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 0.25rem;
    margin-left: auto;
  }

  .hb-nav-links a {
    text-decoration: none;
    font-family: 'Lato', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-mid, #6B5B4E);
    padding: 0.4rem 0.75rem;
    border-radius: 100px;
    border: 1.5px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .hb-nav-links a:hover {
    color: var(--teal-dark, #35595F);
  }

  .hb-nav-links a.active {
    border-color: #C0392B;
    color: #C0392B;
  }

  /* ── Nav icons (logout etc) ── */
  .hb-nav-icons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .hb-nav-icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-mid, #6B5B4E);
    padding: 0.4rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .hb-nav-icon-btn:hover { color: var(--teal-dark, #35595F); }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .hb-nav-title { display: none; }
    .hb-nav-links a { font-size: 0.7rem; padding: 0.3rem 0.5rem; }
    #hb-nav { padding: 0 0.75rem; gap: 0.5rem; }
    .hb-nav-icon { width: 68px; height: 68px; }
  }

  /* ── Profile button ── */
  .hb-profile-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #98D0D6;
    border: 2px solid #35595F;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #35595F;
    font-family: 'Lato', sans-serif;
    font-weight: 700;
    font-size: 0.85rem;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .hb-profile-btn:hover { background: #7EC4CA; }

  /* ── Profile popup ── */
  #hb-profile-popup {
    display: none;
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 280px;
    background: white;
    border-radius: 12px;
    border: 1px solid #DDD5C8;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    z-index: 500;
    overflow: hidden;
  }
  #hb-profile-popup.open { display: block; }

  .profile-popup-header {
    background: #98D0D6;
    padding: 1rem 1.25rem 0.85rem;
    position: relative;
  }

  .profile-popup-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #35595F;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Lato', sans-serif;
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    border: 2px solid rgba(255,255,255,0.5);
  }

  .profile-popup-name {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    font-weight: 700;
    color: #35595F;
  }

  .profile-popup-email {
    font-size: 0.75rem;
    color: rgba(53,89,95,0.7);
    font-family: 'Lato', sans-serif;
    margin-top: 0.1rem;
  }

  .profile-popup-body {
    padding: 0.75rem 0;
  }

  .profile-popup-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1.25rem;
    font-family: 'Lato', sans-serif;
    font-size: 0.85rem;
    color: #6B5B4E;
    cursor: pointer;
    transition: background 0.15s;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
  }
  .profile-popup-item:hover { background: #F8F5EE; color: #35595F; }
  .profile-popup-item.danger { color: #C0392B; }
  .profile-popup-item.danger:hover { background: #FEE2E2; }

  .profile-popup-divider {
    height: 1px;
    background: #EDE8E1;
    margin: 0.35rem 0;
  }

  /* ── Edit field inline ── */
  .profile-edit-row {
    padding: 0.5rem 1.25rem;
    display: none;
  }
  .profile-edit-row.open { display: flex; gap: 0.5rem; align-items: center; }
  .profile-edit-input {
    flex: 1;
    border: 1.5px solid #DDD5C8;
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    font-family: 'Lato', sans-serif;
    font-size: 0.82rem;
    outline: none;
  }
  .profile-edit-input:focus { border-color: #98D0D6; }
  .profile-edit-save {
    background: #35595F;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.35rem 0.65rem;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Lato', sans-serif;
  }

  /* ── Delete warning ── */
  #hb-delete-warning {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 600;
    align-items: center;
    justify-content: center;
  }
  #hb-delete-warning.open { display: flex; }
  .delete-warning-box {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 380px;
    width: 90%;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  .delete-warning-box h2 {
    font-family: 'Playfair Display', serif;
    color: #C0392B;
    margin-bottom: 0.75rem;
  }
  .delete-warning-box p {
    font-size: 0.88rem;
    color: #6B5B4E;
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }
  .delete-warning-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1.5rem;
  }
`;
document.head.appendChild(style);

// ── Build nav HTML ────────────────────────────────────────────────────────────
const nav = document.createElement("nav");
nav.id = "hb-nav";
nav.innerHTML = `
  <!-- Brand: oversized circular icon + HomeBakes title -->
  <a class="hb-nav-brand" href="/index.html">
    <img class="hb-nav-icon"
         src="/static/images/HomBakes_Icon.png"
         alt="HomeBakes" />
    <span class="hb-nav-title">HomeBakes</span>
  </a>

  <!-- Page links -->
  <ul class="hb-nav-links">
    ${links.map(l => `
      <li>
        <a href="${l.href}"${isActive(l.href) ? ' class="active"' : ''}>
          ${l.label}
        </a>
      </li>
    `).join("")}
  </ul>

  <!-- Home page welcome text — only shown on index -->
  <span id="hb-nav-welcome" style="
    font-family: 'Playfair Display', serif;
    font-size: 0.95rem;
    font-style: italic;
    color: #35595F;
    font-variant: small-caps;
    letter-spacing: 0.04em;
    opacity: 0;
    transition: opacity 0.5s;
  "></span>

  <!-- Icons -->
  <div class="hb-nav-icons" style="position:relative;">
    <button class="hb-profile-btn" id="navProfileBtn" title="Your profile">
      ?
    </button>

    <!-- Profile popup -->
    <div id="hb-profile-popup">
      <div class="profile-popup-header">
        <div class="profile-popup-avatar" id="profileAvatar">?</div>
        <div class="profile-popup-name" id="profileName">Loading...</div>
        <div class="profile-popup-email" id="profileEmail"></div>
      </div>
      <div class="profile-popup-body">

        <!-- Edit name -->
        <button class="profile-popup-item" id="editNameBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit Name
        </button>
        <div class="profile-edit-row" id="editNameRow">
          <input type="text" class="profile-edit-input" id="editNameInput" placeholder="Your name..." />
          <button class="profile-edit-save" id="saveNameBtn">Save</button>
        </div>

        <!-- Edit email -->
        <button class="profile-popup-item" id="editEmailBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Edit Email
        </button>
        <div class="profile-edit-row" id="editEmailRow">
          <input type="email" class="profile-edit-input" id="editEmailInput" placeholder="New email..." />
          <button class="profile-edit-save" id="saveEmailBtn">Save</button>
        </div>

        <!-- Change password -->
        <button class="profile-popup-item" id="changePasswordBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Change Password
        </button>
        <div class="profile-edit-row" id="changePasswordRow" style="flex-direction:column; gap:0.4rem;">
          <div style="display:flex; gap:0.5rem; width:100%;">
            <input type="password" class="profile-edit-input" id="currentPasswordInput" placeholder="Current password..." style="flex:1;" />
          </div>
          <div style="display:flex; gap:0.5rem; width:100%;">
            <input type="password" class="profile-edit-input" id="newPasswordInput" placeholder="New password..." style="flex:1;" />
          </div>
          <div style="display:flex; gap:0.5rem; width:100%;">
            <input type="password" class="profile-edit-input" id="confirmPasswordInput" placeholder="Confirm new password..." style="flex:1;" />
            <button class="profile-edit-save" id="savePasswordBtn">Save</button>
          </div>
        </div>

        <div class="profile-popup-divider"></div>

        <!-- Logout -->
        <button class="profile-popup-item" id="navLogoutBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Log Out
        </button>

        <div class="profile-popup-divider"></div>

        <!-- Delete account -->
        <button class="profile-popup-item danger" id="deleteAccountBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Delete Account
        </button>

      </div>
    </div>
  </div>
`;

// Insert spacer above nav
const spacer = document.createElement("div");
spacer.id = "hb-nav-spacer";
document.body.insertAdjacentElement("afterbegin", spacer);

// Insert nav after spacer
spacer.insertAdjacentElement("afterend", nav);

// Wire logout button
document.getElementById("navLogoutBtn").addEventListener("click", () => logout());

// ── Profile popup ─────────────────────────────────────────────────────────────


const profileBtn   = document.getElementById("navProfileBtn");
const profilePopup = document.getElementById("hb-profile-popup");

// Toggle popup
profileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  profilePopup.classList.toggle("open");
  // Close all edit rows when opening
  document.querySelectorAll(".profile-edit-row").forEach(r => r.classList.remove("open"));
});

// Close on outside click
document.addEventListener("click", (e) => {
  if (!profilePopup.contains(e.target) && e.target !== profileBtn) {
    profilePopup.classList.remove("open");
    document.querySelectorAll(".profile-edit-row").forEach(r => r.classList.remove("open"));
  }
});

// Populate with user data
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const name   = user.displayName || user.email.split("@")[0];
  const initials = name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();

  document.getElementById("profileAvatar").textContent = initials;
  document.getElementById("profileName").textContent   = name;
  document.getElementById("profileEmail").textContent  = user.email;
  profileBtn.textContent = initials;

  // ── Edit name ──────────────────────────────────────────────────────────────
  document.getElementById("editNameBtn").addEventListener("click", () => {
    const row = document.getElementById("editNameRow");
    row.classList.toggle("open");
    if (row.classList.contains("open")) {
      document.getElementById("editNameInput").value = user.displayName || "";
      document.getElementById("editNameInput").focus();
    }
  });

  document.getElementById("saveNameBtn").addEventListener("click", async () => {
    const newName = document.getElementById("editNameInput").value.trim();
    if (!newName) return;
    try {
      await updateProfile(user, { displayName: newName });
      document.getElementById("profileName").textContent = newName;
      document.getElementById("profileAvatar").textContent =
        newName.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
      profileBtn.textContent =
        newName.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
      document.getElementById("editNameRow").classList.remove("open");
    } catch(err) { alert("Failed to update name. Please try again."); }
  });

  // ── Edit email ─────────────────────────────────────────────────────────────
  document.getElementById("editEmailBtn").addEventListener("click", () => {
    const row = document.getElementById("editEmailRow");
    row.classList.toggle("open");
    if (row.classList.contains("open")) {
      document.getElementById("editEmailInput").value = user.email;
      document.getElementById("editEmailInput").focus();
    }
  });

  // Add password field for email reauth
  const emailReauthRow = document.createElement("div");
  emailReauthRow.id = "emailReauthRow";
  emailReauthRow.style.cssText = "display:none; flex-direction:column; gap:0.4rem; padding:0.5rem 1.25rem;";
  emailReauthRow.innerHTML = `
    <div style="font-size:0.78rem; color:#6B5B4E; font-family:'Lato',sans-serif; margin-bottom:0.2rem;">
      Enter your current password to confirm:
    </div>
    <div style="display:flex; gap:0.5rem;">
      <input type="password" id="emailReauthInput" class="profile-edit-input"
             placeholder="Current password..." style="flex:1;" />
      <button class="profile-edit-save" id="confirmEmailChangeBtn">Confirm</button>
    </div>
  `;
  document.getElementById("editEmailRow").insertAdjacentElement("afterend", emailReauthRow);

  let pendingNewEmail = null;

  document.getElementById("saveEmailBtn").addEventListener("click", async () => {
    const newEmail = document.getElementById("editEmailInput").value.trim();
    if (!newEmail) return;
    if (newEmail === user.email) {
      alert("That's already your current email address.");
      return;
    }
    const confirmed = confirm(`Are you sure you want to change your email to:\n${newEmail}?\n\nYou may need to verify your new email address.`);
    if (!confirmed) return;
    // Show reauth step
    pendingNewEmail = newEmail;
    emailReauthRow.style.display = "flex";
    document.getElementById("editEmailRow").classList.remove("open");
    document.getElementById("emailReauthInput").value = "";
    document.getElementById("emailReauthInput").focus();
  });

  document.getElementById("confirmEmailChangeBtn").addEventListener("click", async () => {
    const currentPassword = document.getElementById("emailReauthInput").value;
    if (!currentPassword) return;
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, pendingNewEmail);
      document.getElementById("profileEmail").textContent = pendingNewEmail;
      emailReauthRow.style.display = "none";
      document.getElementById("emailReauthInput").value = "";
      pendingNewEmail = null;
      alert("✅ Email updated! Please check your new inbox for a verification email.");
    } catch(err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        alert("Current password is incorrect. Please try again.");
        document.getElementById("emailReauthInput").value = "";
      } else {
        alert("Failed to update email. Please try again.");
        console.error(err);
      }
    }
  });

  // ── Change password ────────────────────────────────────────────────────────
  document.getElementById("changePasswordBtn").addEventListener("click", () => {
    const row = document.getElementById("changePasswordRow");
    row.classList.toggle("open");
    if (row.classList.contains("open")) {
      document.getElementById("currentPasswordInput").value = "";
      document.getElementById("newPasswordInput").value     = "";
      document.getElementById("confirmPasswordInput").value = "";
      document.getElementById("currentPasswordInput").focus();
    }
  });

  document.getElementById("savePasswordBtn").addEventListener("click", async () => {
    const currentPassword = document.getElementById("currentPasswordInput").value;
    const newPassword     = document.getElementById("newPasswordInput").value;
    const confirmPassword = document.getElementById("confirmPasswordInput").value;

    if (!currentPassword) {
      alert("Please enter your current password.");
      document.getElementById("currentPasswordInput").focus();
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match. Please try again.");
      document.getElementById("confirmPasswordInput").value = "";
      document.getElementById("confirmPasswordInput").focus();
      return;
    }
    if (currentPassword === newPassword) {
      alert("New password must be different from your current password.");
      return;
    }
    const confirmed = confirm("Are you sure you want to change your password?");
    if (!confirmed) return;

    try {
      // Reauthenticate first with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      // Now safe to update
      await updatePassword(user, newPassword);
      document.getElementById("changePasswordRow").classList.remove("open");
      document.getElementById("currentPasswordInput").value = "";
      document.getElementById("newPasswordInput").value     = "";
      document.getElementById("confirmPasswordInput").value = "";
      alert("✅ Password updated successfully!");
    } catch(err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        alert("Current password is incorrect. Please try again.");
        document.getElementById("currentPasswordInput").value = "";
        document.getElementById("currentPasswordInput").focus();
      } else {
        alert("Failed to update password. Please try again.");
        console.error(err);
      }
    }
  });

  // ── Delete account ─────────────────────────────────────────────────────────
  document.getElementById("deleteAccountBtn").addEventListener("click", () => {
    document.getElementById("hb-delete-warning").classList.add("open");
    profilePopup.classList.remove("open");
  });
});

// ── Show admin link if user has admin claim ───────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin) {
      const adminLi = document.createElement("li");
      adminLi.innerHTML = `
        <a href="/admin.html"${path.includes("admin") ? ' class="active"' : ''}
           style="color: #C0392B;">
          ⚙️ Admin
        </a>`;
      nav.querySelector(".hb-nav-links").appendChild(adminLi);
    }
  } catch (err) {
    console.error("Failed to check admin claim:", err);
  }
});

// ── Delete account warning modal ─────────────────────────────────────────────
const deleteWarning = document.createElement("div");
deleteWarning.id = "hb-delete-warning";
deleteWarning.innerHTML = `
  <div class="delete-warning-box">
    <h2>⚠️ Delete Account?</h2>
    <p>This will permanently delete your account and <strong>all of your data</strong>, including:</p>
    <p style="text-align:left; font-size:0.82rem; color:#6B5B4E; margin:0.5rem 0;">
      🗑️ Your recipes<br/>
      🗑️ Your meal plans<br/>
      🗑️ Your shopping lists<br/>
      🗑️ Your private ingredients
    </p>
    <p><strong>This cannot be undone.</strong></p>
    <div class="delete-warning-actions">
      <button id="cancelDeleteAccount" style="background:#F8F5EE; border:1.5px solid #DDD5C8; border-radius:8px; padding:0.55rem 1.25rem; font-family:'Lato',sans-serif; font-weight:700; cursor:pointer; font-size:0.85rem;">
        Cancel
      </button>
      <button id="confirmDeleteAccount" style="background:#DC2626; color:white; border:none; border-radius:8px; padding:0.55rem 1.25rem; font-family:'Lato',sans-serif; font-weight:700; cursor:pointer; font-size:0.85rem;">
        Yes, Delete My Account
      </button>
    </div>
  </div>
`;
document.body.appendChild(deleteWarning);

document.getElementById("cancelDeleteAccount").addEventListener("click", () => {
  deleteWarning.classList.remove("open");
});

document.getElementById("confirmDeleteAccount").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const currentPassword = prompt("To confirm deletion, please enter your current password:");
  if (!currentPassword) return;
  try {
    // Reauthenticate first
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Call backend to delete all user data + auth account
    const token = await user.getIdToken();
    const res   = await fetch("/api/user/delete-account", {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Backend delete failed");
    window.location.href = "/login.html";

  } catch(err) {
    deleteWarning.classList.remove("open");
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      alert("Incorrect password. Account was not deleted.");
    } else {
      alert("Failed to delete account. Please try again.");
      console.error(err);
    }
  }
});

// ── Home page only — show personalized welcome in nav ──────────────────────
if (path === "/" || path === "/index.html") {
  const welcomeEl = document.createElement("span");
  welcomeEl.id = "navWelcome";
  welcomeEl.style.cssText = `
    font-family: 'Playfair Display', serif;
    font-size: 0.9rem;
    color: #35595F;
    font-style: italic;
    white-space: nowrap;
    pointer-events: none;
    flex: 1;
    text-align: center;
    overflow: hidden;
    min-width: 0;
  `;
  welcomeEl.textContent = "Welcome to Chef's Kitchen";

  // Insert BEFORE nav links so it sits in the middle flex slot
  const navLinks = nav.querySelector(".hb-nav-links");
  nav.insertBefore(welcomeEl, navLinks);

  // Update with actual username once loaded
  const observer = new MutationObserver(() => {
    const name = document.getElementById("userName")?.textContent;
    if (name && name !== "Chef") {
      welcomeEl.textContent = `Welcome to ${name}'s Kitchen`;
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });


}
