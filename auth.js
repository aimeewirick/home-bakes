import { auth } from "/static/js/firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export async function register(email, password, displayName) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName });
  // Send verification email
  await sendEmailVerification(userCredential.user, {
    url: window.location.origin + "/login.html",
    handleCodeInApp: false
  });
  return userCredential.user;
}

export async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (user && !user.emailVerified) {
    await sendEmailVerification(user, {
      url: window.location.origin + "/login.html",
      handleCodeInApp: false
    });
  }
}

export async function isAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  const token = await user.getIdTokenResult();
  return token.claims.admin === true;
}

export async function login(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function logout() {
  await signOut(auth);
  window.location.href = "/login.html";
}

export async function getToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

export function requireAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "/login.html";
    } else if (!user.emailVerified) {
      // Redirect unverified users to verification page
      window.location.href = "/verify-email.html";
    } else {
      if (callback) callback(user);
    }
  });
}

export function requireAdmin(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
    } else if (!user.emailVerified) {
      window.location.href = "/verify-email.html";
    } else {
      const token = await user.getIdTokenResult();
      if (!token.claims.admin) {
        window.location.href = "/index.html";
      } else {
        if (callback) callback(user);
      }
    }
  });
}

export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "/index.html";
  });
}
