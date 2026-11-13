
import { supabase } from "./supabase.js";

// ==========================================
// ELEMENTS
// ==========================================

const startButton = document.getElementById("start-import");
const pauseButton = document.getElementById("pause-import");
const resetButton = document.getElementById("reset-import");

const statusElement = document.getElementById("import-status");
const resultsElement = document.getElementById("import-results");
const summaryElement = document.getElementById("import-summary");

const progressElement = document.getElementById("import-progress");
const progressLabel = document.getElementById("import-progress-label");

// ==========================================
// CONFIGURATION
// ==========================================

const TOTAL_CATEGORIES = 13;
const BATCH_DELAY = 500;

// ==========================================
// STATE
// ==========================================

let importing = false;
let pauseRequested = false;

// ==========================================
// UI HELPERS
// ==========================================

function setStatus(message, type = "") {
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.dataset.type = type;
}

function setProgress(completed) {
  const value = Math.max(
    0,
    Math.min(completed, TOTAL_CATEGORIES)
  );

  if (progressElement) {
    progressElement.value = value;
  }

  if (progressLabel) {
    progressLabel.textContent =
      `${value} / ${TOTAL_CATEGORIES} categories`;
  }
}

function setButtons() {
  if (startButton) startButton.disabled = importing;
  if (pauseButton) pauseButton.disabled = !importing;
  if (resetButton) resetButton.disabled = importing;
}

function clearResults() {
  resultsElement?.replaceChildren();

  if (summaryElement) {
    summaryElement.textContent = "";
  }
}

// ==========================================
// SESSION DEBUGGING
// ==========================================

async function getAccessToken() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  console.log("[Curl Importer] Session exists:", !!session);
  console.log(
    "[Curl Importer] Access token exists:",
    !!session?.access_token
  );
  console.log("[Curl Importer] Session error:", error);

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error(
      "No Supabase session found. Log in again before importing."
    );
  }

  return session.access_token;
}

// ==========================================
// ERROR HANDLING
// ==========================================

async function getFunctionError(error) {
  let message = error?.message || "Unknown function error.";

  if (error?.context) {
    try {
      const response = error.context.clone
        ? error.context.clone()
        : error.context;

      const text = await response.text();

      if (text) {
        try {
          const body = JSON.parse(text);
          message += ": " + (
            body.message ||
            body.error ||
            body.code ||
            text
          );
        } catch {
          message += ": " + text;
        }
      }
    } catch {
      // Keep original error.
    }
  }

  return message;
}

// ==========================================
// DISPLAY RESULTS
// ==========================================

function displayResults(data) {
  if (!resultsElement) return;

  resultsElement.replaceChildren();

  const categories = data.categories || [];

  for (const category of categories) {
    const row = document.createElement("div");
    row.className = "import-result-row";

    const name = document.createElement("span");
    name.className = "import-result-name";
    name.textContent = category.category || "Unknown category";

    const detail = document.createElement("span");
    detail.className = "import-result-detail";

    if (category.error) {
      row.dataset.status = "error";
      detail.textContent = "Error: " + category.error;
    } else if (category.complete || category.skipped) {
      row.dataset.status = "complete";

      detail.textContent = category.skipped
        ? "Already completed"
        : `${category.itemsThisRun ?? 0} items this run · Complete`;
    } else {
      row.dataset.status = "pending";

      detail.textContent =
        `${category.itemsThisRun ?? 0} items this run · ` +
        `${category.pagesThisRun ?? 0} pages this run · In progress`;
    }

    row.append(name, detail);
    resultsElement.appendChild(row);
  }

  const imported = Number(
    data.itemsImportedThisRun || 0
  );

  const pages = Number(
    data.pagesImportedThisRun || 0
  );

  if (summaryElement) {
    summaryElement.textContent =
      `${imported.toLocaleString()} items processed · ` +
      `${pages.toLocaleString()} pages processed this batch`;
  }

  const completedCategories = Number(
    data.completedCategories || 0
  );

  setProgress(completedCategories);
}

