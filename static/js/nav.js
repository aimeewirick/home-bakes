// nav.js
// Universal navigation bar for HomeBakes.
// Import on any page — replaces all hardcoded nav HTML.
//
// Usage in any HTML page's script block:
//   import "/static/js/nav.js";

import { logout } from "/static/js/auth.js";
import { auth } from "/static/js/firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

  <!-- Icons -->
  <div class="hb-nav-icons">
    <button class="hb-nav-icon-btn" id="navLogoutBtn" title="Log out">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.8">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    </button>
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
