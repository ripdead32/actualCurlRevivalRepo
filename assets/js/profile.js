
import { supabase } from "./supabase.js";
import { getSession } from "./auth.js";

const content = document.getElementById("profile-content");

async function loadProfile() {
  try {
    const params = new URLSearchParams(location.search);
    const username = params.get("username");

    let query = supabase
      .from("profiles")
      .select("id, curl_id, username, bio, avatar_url, rank, created_at");

    if (username) {
      query = query.eq("username", username);
    } else {
      const session = await getSession();

      if (!session) {
        location.href = "/login/";
        return;
      }

      query = query.eq("id", session.user.id);
    }

    const { data: profile, error } = await query.single();

    if (error) throw error;

    const session = await getSession();

    const isOwner = session?.user.id === profile.id;

    document.title = `${profile.username} — Curl`;

    const card = document.createElement("section");
    card.className = "card profile-header";

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

    const info = document.createElement("div");

    const name = document.createElement("h1");
    name.className = "profile-name";
    name.textContent = profile.username;

    const id = document.createElement("p");
    id.className = "profile-id";
    id.textContent = `Curl ID: ${profile.curl_id}`;

    const rank = document.createElement("span");
    rank.className = "profile-rank";
    rank.textContent = profile.rank;

    const bio = document.createElement("p");
    bio.className = "profile-bio";
    bio.textContent = profile.bio || "This user hasn't written a bio yet.";

    info.append(name, id, rank, bio);

    card.append(avatar, info);

    content.replaceChildren(card);

    if (isOwner) {
      const edit = document.createElement("a");
      edit.href = "/settings/";
      edit.className = "btn btn-primary";
      edit.textContent = "Edit profile";
      edit.style.marginTop = "20px";
      content.appendChild(edit);
    }

  } catch (error) {
    console.error(error);

    content.innerHTML =
      '<div class="card card-padding">Profile not found.</div>';
  }
}

loadProfile();
