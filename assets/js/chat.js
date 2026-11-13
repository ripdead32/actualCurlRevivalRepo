
import { supabase } from "./supabase.js";
import { getSession } from "./auth.js";

// ==========================================
// ELEMENTS
// ==========================================

const chatSearch = document.getElementById("chat-search");
const conversationList = document.getElementById("conversation-list");
const conversationCount = document.getElementById("conversation-count");

const placeholder = document.getElementById("chat-placeholder");
const conversation = document.getElementById("chat-conversation");

const backButton = document.getElementById("back-to-conversations");

const activeAvatar = document.getElementById("active-avatar");
const activeName = document.getElementById("active-name");
const activeUsername = document.getElementById("active-username");

const messageList = document.getElementById("message-list");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const sendButton = messageForm?.querySelector(".send-message");

// ==========================================
// STATE
// ==========================================

let currentUser = null;
let myProfile = null;

let friends = [];
let messages = [];

let selectedFriend = null;
let latestMessages = new Map();

let realtimeChannel = null;
let sendingMessage = false;

// ==========================================
// HELPERS
// ==========================================

function createElement(tag, className = "", text = "") {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined && text !== null) {
        element.textContent = text;
    }

    return element;
}

function getInitial(user) {
    const name = user?.display_name || user?.username || "?";
    return name.trim().charAt(0).toUpperCase() || "?";
}

function renderAvatar(container, user) {
    container.replaceChildren();

    if (user?.avatar_url) {
        const image = document.createElement("img");

        image.src = user.avatar_url;
        image.alt = `${user.username || "User"}'s avatar`;
        image.loading = "lazy";

        image.addEventListener("error", () => {
            container.replaceChildren();
            container.textContent = getInitial(user);
        }, { once: true });

        container.appendChild(image);
    } else {
        container.textContent = getInitial(user);
    }
}

