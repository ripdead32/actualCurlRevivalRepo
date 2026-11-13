
import {
  SUPABASE_URL,
  SUPABASE_KEY
} from "./supabase.js";

const grid = document.getElementById("item-grid");
const search = document.getElementById("catalog-search");
const sort = document.getElementById("catalog-sort");
const count = document.getElementById("result-count");
const title = document.getElementById("catalog-title");

const previousButton = document.getElementById("previous-page");
const nextButton = document.getElementById("next-page");

const categoryButtons = document.querySelectorAll(".category-button");

const categoryNames = {
  all: "All items",
  9: "Hats",
  20: "Hair",
  10: "Faces",
  15: "Heads",
  56: "Classic shirts",
  57: "Classic pants",
  55: "T-shirts",
  21: "Face accessories",
  22: "Neck accessories",
  23: "Shoulder accessories",
  24: "Front accessories",
  25: "Back accessories",
  26: "Waist accessories",
  27: "Animations"
};

let activeCategory = "all";
let currentPage = 0;
let pageCursors = [null];
let nextCursor = null;
let currentRequest = 0;
let searchTimeout = null;

// ==========================================
// STATE
// ==========================================

function showState(heading, message, retry = false) {
  grid.replaceChildren();

  const state = document.createElement("div");
  state.className = "catalog-state";

  const h3 = document.createElement("h3");
  h3.textContent = heading;

  const p = document.createElement("p");
  p.textContent = message;

  state.append(h3, p);

  if (retry) {
    const button = document.createElement("button");
    button.textContent = "Try again";
    button.addEventListener("click", () => loadCatalog());

    state.appendChild(button);
  }

  grid.appendChild(state);
}

function resetPagination() {
  currentPage = 0;
  pageCursors = [null];
  nextCursor = null;
}

// ==========================================
// ROBLOX API PROXY
// ==========================================

async function catalogRequest(body) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/roblox-catalog`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY
      },
      body: JSON.stringify(body)
    }
  );

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Invalid catalog response (${response.status}): ${responseText}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Catalog request failed: ${response.status}`
    );
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

async function loadThumbnails(items) {
  const ids = items
    .filter(item => item.itemType === "Asset")
    .map(item => item.id);

  if (!ids.length) return {};

  const result = await catalogRequest({
    action: "thumbnails",
    assetIds: ids
  });

  const thumbnails = {};

  for (const thumbnail of result.data || []) {
    if (
      thumbnail.state === "Completed" &&
      thumbnail.imageUrl
    ) {
      thumbnails[thumbnail.targetId] = thumbnail.imageUrl;
    }
  }

  return thumbnails;
}

// ==========================================
// ITEM SELECTION
// ==========================================

function addToAvatar(item, button) {
  try {
    const selected = {
      id: item.id,
      name: item.name,
      assetType: item.assetType,
      itemType: item.itemType,
      creatorName: item.creatorName || "Unknown creator",
      thumbnail: item.thumbnail || null
    };

    const storageKey = "curl-selected-avatar-items";

    let items = [];

    try {
      items = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      items = [];
    }

    if (!Array.isArray(items)) items = [];

    const alreadyAdded = items.some(
      existing => String(existing.id) === String(selected.id)
    );

    if (!alreadyAdded) {
      items.push(selected);
    }

    localStorage.setItem(storageKey, JSON.stringify(items));

    // Backwards compatibility with the old avatar editor.
    localStorage.setItem(
      "curl-selected-avatar-item",
      JSON.stringify(selected)
    );

    button.textContent = alreadyAdded ? "Already added" : "Added";
    button.disabled = true;
  } catch (error) {
    console.error(error);
    alert("Unable to save this item in your browser.");
  }
}

// ==========================================
// ITEM CARD
// ==========================================