// ==========================================
// IMPORT REQUEST
// ==========================================

async function requestImport(reset = false) {
  const token = await getAccessToken();

  const endpoint =
    "https://bvhxzbmgaejdmuiowfhy.supabase.co/functions/v1/catalog-importer";

  console.log("[Curl Importer] Sending request...");
  console.log("[Curl Importer] Reset:", reset);

  // Use fetch directly so we can explicitly inspect
  // the Authorization header and HTTP response.

  const response = await fetch(endpoint, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "apikey": "sb_publishable_wjU-j9gFJnXhGDxwcRMFJw_eSGkKkZD",
      "Authorization": `Bearer ${token}`
    },

    body: JSON.stringify({
      action: "sync",
      reset,
      maxPagesPerCategory: 1
    })
  });

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Server returned invalid JSON (HTTP ${response.status}): ${responseText}`
    );
  }

  console.log("[Curl Importer] HTTP status:", response.status);
  console.log("[Curl Importer] Response:", data);

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      `HTTP ${response.status}`
    );
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

// ==========================================
// IMPORT LOOP
// ==========================================

async function runImport(reset = false) {
  if (importing) return;

  importing = true;
  pauseRequested = false;

  setButtons();

  if (reset) {
    clearResults();
    setProgress(0);
  }

  setStatus(
    reset
      ? "Resetting import progress..."
      : "Starting or resuming catalog import...",
    "working"
  );

  let firstRequest = true;
  let completed = false;
  let totalItems = 0;
  let totalPages = 0;

  try {
    while (!completed && !pauseRequested) {
      const data = await requestImport(
        reset && firstRequest
      );

      firstRequest = false;

      displayResults(data);

      totalItems += Number(
        data.itemsImportedThisRun || 0
      );

      totalPages += Number(
        data.pagesImportedThisRun || 0
      );

      const failedCategories = (data.categories || [])
        .filter(category => category.error);

      if (failedCategories.length > 0) {
        throw new Error(
          failedCategories
            .map(category =>
              `${category.category}: ${category.error}`
            )
            .join(" | ")
        );
      }

      completed = data.complete === true;

      if (completed) {
        setProgress(TOTAL_CATEGORIES);

        setStatus(
          "Catalog import completed successfully!",
          "success"
        );

        break;
      }

      setStatus(
        `Importing catalog... ${totalItems.toLocaleString()} ` +
        `items and ${totalPages.toLocaleString()} pages processed.`,
        "working"
      );

      if (!pauseRequested) {
        await new Promise(resolve =>
          setTimeout(resolve, BATCH_DELAY)
        );
      }
    }

    if (pauseRequested) {
      setStatus(
        "Import paused. Your progress has been saved.",
        "paused"
      );
    }

  } catch (error) {
    console.error("[Curl Importer] Error:", error);

    const message = await getFunctionError(error);

    setStatus(
      "Import failed: " + message,
      "error"
    );

  } finally {
    importing = false;
    pauseRequested = false;
    setButtons();
  }
}

// ==========================================
// BUTTON EVENTS
// ==========================================

startButton?.addEventListener("click", () => {
  runImport(false);
});

pauseButton?.addEventListener("click", () => {
  if (!importing) return;

  pauseRequested = true;

  setStatus(
    "Pausing after the current batch...",
    "paused"
  );
});

resetButton?.addEventListener("click", () => {
  if (importing) return;

  const confirmed = confirm(
    "Reset all catalog import progress? " +
    "Already imported catalog items will NOT be deleted."
  );

  if (confirmed) {
    runImport(true);
  }
});

// ==========================================
// INITIALIZATION
// ==========================================

setProgress(0);

setStatus(
  "Importer ready. Start or continue when you're ready."
);

setButtons();

console.log("[Curl Importer] Initialized.");
