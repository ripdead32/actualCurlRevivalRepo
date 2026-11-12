
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

function createButton(text, className, onClick) {
  const button = document.createElement("button");
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

async function loadUsers(search = "") {
  userList.replaceChildren();

  const loading = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 6;
  loadingCell.textContent = "Loading accounts...";
  loading.appendChild(loadingCell);
  userList.appendChild(loading);

  try {
    let query = supabase
      .from("profiles")
      .select("id, username, uid, rank")
      .order("uid", { ascending: true })
      .limit(100);

    if (search.trim()) {
      query = query.ilike("username", `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    userList.replaceChildren();

    if (!data?.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
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
      idCell.textContent = user.uid;

      const rankCell = document.createElement("td");
      const rankBadge = document.createElement("span");
      rankBadge.className = "rank-badge";
      rankBadge.textContent = user.rank;
      rankCell.appendChild(rankBadge);

      const verifiedCell = document.createElement("td");
      const moderatorCell = document.createElement("td");
      const actionCell = document.createElement("td");

      // App Metadata is not publicly readable through profiles.
      // These values are populated by the secure admin Edge Function.
      const verifiedLabel = document.createElement("span");
      verifiedLabel.textContent = "Loading...";
      verifiedCell.appendChild(verifiedLabel);

      const moderatorLabel = document.createElement("span");
      moderatorLabel.textContent = "Loading...";
      moderatorCell.appendChild(moderatorLabel);

      const editButton = createButton(
        "Edit ID",
        "btn btn-secondary",
        async () => {
          const input = prompt(
            `Enter a new Curl ID for ${user.username}:`,
            String(user.uid)
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
            const { error } = await supabase.rpc("edit_curl_id", {
              target_user: user.id,
              new_curl_id: newId
            });

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
        }
      );

      actionCell.appendChild(editButton);

      row.append(
        usernameCell,
        idCell,
        rankCell,
        verifiedCell,
        moderatorCell,
        actionCell
      );

      userList.appendChild(row);

      // Fetch permissions through the secure Edge Function.
      try {
        const { data: permissions, error: permissionError } =
          await supabase.functions.invoke("manage-user-permissions", {
            body: {
              action: "get",
              userId: user.id
            }
          });

        if (permissionError) throw permissionError;

        const verified = permissions?.verified === true;
        const curlMod = permissions?.curl_mod === true;

        verifiedLabel.textContent = verified ? "Yes" : "No";
        moderatorLabel.textContent = curlMod ? "Yes" : "No";

        const verifiedButton = createButton(
          verified ? "Remove Verified" : "Verify",
          "btn btn-secondary",
          () => updatePermission(user, "verified", !verified)
        );

        const modButton = createButton(
          curlMod ? "Remove Moderator" : "Grant Moderator",
          "btn btn-secondary",
          () => updatePermission(user, "curl_mod", !curlMod)
        );

        actionCell.append(verifiedButton, modButton);

      } catch (error) {
        verifiedLabel.textContent = "Unavailable";
        moderatorLabel.textContent = "Unavailable";
        console.error(
          `[Curl] Could not load permissions for ${user.username}:`,
          error
        );
      }
    }

  } catch (error) {
    console.error("[Curl] User loading error:", error);
    showMessage(error.message);
  }
}

async function updatePermission(user, permission, enabled) {
  try {
    const { error } = await supabase.functions.invoke(
      "manage-user-permissions",
      {
        body: {
          action: "set",
          userId: user.id,
          permission,
          enabled
        }
      }
    );

    if (error) throw error;

    showMessage(
      `${user.username}: ${permission} ${enabled ? "enabled" : "disabled"}.`,
      "success"
    );

    await loadUsers(searchInput.value);

  } catch (error) {
    console.error("[Curl] Permission update error:", error);
    showMessage(error.message);
  }
}

async function initAdmin() {
  try {
    currentModerator = await requireModerator();

    if (!currentModerator) return;

    await loadUsers();
  } catch (error) {
    console.error("[Curl] Admin initialization error:", error);
    location.replace("/");
  }
}

searchButton.addEventListener("click", () => {
  loadUsers(searchInput.value);
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    loadUsers(searchInput.value);
  }
});

initAdmin();
