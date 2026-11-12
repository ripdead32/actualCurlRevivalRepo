
import { supabase } from "./supabase.js";

// ==========================================
// BAN SYSTEM
// ==========================================

function isDeniedPage() {
  return location.pathname.replace(/\/+$/, "").toLowerCase() === "/declined";
}

function redirectToDenied() {
  if (!isDeniedPage()) {
    location.replace("/Declined/");
  }
}

function isBannedAuthError(error) {
  return (
    error?.code === "user_banned" ||
    error?.message?.toLowerCase().includes("user banned") ||
    error?.message?.toLowerCase().includes("user is banned")
  );
}

export async function checkBanStatus(userId) {
  if (!userId) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Could not check ban status:", error);
    return false;
  }

  if (data?.is_banned === true) {
    redirectToDenied();
    return true;
  }

  return false;
}

// Check existing sessions whenever this module loads.
async function enforceBanStatus() {
  if (isDeniedPage()) return;

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      if (isBannedAuthError(error)) {
        redirectToDenied();
      } else {
        console.error("Session check failed:", error);
      }

      return;
    }

    if (data.session) {
      await checkBanStatus(data.session.user.id);
    }
  } catch (error) {
    if (isBannedAuthError(error)) {
      redirectToDenied();
    } else {
      console.error("Ban check failed:", error);
    }
  }
}

enforceBanStatus();

// ==========================================
// SHARED FUNCTIONS
// ==========================================

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    if (isBannedAuthError(error)) redirectToDenied();
    throw error;
  }

  return data.session;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data;
}

export async function getCurrentProfile() {
  const session = await getSession();

  if (!session) return null;

  const banned = await checkBanStatus(session.user.id);
  if (banned) return null;

  return getProfile(session.user.id);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;

  location.href = "/";
}

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    location.href = "/login/";
    return null;
  }

  const banned = await checkBanStatus(session.user.id);

  if (banned) return null;

  return session;
}

export async function requireModerator() {
  let user;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;

    if (result.error) {
      if (isBannedAuthError(result.error)) {
        redirectToDenied();
        return null;
      }

      throw result.error;
    }
  } catch (error) {
    if (isBannedAuthError(error)) {
      redirectToDenied();
      return null;
    }

    location.replace("/login/");
    return null;
  }

  if (!user) {
    location.replace("/login/");
    return null;
  }

  const banned = await checkBanStatus(user.id);

  if (banned) return null;

  if (user.app_metadata?.curl_mod !== true) {
    location.replace("/");
    return null;
  }

  const profile = await getProfile(user.id);

  return {
    session: await getSession(),
    profile
  };
}

// ==========================================
// MESSAGE HELPER
// ==========================================

function showMessage(element, message, type = "error") {
  if (!element) return;

  const box = document.createElement("div");
  box.className = `status ${type}`;
  box.textContent = message;

  element.replaceChildren(box);
}

function setLoading(form, loading) {
  const button = form.querySelector(
    'button[type="submit"], button:not([type])'
  );

  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Please wait...";
  } else {
    button.disabled = false;
    button.textContent =
      button.dataset.originalText || button.textContent;
  }
}

// ==========================================
// LOGIN
// ==========================================

const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("auth-message");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    setLoading(loginForm, true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (isBannedAuthError(error)) {
          redirectToDenied();
          return;
        }

        throw error;
      }

      const banned = await checkBanStatus(data.user.id);

      if (banned) return;

      location.href = "/";

    } catch (error) {
      if (isBannedAuthError(error)) {
        redirectToDenied();
      } else {
        showMessage(message, error.message);
      }
    } finally {
      setLoading(loginForm, false);
    }
  });
}

// ==========================================
// REGISTER
// ==========================================

const registerForm = document.getElementById("register-form");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("auth-message");

    const username =
      document.getElementById("username").value.trim();

    const email =
      document.getElementById("email").value.trim();

    const password =
      document.getElementById("password").value;

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      showMessage(
        message,
        "Username must be 3–20 characters and contain only letters, numbers and underscores."
      );
      return;
    }

    setLoading(registerForm, true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          },
          emailRedirectTo: location.origin + "/"
        }
      });

      if (error) throw error;

      if (data.session) {
        showMessage(
          message,
          "Your account was created successfully!",
          "success"
        );

        setTimeout(() => {
          location.href = "/";
        }, 1200);
      } else {
        showMessage(
          message,
          "Account created! Check your email to verify your address.",
          "success"
        );
      }

    } catch (error) {
      showMessage(message, error.message);
    } finally {
      setLoading(registerForm, false);
    }
  });
}

// ==========================================
// FORGOT PASSWORD
// ==========================================

const forgotForm = document.getElementById("forgot-form");

if (forgotForm) {
  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("auth-message");

    const email =
      document.getElementById("email").value.trim();

    setLoading(forgotForm, true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/forgot-password/"
        });

      if (error) throw error;

      showMessage(
        message,
        "If an account exists for that email, a recovery link will be sent.",
        "success"
      );

    } catch (error) {
      showMessage(message, error.message);
    } finally {
      setLoading(forgotForm, false);
    }
  });
}

// ==========================================
// PASSWORD RECOVERY
// ==========================================

const recoveryRequest =
  document.getElementById("recovery-request");

const recoveryUpdate =
  document.getElementById("recovery-update");

const recoveryMessage =
  document.getElementById("recovery-message");

if (recoveryRequest && recoveryUpdate) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryRequest.hidden = true;
      recoveryUpdate.hidden = false;
    }
  });

  const resetForm = document.getElementById("reset-form");

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password =
      document.getElementById("new-password").value;

    if (password.length < 8) {
      showMessage(
        recoveryMessage,
        "Your password must be at least 8 characters."
      );
      return;
    }

    setLoading(resetForm, true);

    try {
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;

      showMessage(
        recoveryMessage,
        "Password updated successfully!",
        "success"
      );

      setTimeout(() => {
        location.href = "/login/";
      }, 1500);

    } catch (error) {
      showMessage(recoveryMessage, error.message);
    } finally {
      setLoading(resetForm, false);
    }
  });
}

// ==========================================
// SETTINGS
// ==========================================

const settingsForm =
  document.getElementById("settings-form");

if (settingsForm) {
  async function loadSettings() {
    try {
      const session = await requireAuth();

      if (!session) return;

      const profile = await getProfile(session.user.id);

      document.getElementById("username").value =
        profile.username;

      document.getElementById("bio").value =
        profile.bio || "";

    } catch (error) {
      showMessage(
        document.getElementById("settings-message"),
        error.message
      );
    }
  }

  loadSettings();

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message =
      document.getElementById("settings-message");

    const username =
      document.getElementById("username").value.trim();

    const bio =
      document.getElementById("bio").value.trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      showMessage(message, "Invalid username.");
      return;
    }

    setLoading(settingsForm, true);

    try {
      const session = await requireAuth();

      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          bio
        })
        .eq("id", session.user.id);

      if (error) throw error;

      showMessage(
        message,
        "Your profile has been updated!",
        "success"
      );

    } catch (error) {
      showMessage(message, error.message);
    } finally {
      setLoading(settingsForm, false);
    }
  });
}

// ==========================================
// LOGOUT
// ==========================================

const logoutButton =
  document.getElementById("logout-button");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    try {
      await signOut();
    } catch (error) {
      logoutButton.disabled = false;
      logoutButton.textContent = "Log out";

      alert(error.message);
    }
  });
}
