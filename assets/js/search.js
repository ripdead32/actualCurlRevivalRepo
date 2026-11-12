import { supabase } from "./supabase.js";

const searchInput = document.getElementById("search-input");
const clearButton = document.getElementById("clear-search");
const status = document.getElementById("search-status");

const peopleSection = document.getElementById("people-section");
const gamesSection = document.getElementById("games-section");

const peopleResults = document.getElementById("people-results");
const peopleCount = document.getElementById("people-count");

const gamesResults = document.getElementById("games-results");
const gamesCount = document.getElementById("games-count");

const tabs = document.querySelectorAll(".search-tab");

let activeFilter = "all";
let searchTimeout = null;
let currentSearch = 0;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function setStatus(message) {
  status.textContent = message;
}

function setEmpty(container, message) {
  container.innerHTML = `
    <div class="empty-state card">
      ${escapeHTML(message)}
    </div>
  `;
}

function updateSections() {
  peopleSection.hidden = activeFilter === "games";
  gamesSection.hidden = activeFilter === "people";
}

function renderPeople(profiles) {
  peopleCount.textContent = profiles.length
    ? `${profiles.length} found`
    : "";

  if (!profiles.length) {
    setEmpty(peopleResults, "No people found.");
    return;
  }

  peopleResults.innerHTML = profiles.map(profile => {
    const username = escapeHTML(profile.username);
    const displayName = escapeHTML(
      profile.display_name || profile.username
    );

    const avatar = profile.avatar_url
      ? `<img class="person-avatar"
          src="${escapeHTML(profile.avatar_url)}"
          alt=""
          loading="lazy">`
      : `<div class="person-avatar person-avatar-placeholder">
          ${escapeHTML((displayName[0] || "?").toUpperCase())}
        </div>`;

    const verified = profile.verified
      ? `<img class="person-badge"
          src="/assets/images/verified.png"
          alt="Verified"
          title="Verified">`
      : "";

    const curlMod = profile.curl_mod
      ? `<img class="person-badge"
          src="/assets/images/curlmod.png"
          alt="Curl Moderator"
          title="Curl Moderator">`
      : "";

    return `
      <a class="person-card"
        href="/profile/?username=${encodeURIComponent(profile.username)}">

        ${avatar}

        <div class="person-info">
          <div class="person-name">
            ${displayName}
            ${verified}
            ${curlMod}
          </div>

          <div class="person-username">
            @${username}
          </div>

          <div class="person-id">
            Curl ID: ${escapeHTML(profile.curl_id ?? "Unavailable")}
          </div>
        </div>
      </a>
    `;
  }).join("");
}

async function searchPeople(query) {
  let request = supabase
    .from("profiles")
    .select(`
      id,
      curl_id,
      username,
      display_name,
      avatar_url,
      verified,
      curl_mod
    `)
    .limit(30);

  const numericQuery = /^\d+$/.test(query);

  if (numericQuery) {
    request = request.or(
      `username.ilike.%${query}%,display_name.ilike.%${query}%,curl_id.eq.${query}`
    );
  } else {
    request = request.or(
      `username.ilike.%${query}%,display_name.ilike.%${query}%`
    );
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  renderPeople(data || []);
}

function resetResults() {
  peopleCount.textContent = "";
  gamesCount.textContent = "";

  setEmpty(peopleResults, "Search for people.");
  setEmpty(gamesResults, "Game search isn't connected yet.");
}

async function performSearch() {
  const query = searchInput.value.trim();
  const searchId = ++currentSearch;

  clearButton.hidden = !query;

  updateSections();

  if (!query) {
    resetResults();
    setStatus("Start typing to search Curl.");
    return;
  }

  if (query.length < 2) {
    resetResults();
    setStatus("Enter at least 2 characters.");
    return;
  }

  setStatus(`Searching for "${query}"...`);

  if (activeFilter === "all" || activeFilter === "people") {
    try {
      await searchPeople(query);

      if (searchId !== currentSearch) return;
    } catch (error) {
      console.error("[Curl Search] People search failed:", error);

      if (searchId !== currentSearch) return;

      setEmpty(peopleResults, "Could not load people.");
      peopleCount.textContent = "";
    }
  }

  if (activeFilter === "games" || activeFilter === "all") {
    gamesCount.textContent = "";
    setEmpty(
      gamesResults,
      "Game search will be connected once the games table is ready."
    );
  }

  if (searchId !== currentSearch) return;

  setStatus("Search complete.");
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(performSearch, 300);
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  performSearch();
});

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(item => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    activeFilter = tab.dataset.filter;
    performSearch();
  });
});

resetResults();
updateSections();