function createItemCard(item, thumbnail) {
  const card = document.createElement("article");
  card.className = "item-card";

  const imageArea = document.createElement("div");
  imageArea.className = "item-thumbnail";

  if (thumbnail) {
    const image = document.createElement("img");

    image.src = thumbnail;
    image.alt = item.name || "Catalog item";
    image.loading = "lazy";

    image.onerror = () => {
      image.remove();

      const fallback = document.createElement("span");
      fallback.className = "item-placeholder";
      fallback.textContent = "Preview unavailable";

      imageArea.appendChild(fallback);
    };

    imageArea.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "item-placeholder";
    fallback.textContent = "Preview unavailable";

    imageArea.appendChild(fallback);
  }

  const info = document.createElement("div");
  info.className = "item-info";

  const heading = document.createElement("h3");
  heading.textContent = item.name || "Unnamed item";

  const creator = document.createElement("div");
  creator.className = "item-creator";
  creator.textContent = "By " + (item.creatorName || "Unknown creator");

  const meta = document.createElement("div");
  meta.className = "item-meta";

  const price = document.createElement("span");
  price.className = "item-price";

  if (item.priceStatus === "Free" || item.price === 0) {
    price.textContent = "Free on Roblox";
  } else if (typeof item.price === "number") {
    price.textContent = `Roblox: ${item.price.toLocaleString()} R$`;
  } else {
    price.textContent =
      item.priceStatus === "OffSale"
        ? "Off sale"
        : "Price unavailable";
  }

  const type = document.createElement("span");
  type.className = "item-type";
  type.textContent = item.itemType || "Asset";

  meta.append(price, type);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const selectButton = document.createElement("button");
  selectButton.className = "select-item";
  selectButton.textContent = "Add to avatar";

  selectButton.addEventListener("click", () => {
    addToAvatar(
      { ...item, thumbnail },
      selectButton
    );
  });

  const openButton = document.createElement("a");
  openButton.className = "open-item";
  openButton.textContent = "View on Roblox";
  openButton.href =
    "https://www.roblox.com/catalog/" +
    encodeURIComponent(item.id);

  openButton.target = "_blank";
  openButton.rel = "noopener noreferrer";

  actions.append(selectButton, openButton);
  info.append(heading, creator, meta, actions);

  card.append(imageArea, info);

  return card;
}

// ==========================================
// LOAD CATALOG
// ==========================================

async function loadCatalog() {
  const requestId = ++currentRequest;
  const cursor = pageCursors[currentPage];

  showState("Loading catalog", "Fetching avatar items...");

  previousButton.disabled = currentPage === 0;
  nextButton.disabled = true;

  try {
    const result = await catalogRequest({
  action: "search",
  category: activeCategory,
  keyword: search.value.trim(),
  sort: Number(sort.value),
  cursor: cursor
});

    if (requestId !== currentRequest) return;

    const items = result.data || [];

    nextCursor = result.nextPageCursor || null;

    title.textContent = categoryNames[activeCategory] || "All items";
    count.textContent = `${items.length} items`;

    nextButton.disabled = !nextCursor;

    if (!items.length) {
      showState(
        "No items found",
        search.value.trim()
          ? "Try another search or select a different category."
          : "There are no items available in this category."
      );

      return;
    }

    grid.replaceChildren();

    const thumbnails = await loadThumbnails(items);

    if (requestId !== currentRequest) return;

    for (const item of items) {
      grid.appendChild(
        createItemCard(item, thumbnails[item.id])
      );
    }
  } catch (error) {
    if (requestId !== currentRequest) return;

    console.error("Curl catalog:", error);

    count.textContent = "Unavailable";

    showState(
      "Unable to load the catalog",
      error.message || "Check your connection and try again.",
      true
    );
  }
}

// ==========================================
// SEARCH
// ==========================================

search.addEventListener("input", () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    resetPagination();
    loadCatalog();
  }, 450);
});

// ==========================================
// SORTING
// ==========================================

sort.addEventListener("change", () => {
  resetPagination();
  loadCatalog();
});

// ==========================================
// CATEGORIES
// ==========================================

categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    categoryButtons.forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    activeCategory = button.dataset.category;

    resetPagination();
    loadCatalog();
  });
});

// ==========================================
// PAGINATION
// ==========================================

nextButton.addEventListener("click", () => {
  if (!nextCursor) return;

  pageCursors.push(nextCursor);
  currentPage++;

  loadCatalog();
});

previousButton.addEventListener("click", () => {
  if (currentPage <= 0) return;

  currentPage--;

  loadCatalog();
});

// ==========================================
// INITIALIZE
// ==========================================

loadCatalog();