function formatTime(timestamp) {
    if (!timestamp) return "";

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function showError(message) {
    console.error("[Curl Chat]", message);

    conversationList.replaceChildren(
        createElement("div", "chat-error", message)
    );
}

function getFriendId(request) {
    return request.sender_id === currentUser.id
        ? request.recipient_id
        : request.sender_id;
}

// ==========================================
// NAVIGATION
// ==========================================

function showPlaceholder() {
    selectedFriend = null;

    placeholder.hidden = false;
    conversation.hidden = true;

    chatSearch?.classList.remove("mobile-hidden");

    messageInput.disabled = true;
    messageInput.value = "";

    sendButton.disabled = true;
}

function showConversation() {
    placeholder.hidden = true;
    conversation.hidden = false;

    chatSearch?.classList.add("mobile-hidden");
}

// ==========================================
// LOAD FRIENDS
// ==========================================

async function loadFriends() {
    const { data: requests, error } = await supabase
        .from("friend_requests")
        .select("sender_id, recipient_id")
        .eq("status", "accepted")
        .or(
            `sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`
        );

    if (error) throw error;

    const userIds = [
        ...new Set(
            (requests || [])
                .map(getFriendId)
                .filter(id => id && id !== currentUser.id)
        )
    ];

    if (!userIds.length) {
        friends = [];
        renderConversations();
        return;
    }

    const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select(
            "id, username, display_name, avatar_url, verified, curl_mod"
        )
        .in("id", userIds);

    if (profileError) throw profileError;

    friends = profiles || [];

    renderConversations();
}

// ==========================================
// LOAD LATEST MESSAGES
// ==========================================

async function loadLatestMessages() {
    const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .or(
            `sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`
        )
        .order("created_at", { ascending: false })
        .limit(1000);

    if (error) throw error;

    latestMessages.clear();

    for (const message of data || []) {
        const otherUserId =
            message.sender_id === currentUser.id
                ? message.recipient_id
                : message.sender_id;

        if (!latestMessages.has(otherUserId)) {
            latestMessages.set(otherUserId, message);
        }
    }

    renderConversations();
}

// ==========================================
// CONVERSATION LIST
// ==========================================

function renderConversations() {
    const query = chatSearch?.value.trim().toLowerCase() || "";

    const filteredFriends = friends
        .filter(friend => {
            const username = friend.username || "";
            const displayName = friend.display_name || "";

            return (
                username.toLowerCase().includes(query) ||
                displayName.toLowerCase().includes(query)
            );
        })
        .sort((a, b) => {
            const aMessage = latestMessages.get(a.id);
            const bMessage = latestMessages.get(b.id);

            const aTime = aMessage
                ? new Date(aMessage.created_at).getTime()
                : 0;

            const bTime = bMessage
                ? new Date(bMessage.created_at).getTime()
                : 0;

            return bTime - aTime;
        });

    conversationCount.textContent = friends.length;
    conversationList.replaceChildren();

    if (!filteredFriends.length) {
        const empty = createElement("div", "conversation-empty");

        empty.append(
            createElement("div", "conversation-empty-icon", "✉"),
            createElement(
                "p",
                "",
                query ? "No matching friends found." : "No friends yet."
            )
        );

        const link = createElement("a", "", "Find friends");
        link.href = "/friends/";

        empty.appendChild(link);
        conversationList.appendChild(empty);

        return;
    }

    for (const friend of filteredFriends) {
        const item = createElement("button", "conversation-item");
        item.type = "button";

        if (selectedFriend?.id === friend.id) {
            item.classList.add("active");
        }

        const avatar = createElement("div", "conversation-avatar");

        if (friend.avatar_url) {
            const image = document.createElement("img");
            image.src = friend.avatar_url;
            image.alt = "";
            image.loading = "lazy";

            image.addEventListener("error", () => {
                avatar.replaceChildren();
                avatar.textContent = getInitial(friend);
            }, { once: true });

            avatar.appendChild(image);
        } else {
            avatar.textContent = getInitial(friend);
        }

        const info = createElement("div", "conversation-info");

        const name = createElement(
            "div",
            "conversation-name",
            friend.display_name || friend.username || "Unknown"
        );

        const previewMessage = latestMessages.get(friend.id);

        let previewText = "Start a conversation";

        if (previewMessage) {
            const ownMessage = previewMessage.sender_id === currentUser.id;

            previewText = `${ownMessage ? "You: " : ""}${previewMessage.content}`;
        }

        const preview = createElement(
            "div",
            "conversation-preview",
            previewText
        );

        info.append(name, preview);
        item.append(avatar, info);

        item.addEventListener("click", () => {
            openConversation(friend);
        });

        conversationList.appendChild(item);
    }
}

// ==========================================
// OPEN CONVERSATION
// ==========================================

async function openConversation(friend) {
    selectedFriend = friend;

    showConversation();
    renderConversations();

    renderAvatar(activeAvatar, friend);

    activeName.textContent =
        friend.display_name || friend.username || "Unknown";

    activeUsername.textContent = friend.username
        ? `@${friend.username}`
        : "";

    messageInput.disabled = false;

    await loadMessages();
    messageInput.focus();
}

// ==========================================
// LOAD MESSAGES
// ==========================================

async function loadMessages() {
    if (!selectedFriend) return;

    const friendId = selectedFriend.id;

    messageList.replaceChildren(
        createElement("div", "message-empty", "Loading messages...")
    );

    const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .or(
            `and(sender_id.eq.${currentUser.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${currentUser.id})`
        )
        .order("created_at", { ascending: true })
        .limit(500);

    if (error) {
        messageList.replaceChildren(
            createElement("div", "message-empty", "Could not load messages.")
        );

        console.error("[Curl Chat] Message loading failed:", error);
        return;
    }

    if (selectedFriend?.id !== friendId) return;

    messages = data || [];
    renderMessages();
}

// ==========================================
// REAL BADGE IMAGES
// ==========================================

function appendBadges(nameRow, user) {
    if (user?.verified) {
        const verified = document.createElement("img");

        verified.src = "/assets/images/verified.png";
        verified.alt = "Verified";
        verified.title = "Verified";
        verified.className = "chat-badge verified-badge";

        nameRow.appendChild(verified);
    }

    if (user?.curl_mod) {
        const moderator = document.createElement("img");

        moderator.src = "/assets/images/curlmod.png";
        moderator.alt = "Curl Moderator";
        moderator.title = "Curl Moderator";
        moderator.className = "chat-badge moderator-badge";

        nameRow.appendChild(moderator);
    }
}

// ==========================================
// RENDER MESSAGES
// ==========================================

function renderMessages() {
    messageList.replaceChildren();

    if (!messages.length) {
        messageList.appendChild(
            createElement(
                "div",
                "message-empty",
                `You and ${selectedFriend.username} haven't chatted yet. Say hello!`
            )
        );

        return;
    }

    for (const message of messages) {
        const ownMessage = message.sender_id === currentUser.id;
        const user = ownMessage ? myProfile : selectedFriend;

        const wrapper = createElement(
            "div",
            ownMessage ? "message-row own" : "message-row"
        );

        const avatar = createElement("div", "message-avatar");
        renderAvatar(avatar, user || { username: "?" });

        const contentWrapper = createElement(
            "div",
            "message-content-wrapper"
        );

        const nameRow = createElement("div", "message-name-row");

        const name = createElement(
            "span",
            "message-sender-name",
            user?.display_name || user?.username || "Unknown"
        );

        nameRow.appendChild(name);
        appendBadges(nameRow, user);

        const bubble = createElement(
            "div",
            ownMessage ? "message-bubble own" : "message-bubble"
        );

        const text = createElement(
            "p",
            "message-content",
            message.content
        );

        const time = createElement(
            "span",
            "message-time",
            formatTime(message.created_at)
        );

        bubble.append(text, time);
        contentWrapper.append(nameRow, bubble);

        if (ownMessage) {
            wrapper.append(contentWrapper, avatar);
        } else {
            wrapper.append(avatar, contentWrapper);
        }

        messageList.appendChild(wrapper);
    }

    messageList.scrollTop = messageList.scrollHeight;
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(event) {
    event.preventDefault();

    if (!selectedFriend || sendingMessage) return;

    const content = messageInput.value.trim();

    if (!content || content.length > 2000) return;

    sendingMessage = true;
    sendButton.disabled = true;

    const recipientId = selectedFriend.id;

    const { data, error } = await supabase
        .from("messages")
        .insert({
            sender_id: currentUser.id,
            recipient_id: recipientId,
            content
        })
        .select("id, sender_id, recipient_id, content, created_at")
        .single();

    sendingMessage = false;
    sendButton.disabled = !messageInput.value.trim();

    if (error) {
        console.error("[Curl Chat] Sending failed:", error);
        alert("Your message could not be sent. Please try again.");
        return;
    }

    messageInput.value = "";
    sendButton.disabled = true;

    if (selectedFriend?.id === recipientId) {
        if (!messages.some(message => message.id === data.id)) {
            messages.push(data);
            renderMessages();
        }
    }

    latestMessages.set(recipientId, data);
    renderConversations();
}

// ==========================================
// REALTIME
// ==========================================

function setupRealtime() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
        .channel("curl-chat-" + currentUser.id)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages"
            },
            payload => {
                const message = payload.new;

                const belongsToUser =
                    message.sender_id === currentUser.id ||
                    message.recipient_id === currentUser.id;

                if (!belongsToUser) return;

                const otherUserId =
                    message.sender_id === currentUser.id
                        ? message.recipient_id
                        : message.sender_id;

                latestMessages.set(otherUserId, message);

                renderConversations();

                if (
                    selectedFriend &&
                    (
                        message.sender_id === selectedFriend.id ||
                        message.recipient_id === selectedFriend.id
                    )
                ) {
                    if (!messages.some(item => item.id === message.id)) {
                        messages.push(message);

                        messages.sort(
                            (a, b) =>
                                new Date(a.created_at) -
                                new Date(b.created_at)
                        );

                        renderMessages();
                    }
                }
            }
        )
        .subscribe();
}

// ==========================================
// EVENT LISTENERS
// ==========================================

chatSearch?.addEventListener("input", renderConversations);

backButton?.addEventListener("click", showPlaceholder);

messageForm?.addEventListener("submit", sendMessage);

messageInput?.addEventListener("input", () => {
    sendButton.disabled = !messageInput.value.trim();
});

// ==========================================
// INITIALIZATION
// ==========================================

async function initChat() {
    try {
        const session = await getSession();

        if (!session?.user) {
            showError("Please log in to use Curl Chat.");
            return;
        }

        currentUser = session.user;

        const { data: profile, error } = await supabase
            .from("profiles")
            .select(
                "id, username, display_name, avatar_url, verified, curl_mod"
            )
            .eq("id", currentUser.id)
            .single();

        if (error) throw error;

        myProfile = profile;

        await loadFriends();
        await loadLatestMessages();

        setupRealtime();
        showPlaceholder();

    } catch (error) {
        console.error("[Curl Chat] Initialization failed:", error);

        showError(
            error.message || "Could not load Curl Chat. Please refresh."
        );
    }
}

initChat();
