
import { supabase } from "./supabase.js";

async function initNavbar() {
  const navbar = document.getElementById("navbar");

  if (!navbar) return;

  // =========================================
  // DENIED PAGE CHECK
  // =========================================

  const isDeniedPage =
    location.pathname.replace(/\/+$/, "").toLowerCase() === "/declined";

  try {
    const response = await fetch("/navbar.json");

    if (!response.ok) {
      throw new Error("Could not load navbar.json");
    }

    const config = await response.json();

    const { data, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = data.session;
    let profile = null;

    // =========================================
    // BAN CHECK
    // =========================================

    if (session && !isDeniedPage) {
      const { data: result, error } = await supabase
        .from("profiles")
        .select("username, rank, is_banned")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      profile = result;

      if (profile.is_banned === true) {
        location.replace("/Declined/");
        return;
      }
    } else if (session && isDeniedPage) {
      const { data: result, error } = await supabase
        .from("profiles")
        .select("username, rank")
        .eq("id", session.user.id)
        .single();

      if (!error) profile = result;
    }

    // =========================================
    // NAVBAR CONTAINER
    // =========================================

    const container = document.createElement("div");
    container.className = "nav-container";

    // =========================================
    // LOGO
    // =========================================

    const brand = document.createElement("a");
    brand.className = "nav-brand";
    brand.href = "/";

    const logo = document.createElement("img");
    logo.src = config.branding.logo;
    logo.alt = config.branding.name;

    logo.onerror = () => {
      logo.remove();
      brand.textContent = config.branding.name;
    };

    brand.appendChild(logo);
    container.appendChild(brand);

    // =========================================
    // MAIN NAVIGATION
    // =========================================

    const links = document.createElement("nav");
    links.className = "nav-links";

    for (const item of config.navigation || []) {
      if (item.enabled === false) continue;

      if (
        item.permission === "curl_mod" &&
        session?.user.app_metadata?.curl_mod !== true
      ) {
        continue;
      }

      const link = document.createElement("a");

      link.className = "nav-link";
      link.href = item.url;
      link.textContent = item.name;

      if (
        location.pathname === item.url ||
        (item.url !== "/" && location.pathname.startsWith(item.url))
      ) {
        link.classList.add("active");
      }

      links.appendChild(link);
    }

    container.appendChild(links);

    // =========================================
    // ACTIONS
    // =========================================

    const actions = document.createElement("div");
    actions.className = "nav-actions";

    // THEME

    const themeButton = document.createElement("button");

    themeButton.className = "theme-toggle";
    themeButton.type = "button";
    themeButton.setAttribute("aria-label", "Toggle theme");

    function updateThemeIcon() {
      themeButton.textContent =
        document.documentElement.dataset.theme === "light"
          ? "☀"
          : "☾";
    }

    updateThemeIcon();

    themeButton.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      const next = current === "light" ? "dark" : "light";

      document.documentElement.dataset.theme = next;
      localStorage.setItem("curl-theme", next);

      updateThemeIcon();
    });

    actions.appendChild(themeButton);

    // =========================================
    // ACCOUNT
    // =========================================

    if (session && profile) {
      const account = document.createElement("a");

      account.className = "nav-user";
      account.href =
        "/profile/?username=" +
        encodeURIComponent(profile.username);

      const avatar = document.createElement("span");
      avatar.className = "nav-avatar";
      avatar.textContent =
        profile.username.charAt(0).toUpperCase();

      const username = document.createElement("span");
      username.textContent = profile.username;

      account.append(avatar, username);
      actions.appendChild(account);

      // LOGGED-IN LINKS

      for (const item of config.account.loggedIn || []) {
        if (item.enabled === false) continue;

        if (
          item.permission === "curl_mod" &&
          session.user.app_metadata?.curl_mod !== true
        ) {
          continue;
        }

        const link = document.createElement("a");

        link.className = "nav-link";
        link.href = item.url;
        link.textContent = item.name;

        if (
          location.pathname === item.url ||
          (item.url !== "/" && location.pathname.startsWith(item.url))
        ) {
          link.classList.add("active");
        }

        actions.appendChild(link);
      }

    } else {
      // LOGGED-OUT LINKS

      for (const item of config.account.loggedOut || []) {
        if (item.enabled === false) continue;

        const link = document.createElement("a");

        link.href = item.url;

        link.className =
          item.name === "Sign up"
            ? "btn btn-primary"
            : "btn btn-secondary";

        link.textContent = item.name;

        actions.appendChild(link);
      }
    }

    container.appendChild(actions);

    // =========================================
    // MOBILE MENU
    // =========================================

    const menu = document.createElement("button");

    menu.className = "mobile-menu";
    menu.type = "button";
    menu.textContent = "☰";
    menu.setAttribute("aria-label", "Open navigation");
    menu.setAttribute("aria-expanded", "false");

    menu.addEventListener("click", () => {
      const opened = container.classList.toggle("mobile-open");

      menu.textContent = opened ? "✕" : "☰";
      menu.setAttribute("aria-expanded", String(opened));
    });

    container.appendChild(menu);

    navbar.replaceChildren(container);

  } catch (error) {
    console.error("[Curl] Navbar error:", error);
  }
}

initNavbar();
