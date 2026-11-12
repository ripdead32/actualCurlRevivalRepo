
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

function addTableMessage(text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = 7;
  cell.textContent = text;

  row.appendChild(cell);
  userList.appendChild(row);
}

async function loadUsers(search = "") {
  userList.replaceChildren();
  addTableMessage("Loading accounts...");

  try {
    let query = supabase
      .from("profiles")
      .select("id, username, curl_id, rank, is_banned, ban_reason")
      .order("curl_id", { ascending: true })
      .limit(100);

    if (search.trim()) {
      query = query.ilike("username", `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    userList.replaceChildren();

    if (!data?.length) {
      addTableMessage("No accounts found.");
      return;
    }

    for (const user of data) {
      const row = document.createElement("tr");

      const usernameCell = document.createElement("td");
      usernameCell.textContent = user.username || "Unknown";

      const idCell = document.createElement("td");
      idCell.textContent = user.curl_id ?? "—";

      const rankCell = document.createElement("td");
      const rankBadge = document.createElement("span");
      rankBadge.className = "rank-badge";
      rankBadge.textContent = user.rank || "user";
      rankCell.appendChild(rankBadge);

      const statusCell = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = user.is_banned
        ? "admin-status admin-status-banned"
        : "admin-status admin-status-active";
      statusBadge.textContent = user.is_banned ? "Banned" : "Active";
      statusCell.appendChild(statusBadge);

      const verifiedCell = document.createElement("td");
      const moderatorCell = document.createElement("td");
      const actionCell = document.createElement("td");

      const verifiedLabel = document.createElement("span");
      verifiedLabel.textContent = "Loading...";
      verifiedCell.appendChild(verifiedLabel);

      const moderatorLabel = document.createElement("span");
      moderatorLabel.textContent = "Loading...";
      moderatorCell.appendChild(moderatorLabel);

      // Edit Curl ID
      const editButton = createButton(
        "Edit ID",
        "btn btn-secondary",
        async () => {
          const input = prompt(
            `Enter a new Curl ID for ${user.username}:`,
            String(user.curl_id ?? "")
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

      // Ban / Unban
      const banButton = createButton(
        user.is_banned ? "Unban" : "Ban",
        user.is_banned ? "btn btn-primary" : "btn btn-danger",
        async () => {
          let reason = "";

          if (!user.is_banned) {
            reason = prompt(
              `Why are you banning ${user.username}?`
            );

            if (reason === null) return;

            reason = reason.trim();

            if (reason.length > 500) {
              showMessage("The ban reason must be 500 characters or fewer.");
              return;
            }

            if (!confirm(`Ban @${user.username}?`)) return;
          } else {
            if (!confirm(`Unban @${user.username}?`)) return;
          }

          banButton.disabled = true;

          try {
            const { data, error } = await supabase.functions.invoke(
              "manage-user-ban",
              {
                body: {
                  userId: user.id,
                  banned: !user.is_banned,
                  reason
                }
              }
            );

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            showMessage(
              `${user.username}: ${
                user.is_banned ? "unbanned" : "banned"
              } successfully.`,
              "success"
            );

            await loadUsers(searchInput.value);
          } catch (error) {
            console.error("[Curl] Ban update error:", error);
            showMessage(error.message || "Could not update ban status.");
          } finally {
            banButton.disabled = false;
          }
        }
      );

      actionCell.append(editButton, banButton);

      row.append(
        usernameCell,
        idCell,
        rankCell,
        statusCell,
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
        if (permissions?.error) throw new Error(permissions.error);

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
    userList.replaceChildren();
    addTableMessage("Could not load accounts.");
    showMessage(error.message);
  }
}

async function updatePermission(user, permission, enabled) {
  try {
    const { data, error } = await supabase.functions.invoke(
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
    if (data?.error) throw new Error(data.error);

    showMessage(
      `${user.username}: ${permission} ${
        enabled ? "enabled" : "disabled"
      }.`,
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

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadUsers(searchInput.value);
  }
});

initAdmin();
