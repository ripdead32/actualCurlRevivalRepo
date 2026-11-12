const chatLayout = document.querySelector(".chat-layout");

const chatSearch = document.getElementById("chat-search");
const conversationList = document.getElementById("conversation-list");

const placeholder = document.getElementById("chat-placeholder");
const conversation = document.getElementById("chat-conversation");

const backButton = document.getElementById("back-to-conversations");

const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

const sendButton = messageForm.querySelector(".send-message");

function showPlaceholder() {
  placeholder.hidden = false;
  conversation.hidden = true;
  chatLayout.classList.remove("show-conversation");
}

function showConversation() {
  placeholder.hidden = true;
  conversation.hidden = false;
  chatLayout.classList.add("show-conversation");
}

backButton.addEventListener("click", showPlaceholder);

chatSearch.addEventListener("input", () => {
  const query = chatSearch.value.trim();

  // Conversation filtering will be connected to Supabase later.
  if (query) {
    conversationList.innerHTML = `
      <div class="conversation-empty">
        <div class="conversation-empty-icon">⌕</div>
        <p>No conversations found.</p>
      </div>
    `;
  } else {
    conversationList.innerHTML = `
      <div class="conversation-empty">
        <div class="conversation-empty-icon">✉</div>
        <p>No conversations yet.</p>
        <a href="/friends/">Find friends</a>
      </div>
    `;
  }
});

messageForm.addEventListener("submit", event => {
  event.preventDefault();

  // Sending messages will be enabled after the database is connected.
});

messageInput.addEventListener("input", () => {
  sendButton.disabled = !messageInput.value.trim();
});

showPlaceholder();