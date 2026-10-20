import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
  ActionCodeSettings,
  GoogleAuthProvider,
  updateProfile,
  User,
  UserCredential,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Reusable Firebase Authentication Service
 * Implements client-side authentication, Google OAuth, session state, email verification, and error mapping.
 */

export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && cred.user) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch (e) {
      console.warn("Failed to set display name on signup:", e);
    }
  }
  return cred;
}

export async function signInWithEmail(
  email: string,
  pass: string
): Promise<UserCredential> {
  return await signInWithEmailAndPassword(auth, email.trim(), pass);
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return await signInWithPopup(auth, provider);
}

export async function resetUserPassword(email: string): Promise<void> {
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const actionCodeSettings: ActionCodeSettings = {
    url: `${appUrl}/auth/action?mode=resetPassword`,
    handleCodeInApp: true,
  };
  return await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
}

/**
 * Sends a Firebase Email Verification link to the specified or currently active user.
 */
export async function sendUserEmailVerification(user?: User | null): Promise<void> {
  const targetUser = user || auth.currentUser;
  if (!targetUser) {
    throw new Error("No active user session found to send verification email.");
  }

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const actionCodeSettings: ActionCodeSettings = {
    url: `${appUrl}/auth/action?mode=verifyEmail`,
    handleCodeInApp: true,
  };

  await sendEmailVerification(targetUser, actionCodeSettings);
}

/**
 * Applies a Firebase action code to verify the user's email address.
 */
export async function verifyEmailActionCode(oobCode: string): Promise<void> {
  await applyActionCode(auth, oobCode);
  if (auth.currentUser) {
    await auth.currentUser.reload();
  }
}

/**
 * Validates the metadata for a Firebase out-of-band action code.
 */
export async function checkActionCodeValidity(oobCode: string) {
  return await checkActionCode(auth, oobCode);
}

/**
 * Reloads the current user profile from Firebase to refresh claims and verification status.
 */
export async function reloadCurrentUser(): Promise<User | null> {
  if (auth.currentUser) {
    await auth.currentUser.reload();
    return auth.currentUser;
  }
  return null;
}

/**
 * Confirms a password reset with a new password using an action code.
 */
export async function confirmUserPasswordReset(
  oobCode: string,
  newPass: string
): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPass);
}

export async function signOutUser(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("scanly_dev_token");
  }
  return await signOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Waits for Firebase Auth to complete initial credential restoration from IndexedDB.
 */
export async function waitForAuthInit(): Promise<User | null> {
  if (typeof (auth as any).authStateReady === "function") {
    await auth.authStateReady();
    return auth.currentUser;
  }
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Obtains the real cryptographic Firebase JWT ID token.
 * Waits for Firebase initialization if called before onAuthStateChanged resolves.
 */
export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  let user = auth.currentUser;
  if (!user) {
    user = await waitForAuthInit();
  }
  if (!user) {
    return null;
  }
  try {
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.error("Failed to retrieve Firebase ID token:", err);
    return null;
  }
}

/**
 * Maps Firebase Auth error codes into clean, actionable, human-friendly messages.
 */
export function getAuthErrorMessage(error: any): string {
  const code = error?.code || "";
  const rawMessage = error?.message || "";

  switch (code) {
    case "auth/invalid-email":
      return "The email address entered is invalid.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact SiteSecura support.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in or reset your password.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 8 characters with numbers and symbols.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before completing authentication.";
    case "auth/popup-blocked":
      return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
    case "auth/cancelled-popup-request":
      return "Only one sign-in request allowed at a time.";
    case "auth/network-request-failed":
      return "A network error occurred. Please check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few moments before trying again.";
    case "auth/invalid-action-code":
      return "This verification link is invalid, expired, or has already been used.";
    case "auth/expired-action-code":
      return "This verification link has expired. Please request a new verification email.";
    case "auth/user-token-expired":
      return "Your authentication session has expired. Please sign in again.";
    case "auth/requires-recent-login":
      return "This sensitive action requires recent authentication. Please sign in again.";
    default:
      return rawMessage || "An unexpected error occurred during authentication. Please try again.";
  }
}
