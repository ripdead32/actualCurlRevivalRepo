
import { supabase } from "./supabase.js";
import { requireModerator } from "./auth.js";

const userList = document.getElementById("user-list");
const searchInput = document.getElementById("user-search");
const searchButton = document.getElementById("search-button");
const message = document.getElementById("admin-message");

let currentModerator = null;

function showMessage(text, type = "error") {
  const box = document.createElement("div");
  box.className = `status ${type}`;
  box.textContent = text;

  message.replaceChildren(box);
}

async function loadUsers(search = "") {
  userList.replaceChildren();

  const loading = document.createElement("tr");
  const loadingCell = document.createElement("td");

  loadingCell.colSpan = 4;
  loadingCell.textContent = "Loading accounts...";

  loading.appendChild(loadingCell);
  userList.appendChild(loading);

  try {
    let query = supabase
      .from("profiles")
      .select("id, username, curl_id, rank")
      .order("curl_id", { ascending: true })
      .limit(100);

    if (search.trim()) {
      query = query.ilike("username", `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    userList.replaceChildren();

    if (!data.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.textContent = "No accounts found.";

      row.appendChild(cell);
      userList.appendChild(row);
      return;
    }

    for (const user of data) {
      const row = document.createElement("tr");

      const usernameCell = document.createElement("td");
      usernameCell.textContent = user.username;

      const idCell = document.createElement("td");
      idCell.textContent = user.curl_id;

      const rankCell = document.createElement("td");
      const badge = document.createElement("span");

      badge.className = "rank-badge";
      badge.textContent = user.rank;

      rankCell.appendChild(badge);

      const actionCell = document.createElement("td");

      const editButton = document.createElement("button");
      editButton.className = "btn btn-secondary";
      editButton.textContent = "Edit ID";

      editButton.addEventListener("click", async () => {
        const input = prompt(
          `Enter a new Curl ID for ${user.username}:`,
          String(user.curl_id)
        );

        if (input === null) return;

        if (!/^[1-9]\d*$/.test(input)) {
          showMessage("Enter a valid positive whole number.");
          return;
        }

        const newId = Number(input);

        if (!Number.isSafeInteger(newId)) {
          showMessage("That Curl ID is too large.");
          return;
        }

        editButton.disabled = true;

        try {
          const { error } = await supabase.rpc(
            "edit_curl_id",
            {
              target_user: user.id,
              new_curl_id: newId
            }
          );

          if (error) throw error;

          showMessage(
            `Updated ${user.username}'s Curl ID.`,
            "success"
          );

          await loadUsers(searchInput.value);

        } catch (error) {
          showMessage(error.message);
        } finally {
          editButton.disabled = false;
        }
      });

      actionCell.appendChild(editButton);

      row.append(
        usernameCell,
        idCell,
        rankCell,
        actionCell
      );

      userList.appendChild(row);
    }

  } catch (error) {
    showMessage(error.message);
  }
}

async function initAdmin() {
  try {
    currentModerator = await requireModerator();

    if (!currentModerator) return;

    await loadUsers();

  } catch (error) {
    console.error(error);
    location.href = "/";
  }
}

searchButton.addEventListener("click", () => {
  loadUsers(searchInput.value);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadUsers(searchInput.value);
  }
});

initAdmin();
