const tabs = document.querySelectorAll(".friends-tab");
const searchInput = document.getElementById("friends-search");
const friendsList = document.getElementById("friends-list");

let activeTab = "friends";

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

function renderEmptyState() {
  const state = emptyStates[activeTab];

  friendsList.innerHTML = `
    <div class="friends-empty">
      <div class="empty-icon">${state.icon}</div>
      <h2>${state.title}</h2>
      <p>${state.description}</p>
      <a href="${state.url}" class="btn btn-primary">
        ${state.button}
      </a>
    </div>
  `;
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;

    tabs.forEach(item => {
      const selected = item === tab;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });

    renderEmptyState();
  });
});

searchInput.addEventListener("input", () => {
  // Friend filtering will be connected when the database is ready.
});

renderEmptyState();