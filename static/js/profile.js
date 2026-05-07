// profile.js
// Handles fridge frame photo upload, caption editing,
// and rotating teaser messages (only shown if no custom photo).

import { auth } from "/static/js/firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const db      = getFirestore();
const storage = getStorage();

// ── Rotating teaser messages ──────────────────────────────────────────────────
const TEASER_MESSAGES = [
  "hang some art 🎨",
  "add a little bling ✨",
  "stick a family photo 📸",
  "show off your pet 🐾",
  "pin a favorite memory 💌",
  "add a kid's drawing 🖍️",
  "your happy place 🌻",
  "make it yours 💛",
];

let teaserIndex  = Math.floor(Math.random() * TEASER_MESSAGES.length);
let teaserTimer  = null;
let currentUID   = null;
let hasCustomPhoto = false;   // ← tracks if user has uploaded a photo

// ── DOM refs ──────────────────────────────────────────────────────────────────
const framePhoto       = document.getElementById("framePhoto");
const frameOverlay     = document.getElementById("frameOverlay");
const teaserText       = document.getElementById("teaserText");
const fileInput        = document.getElementById("frameFileInput");
const captionEl        = document.getElementById("frameCaption");
const captionInput     = document.getElementById("frameCaptionInput");

// ── Load user profile on auth ─────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUID = user.uid;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      const data = userDoc.data();

      // Load saved photo
      if (data.framePhotoURL) {
        framePhoto.src   = data.framePhotoURL;
        hasCustomPhoto   = true;   // ← user has a photo — suppress teasers
        updateDeleteBtn();
      }

      // Load saved caption
      if (data.frameCaption) {
        captionEl.textContent = data.frameCaption;
      }

    } else {
      // First time — create user document
      await setDoc(doc(db, "users", user.uid), {
        displayName:   user.displayName || "",
        email:         user.email,
        framePhotoURL: "",
        frameCaption:  "~ my happy place ~",
        createdAt:     new Date()
      });
    }
  } catch (err) {
    console.error("Error loading profile:", err);
  }
});

// ── Hover — only show teasers if NO custom photo ──────────────────────────────
frameOverlay.addEventListener("mouseenter", () => {
  frameOverlay.classList.add("hovered");

  if (!hasCustomPhoto) {
    // No custom photo yet — show rotating teasers to invite upload
    showNextTeaser();
    teaserTimer = setInterval(showNextTeaser, 1800);
  } else {
    // Has a photo — just show a subtle "change photo" hint
    teaserText.textContent = "change photo 🔄";
    teaserText.style.opacity = "1";
  }
});

frameOverlay.addEventListener("mouseleave", () => {
  frameOverlay.classList.remove("hovered");
  clearInterval(teaserTimer);
  teaserText.style.opacity = "0";
  setTimeout(() => { teaserText.textContent = ""; }, 250);
});

function showNextTeaser() {
  teaserText.style.opacity = "0";
  setTimeout(() => {
    teaserText.textContent   = TEASER_MESSAGES[teaserIndex];
    teaserText.style.opacity = "1";
    teaserIndex = (teaserIndex + 1) % TEASER_MESSAGES.length;
  }, 200);
}

// ── Click frame — open file picker ────────────────────────────────────────────
frameOverlay.addEventListener("click", () => {
  fileInput.click();
});

// ── File selected — upload to Firebase Storage ────────────────────────────────
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !currentUID) return;

  // Show local preview immediately
  const localURL = URL.createObjectURL(file);
  framePhoto.src = localURL;
  hasCustomPhoto = true;   // ← suppress teasers now
  updateDeleteBtn();

  try {
    const storageRef  = ref(storage, `frame-photos/${currentUID}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    await updateDoc(doc(db, "users", currentUID), {
      framePhotoURL: downloadURL
    });

    console.log("Frame photo saved!");
  } catch (err) {
    console.error("Upload failed:", err);
    // Keep local preview even if upload fails
  }
});

// ── Delete photo button ──────────────────────────────────────────────────────
// Creates a small trash button below the frame, only visible when hasCustomPhoto
const deletePhotoBtn = document.createElement("button");
deletePhotoBtn.id        = "deletePhotoBtn";
deletePhotoBtn.title     = "Remove photo";
deletePhotoBtn.innerHTML = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>`;
deletePhotoBtn.style.cssText = `
  display: none;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(192,57,43,0.4);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  color: #C0392B;
  cursor: pointer;
  z-index: 20;
  transition: background 0.2s;
  padding: 0;
`;

// Insert inside fridge-frame so it overlays the image
const fridgeFrame = document.querySelector(".fridge-frame");
fridgeFrame.style.position = "relative";
fridgeFrame.appendChild(deletePhotoBtn);

function updateDeleteBtn() {
  // Only show on hover — managed by mouseenter/mouseleave on fridge-frame
  if (!hasCustomPhoto) {
    deletePhotoBtn.style.display = "none";
  }
}

// Show/hide delete btn on frame hover
fridgeFrame.addEventListener("mouseenter", () => {
  if (hasCustomPhoto) deletePhotoBtn.style.display = "flex";
});
fridgeFrame.addEventListener("mouseleave", () => {
  deletePhotoBtn.style.display = "none";
});

deletePhotoBtn.addEventListener("mouseenter", () => {
  deletePhotoBtn.style.background = "rgba(192,57,43,0.18)";
});
deletePhotoBtn.addEventListener("mouseleave", () => {
  deletePhotoBtn.style.background = "rgba(192,57,43,0.08)";
});

deletePhotoBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!currentUID) return;
  try {
    // Reset to flower
    framePhoto.src = "/static/images/flower.png";
    hasCustomPhoto = false;
    updateDeleteBtn();

    // Clear in Firestore
    await updateDoc(doc(db, "users", currentUID), {
      framePhotoURL: ""
    });
    console.log("Photo removed!");
  } catch(err) {
    console.error("Remove photo failed:", err);
  }
});

// ── Caption — click to edit inline ───────────────────────────────────────────
captionEl.addEventListener("click", () => {
  captionInput.value         = captionEl.textContent;
  captionEl.style.display    = "none";
  captionInput.style.display = "block";
  captionInput.focus();
  captionInput.select();
});

async function saveCaption() {
  const newCaption           = captionInput.value.trim() || "~ my happy place ~";
  captionEl.textContent      = newCaption;
  captionEl.style.display    = "block";
  captionInput.style.display = "none";

  if (!currentUID) return;
  try {
    await updateDoc(doc(db, "users", currentUID), {
      frameCaption: newCaption
    });
  } catch (err) {
    console.error("Caption save failed:", err);
  }
}

captionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter")  saveCaption();
  if (e.key === "Escape") {
    captionInput.style.display = "none";
    captionEl.style.display    = "block";
  }
});

captionInput.addEventListener("blur", saveCaption);
