// footer.js
// Universal site footer for HomeBakes.
// Import on any page — injects copyright bar at the bottom of the page.
//
// Usage in any HTML page's script block:
//   import "/static/js/footer.js";

const style = document.createElement("style");
style.textContent = `
  /* ══════════════════════════════════════════
     UNIVERSAL FOOTER
     Matches topnav in weight and tone.
     Body flex-column ensures footer always
     sits at the true bottom of the viewport.
  ══════════════════════════════════════════ */

  body {
    display: flex !important;
    flex-direction: column !important;
    min-height: 100vh !important;
  }

  /* Grows to fill remaining space, pushing footer down */
  #hb-footer-spacer {
    flex: 1;
  }

  #hb-footer {
    background: white;
    border-top: 1.5px solid #DDD5C8;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    font-family: 'Lato', sans-serif;
    font-size: 0.75rem;
    color: #888880;
    letter-spacing: 0.04em;
    flex-wrap: wrap;
  }

  #hb-footer .hb-footer-copy {
    color: #888880;
  }

  #hb-footer .hb-footer-divider {
    color: #DDD5C8;
    user-select: none;
  }

  #hb-footer .hb-footer-link {
    color: #35595F;
    text-decoration: none;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 0.7rem;
    transition: color 0.2s;
  }

  #hb-footer .hb-footer-link:hover {
    color: #2D7A80;
    text-decoration: underline;
  }
`;
document.head.appendChild(style);

const footer = document.createElement("footer");
footer.id = "hb-footer";
footer.innerHTML = `
  <span class="hb-footer-copy">Created by Aimee Wirick &nbsp;·&nbsp; © ${new Date().getFullYear()} HomeBakes</span>
  <span class="hb-footer-divider">|</span>
  <a class="hb-footer-link" href="#" id="hb-feedback-link">Leave Feedback</a>
`;
// Spacer fills remaining vertical space, pushing footer to bottom
const spacer = document.createElement("div");
spacer.id = "hb-footer-spacer";
document.body.appendChild(spacer);

document.body.appendChild(footer);

// Feedback link — placeholder until Google Sheets form is wired up
document.getElementById("hb-feedback-link").addEventListener("click", (e) => {
  e.preventDefault();
  // TODO: replace href with Google Sheets form URL
  alert("Feedback form coming soon!");
});
