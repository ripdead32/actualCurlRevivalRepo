
import { supabase } from "./supabase.js";
import { getSession } from "./auth.js";

const content = document.getElementById("profile-content");

async function loadProfile() {
  try {
    const params = new URLSearchParams(location.search);
    const username = params.get("username");

    let query = supabase
      .from("profiles")
      .select("id, uid, curl_id, username, display_name, bio, avatar_url, rank, verified, curl_mod, created_at");

    if (username) {
      query = query.ilike("username", username);
    } else {
      const session = await getSession();

      if (!session) {
        location.href = "/login/";
        return;
      }

      query = query.eq("id", session.user.id);
    }

    const { data: profile, error } = await query.maybeSingle();

    if (error) throw error;

    if (!profile) {
      content.innerHTML =
        '<div class="card card-padding">Profile not found.</div>';
      return;
    }

    const session = await getSession();
    const isOwner = session?.user.id === profile.id;

    // Fetch badges
    const [
      { data: verified, error: verifiedError },
      { data: moderator, error: moderatorError }
    ] = await Promise.all([
      supabase
        .from("verified")
        .select("user_id")
        .eq("user_id", profile.id)
        .maybeSingle(),

      supabase
        .from("curl_mod")
        .select("user_id")
        .eq("user_id", profile.id)
        .maybeSingle()
    ]);

    if (verifiedError) throw verifiedError;
    if (moderatorError) throw moderatorError;

    document.title = `${profile.display_name || profile.username} — Curl`;

    // Profile card
    const card = document.createElement("section");
    card.className = "card profile-header";

    // Avatar
    const avatar = document.createElement("div");
    avatar.className = "profile-avatar";

    if (profile.avatar_url) {
      const img = document.createElement("img");
      img.src = profile.avatar_url;
      img.alt = `${profile.username}'s avatar`;
      img.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:inherit";
      avatar.appendChild(img);
    } else {
      avatar.textContent =
        profile.username.charAt(0).toUpperCase();
    }

    // User information
    const info = document.createElement("div");

    const name = document.createElement("h1");
    name.className = "profile-name";
    name.textContent = profile.display_name || profile.username;

    // Username and badges
    const usernameRow = document.createElement("div");
    usernameRow.className = "profile-username-row";

    const usernameText = document.createElement("span");
    usernameText.className = "profile-username";
    usernameText.textContent = `@${profile.username}`;

    usernameRow.appendChild(usernameText);

    if (profile.verified) {
      const badge = document.createElement("img");
      badge.src = "/assets/images/verified.png";
      badge.alt = "Verified";
      badge.title = "Verified";
      badge.className = "profile-badge";
      usernameRow.appendChild(badge);
    }

    if (profile.curl_mod) {
      const badge = document.createElement("img");
      badge.src = "/assets/images/curlmod.png";
      badge.alt = "Curl Moderator";
      badge.title = "Curl Moderator";
      badge.className = "profile-badge";
      usernameRow.appendChild(badge);
    }

    // Numeric Curl UID
    const id = document.createElement("p");
    id.className = "profile-id";
    id.textContent = `Curl ID: ${profile.curl_id}`;

    // Rank
    const rank = document.createElement("span");
    rank.className = "profile-rank";
    rank.textContent = profile.rank;

    // Bio
    const bio = document.createElement("p");
    bio.className = "profile-bio";
    bio.textContent =
      profile.bio || "This user hasn't written a bio yet.";

    info.append(name, usernameRow, id, rank, bio);
    card.append(avatar, info);

    content.replaceChildren(card);

    // Edit profile
    if (isOwner) {
      const edit = document.createElement("a");
      edit.href = "/settings/";
      edit.className = "btn btn-primary";
      edit.textContent = "Edit profile";
      edit.style.marginTop = "20px";
      content.appendChild(edit);
    }

  } catch (error) {
    console.error("[Curl] Profile loading error:", error);

    content.innerHTML =
      '<div class="card card-padding">Could not load this profile. Please try again.</div>';
  }
}

loadProfile();
