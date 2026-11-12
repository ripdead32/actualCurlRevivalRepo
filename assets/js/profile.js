
import { supabase } from "./supabase.js";
import { getSession } from "./auth.js";

const content = document.getElementById("profile-content");

function createActionButton(text, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

async function loadFriendStatus(currentUserId, profileId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, recipient_id, status")
    .or(
      `and(sender_id.eq.${currentUserId},recipient_id.eq.${profileId}),and(sender_id.eq.${profileId},recipient_id.eq.${currentUserId})`
    );

  if (error) throw error;

  return data?.[0] || null;
}

async function createFriendButton(profile, session) {
  const actions = document.createElement("div");
  actions.className = "profile-actions";

  const button = createActionButton(
    "Add Friend",
    "btn btn-primary",
    async () => {}
  );

  actions.appendChild(button);

  if (!session) {
    button.textContent = "Log in to Add Friend";
    button.onclick = () => {
      location.href = "/login/";
    };
    return actions;
  }

  let request;

  try {
    request = await loadFriendStatus(session.user.id, profile.id);
  } catch (error) {
    console.error("[Curl] Friend status error:", error);
    button.textContent = "Unavailable";
    button.disabled = true;
    return actions;
  }

  function setButton(text, disabled = false) {
    button.textContent = text;
    button.disabled = disabled;
  }

  if (request?.status === "accepted") {
    setButton("Friends", true);
    return actions;
  }

  if (request?.status === "pending") {
    if (request.sender_id === session.user.id) {
      setButton("Request Sent", true);
    } else {
      setButton("Accept Request");

      button.onclick = async () => {
        setButton("Accepting...", true);

        try {
          const { error } = await supabase
            .from("friend_requests")
            .update({ status: "accepted" })
            .eq("id", request.id)
            .eq("recipient_id", session.user.id)
            .eq("status", "pending");

          if (error) throw error;

          setButton("Friends", true);
        } catch (error) {
          console.error("[Curl] Accept request error:", error);
          setButton("Accept Failed");
        }
      };
    }

    return actions;
  }

  if (request?.status === "declined") {
    setButton("Request Declined", true);
    return actions;
  }

  button.onclick = async () => {
    setButton("Sending...", true);

    try {
      const { error } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: session.user.id,
          recipient_id: profile.id,
          status: "pending"
        });

      if (error) throw error;

      setButton("Request Sent", true);
    } catch (error) {
      console.error("[Curl] Friend request error:", error);
      setButton("Could Not Send");
      console.error(error.message);
    }
  };

  return actions;
}

async function loadProfile() {
  try {
    const params = new URLSearchParams(location.search);
    const username = params.get("username");

    const session = await getSession();

    let query = supabase
      .from("profiles")
      .select(`
        id,
        uid,
        curl_id,
        username,
        display_name,
        bio,
        avatar_url,
        rank,
        verified,
        curl_mod,
        created_at
      `);

    if (username) {
      query = query.ilike("username", username);
    } else {
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

    const isOwner = session?.user.id === profile.id;

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
      avatar.textContent = profile.username.charAt(0).toUpperCase();
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

    // Curl ID
    const id = document.createElement("p");
    id.className = "profile-id";
    id.textContent = `Curl ID: ${profile.curl_id ?? "Unknown"}`;

    // Rank
    const rank = document.createElement("span");
    rank.className = "profile-rank";
    rank.textContent = profile.rank || "user";

    // Bio
    const bio = document.createElement("p");
    bio.className = "profile-bio";
    bio.textContent =
      profile.bio || "This user hasn't written a bio yet.";

    info.append(name, usernameRow, id, rank, bio);
    card.append(avatar, info);

    content.replaceChildren(card);

    // Profile actions
    if (isOwner) {
      const edit = document.createElement("a");
      edit.href = "/settings/";
      edit.className = "btn btn-primary";
      edit.textContent = "Edit profile";

      const actions = document.createElement("div");
      actions.className = "profile-actions";
      actions.appendChild(edit);

      content.appendChild(actions);
    } else {
      const actions = await createFriendButton(profile, session);
      content.appendChild(actions);
    }

  } catch (error) {
    console.error("[Curl] Profile loading error:", error);

    content.innerHTML =
      '<div class="card card-padding">Could not load this profile. Please try again.</div>';
  }
}

loadProfile();
