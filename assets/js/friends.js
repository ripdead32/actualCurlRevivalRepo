
import { supabase } from "./supabase.js";
import { getSession } from "./auth.js";

const tabs = document.querySelectorAll(".friends-tab");
const searchInput = document.getElementById("friends-search");
const friendsList = document.getElementById("friends-list");

let activeTab = "friends";
let currentUser = null;
let currentItems = [];

const emptyStates = {
  friends: {
    icon: "◎",
    title: "Your friends will appear here",
    description: "Search for people on Curl and send them a friend request.",
    button: "Find People",
    url: "/search/"
  },
  incoming: {
    icon: "↓",
    title: "No incoming requests",
    description: "Friend requests sent to you will appear here.",
    button: "Find People",
    url: "/search/"
  },
  outgoing: {
    icon: "↑",
    title: "No outgoing requests",
    description: "Requests you've sent to other people will appear here.",
    button: "Find People",
    url: "/search/"
  }
};

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function renderEmptyState() {
  const state = emptyStates[activeTab];

  const container = createElement("div", "friends-empty");
  const icon = createElement("div", "empty-icon", state.icon);
  const title = createElement("h2", "", state.title);
  const description = createElement("p", "", state.description);
  const link = createElement("a", "btn btn-primary", state.button);

  link.href = state.url;

  container.append(icon, title, description, link);
  friendsList.replaceChildren(container);
}

function renderMessage(text) {
  const container = createElement("div", "friends-empty");
  container.appendChild(createElement("p", "", text));
  friendsList.replaceChildren(container);
}

function getOtherUser(request) {
  return request.sender_id === currentUser.id
    ? request.recipient
    : request.sender;
}

function renderUsers(items) {
  friendsList.replaceChildren();

  if (!items.length) {
    renderEmptyState();
    return;
  }

  for (const item of items) {
    const request = item.request;
    const user = item.user;

    if (!user) continue;

    const card = createElement("div", "friend-card");

    const avatar = createElement("div", "friend-avatar");

    if (user.avatar_url) {
      const image = document.createElement("img");
      image.src = user.avatar_url;
      image.alt = `${user.username}'s avatar`;
      avatar.appendChild(image);
    } else {
      avatar.textContent = (user.username || "?")
        .charAt(0)
        .toUpperCase();
    }

    const info = createElement("div", "friend-info");

    const name = createElement(
      "h3",
      "friend-name",
      user.display_name || user.username
    );

    const username = createElement(
      "p",
      "friend-username",
      `@${user.username}`
    );

    info.append(name, username);

    const actions = createElement("div", "friend-actions");

    const profileLink = createElement(
      "a",
      "btn btn-secondary",
      "Profile"
    );

    profileLink.href =
      `/profile/?username=${encodeURIComponent(user.username)}`;

    actions.appendChild(profileLink);

    if (activeTab === "incoming") {
      const acceptButton = createElement(
        "button",
        "btn btn-primary",
        "Accept"
      );

      const declineButton = createElement(
        "button",
        "btn btn-secondary",
        "Decline"
      );

      acceptButton.addEventListener("click", () =>
        updateRequest(request, "accepted", acceptButton, declineButton)
      );

      declineButton.addEventListener("click", () =>
        updateRequest(request, "declined", acceptButton, declineButton)
      );

      actions.append(acceptButton, declineButton);
    }

    if (activeTab === "outgoing") {
      const cancelButton = createElement(
        "button",
        "btn btn-secondary",
        "Cancel"
      );

      cancelButton.addEventListener("click", () =>
        cancelRequest(request, cancelButton)
      );

      actions.appendChild(cancelButton);
    }

    card.append(avatar, info, actions);
    friendsList.appendChild(card);
  }
}

async function updateRequest(request, status, ...buttons) {
  buttons.forEach(button => {
    button.disabled = true;
  });

  try {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status })
      .eq("id", request.id)
      .eq("recipient_id", currentUser.id)
      .eq("status", "pending");

    if (error) throw error;

    await loadFriends();
  } catch (error) {
    console.error("[Curl] Friend request update error:", error);
    alert(error.message || "Could not update friend request.");

    buttons.forEach(button => {
      button.disabled = false;
    });
  }
}

async function cancelRequest(request, button) {
  if (!confirm("Cancel this friend request?")) return;

  button.disabled = true;

  try {
    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", request.id)
      .eq("sender_id", currentUser.id)
      .eq("status", "pending");

    if (error) throw error;

    await loadFriends();
  } catch (error) {
    console.error("[Curl] Cancel request error:", error);
    alert(error.message || "Could not cancel friend request.");
    button.disabled = false;
  }
}

async function loadFriends() {
  friendsList.replaceChildren();
  renderMessage("Loading...");

  try {
    const { data: requests, error } = await supabase
      .from("friend_requests")
      .select("id, sender_id, recipient_id, status, created_at")
      .or(
        `sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`
      )
      .eq(
        "status",
        activeTab === "friends"
          ? "accepted"
          : "pending"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    let filteredRequests = requests || [];

    if (activeTab === "incoming") {
      filteredRequests = filteredRequests.filter(
        request => request.recipient_id === currentUser.id
      );
    }

    if (activeTab === "outgoing") {
      filteredRequests = filteredRequests.filter(
        request => request.sender_id === currentUser.id
      );
    }

    const userIds = [
      ...new Set(
        filteredRequests.map(request =>
          request.sender_id === currentUser.id
            ? request.recipient_id
            : request.sender_id
        )
      )
    ];

    if (!userIds.length) {
      currentItems = [];
      renderEmptyState();
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);

    if (profileError) throw profileError;

    const profileMap = new Map(
      (profiles || []).map(profile => [profile.id, profile])
    );

    currentItems = filteredRequests.map(request => ({
      request,
      user: profileMap.get(
        request.sender_id === currentUser.id
          ? request.recipient_id
          : request.sender_id
      )
    })).filter(item => item.user);

    applySearch();

  } catch (error) {
    console.error("[Curl] Friends loading error:", error);
    renderMessage("Could not load your friends. Please try again.");
  }
}

function applySearch() {
  const search = searchInput.value.trim().toLowerCase();

  const filtered = currentItems.filter(({ user }) => {
    return (
      user.username?.toLowerCase().includes(search) ||
      user.display_name?.toLowerCase().includes(search)
    );
  });

  renderUsers(filtered);
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;

    tabs.forEach(item => {
      const selected = item === tab;

      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });

    loadFriends();
  });
});

searchInput.addEventListener("input", applySearch);

async function initFriends() {
  try {
    const session = await getSession();

    if (!session) {
      location.href = "/login/";
      return;
    }

    currentUser = session.user;

    await loadFriends();
  } catch (error) {
    console.error("[Curl] Friends initialization error:", error);
    renderMessage("Could not initialize your friends list.");
  }
}

initFriends();
