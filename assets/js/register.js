
import { supabase } from "./supabase.js";

const form = document.getElementById("register-form");
const button = document.getElementById("register-button");
const message = document.getElementById("register-message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  button.disabled = true;
  message.textContent = "Creating your account...";

  try {
    const { data, error } = await supabase.functions.invoke(
      "register-user",
      {
        body: {
          username,
          email,
          password
        }
      }
    );

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || "Registration failed.");
    }

    message.textContent = data.message || "Account created successfully!";

    if (data.session) {
      location.href = "/";
    } else {
      message.textContent += " Please log in.";
    }
  } catch (error) {
    console.error("[Curl] Registration error:", error);
    message.textContent = error.message || "Something went wrong.";
  } finally {
    button.disabled = false;
  }
});
