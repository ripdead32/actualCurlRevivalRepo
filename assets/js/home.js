import { supabase } from "./supabase.js";

const heroActions = document.getElementById("hero-actions");

async function updateHomePage() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (data.session && heroActions) {
      heroActions.innerHTML = `
        <a href="/catalog/" class="btn btn-primary">
          Explore Catalog
        </a>

        <a href="/search/" class="btn btn-secondary">
          Find People
        </a>
      `;
    }
  } catch (error) {
    console.error("[Curl Home] Session check failed:", error);
  }
}

updateHomePage();