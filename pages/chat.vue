<script setup lang="ts">
import { io, type Socket } from "socket.io-client";
import type { Chat, Reply, User } from "~/types/index";

const route = useRoute();

const chats = ref<Chat[]>([]);
const users = ref<User[]>([]);
const socket = ref<Socket>();
const message = ref<string>("");
const currentRoom = ref<string>("");
const typingUsers = ref<Set<string>>(new Set());
const currentUsername = computed(() => route.query.username as string);
const isAdmin = computed(() => route.query.username === "admin");
const showMenu = ref<{ [key: number]: boolean }>({});
const deletingMessageId = ref<number | null>(null);
const editingMessageId = ref<number | null>(null);
const editedMessage = ref<string>("");
const replyingToMessageId = ref<number | null>(null);
const replyMessage = ref<string>("");
const editingReplyId = ref<number | null>(null);
const editedReplyText = ref<string>("");
const deletingReplyId = ref<number | null>(null);
const userToKick = ref<string | null>(null);
const showKickModal = ref<boolean>(false);

let typingTimeout: number | null = null;

// Send Message
const sendMessage = async () => {
  if (message.value.trim()) {
    const messageId = Date.now();
    socket.value?.emit("sendMessage", { text: message.value, messageId });
    await nextTick(() => (message.value = ""));
  }
};

// Toggle Menu
const toggleMenu = (messageId: number) => {
  showMenu.value[messageId] = !showMenu.value[messageId];
};

// Edit Message
const editMessage = (messageId: number) => {
  const chatToEdit = chats.value.find(
    (chat: Chat) => chat.messageId === messageId
  );
  if (chatToEdit) {
    editingMessageId.value = messageId;
    editedMessage.value = chatToEdit.text;
    toggleMenu(messageId);
  }
};

// Edit Reply
const editReply = (replyId: number) => {
  const chat = chats.value.find((chat: Chat) =>
    chat.replies?.some((reply) => reply.messageId === replyId)
  );
  if (chat) {
    const replyToEdit = chat.replies?.find(
      (reply: Reply) => reply.messageId === replyId
    );
    if (replyToEdit) {
      editingReplyId.value = replyId;
      editedReplyText.value = replyToEdit.text;
      toggleMenu(replyId);
    }
  }
};

// Cancel Edit
const cancelEdit = () => {
  editingMessageId.value = null;
};

// Confirm Delete Message
const confirmDeleteMessage = (messageId: number) => {
  deletingMessageId.value = messageId;
  toggleMenu(messageId);
};

// Update Message
const updateMessage = () => {
  if (editingMessageId.value !== null) {
    const originalChat = chats.value.find(
      (chat: Chat) => chat.messageId === editingMessageId.value
    );
    if (originalChat && originalChat.text !== editedMessage.value) {
      socket.value?.emit("updateMessage", {
        messageId: editingMessageId.value,
        text: editedMessage.value,
        edited: true,
      });
    }
    editingMessageId.value = null;
  }
};

// Confirm Edit Reply
const updateReply = () => {
  if (editingReplyId.value !== null && editedReplyText.value.trim() !== "") {
    socket.value?.emit("updateReply", {
      replyId: editingReplyId.value,
      text: editedReplyText.value.trim(),
      edited: true,
    });
    editingReplyId.value = null;
    editedReplyText.value = "";
  }
};

// Reply To Message
const replyToMessage = (messageId: number) => {
  replyingToMessageId.value = messageId;
};

// Send Reply
const sendReply = () => {
  if (replyMessage.value.trim() && replyingToMessageId.value !== null) {
    const replyId = Date.now();
    socket.value?.emit("sendReply", {
      text: replyMessage.value,
      replyId,
      originalMessageId: replyingToMessageId.value,
    });
    replyMessage.value = "";
    replyingToMessageId.value = null;
  }
};

// Cancel Reply
const cancelReply = () => {
  replyingToMessageId.value = null;
};

// Cancel Edit Reply
const cancelEditReply = () => {
  editingReplyId.value = null;
  editedReplyText.value = "";
};

// Confirm Delete Reply
const confirmDeleteReply = (replyId: number) => {
  deletingReplyId.value = replyId;
  toggleMenu(replyId);
};

// Delete Reply
const deleteReply = (replyId: number) => {
  socket.value?.emit("deleteReply", replyId);
  deletingReplyId.value = null;
};

// Cancel Delete
const cancelDelete = () => {
  deletingMessageId.value = null;
};

// Cancel Delete Reply
const cancelDeleteReply = () => {
  deletingReplyId.value = null;
};

// Delete Message
const deleteMessage = (messageId: number) => {
  socket.value?.emit("deleteMessage", messageId);
  deletingMessageId.value = null;
};

// Method Typing
const typing = () => {
  if (message.value.trim()) {
    socket.value?.emit("typing", currentRoom.value, currentUsername.value);

    if (typingTimeout !== null) {
      clearTimeout(typingTimeout);
    }

    typingTimeout = window.setTimeout(() => {
      socket.value?.emit("typing", currentRoom.value, "");
      typingTimeout = null;
    }, 500);
  } else {
    socket.value?.emit("typing", currentRoom.value, "");
  }
};

// Method Kick User
const kickUser = () => {
  if (isAdmin.value && userToKick.value) {
    socket.value?.emit("kickUser", currentRoom.value, userToKick.value);
    showKickModal.value = false;
  }
};

// Show Kick Confirmation
const showKickConfirmation = (username: string) => {
  userToKick.value = username;
  showKickModal.value = true;
};

onMounted(() => {
  const { username, room } = route.query as Partial<Chat>;
  if (!username || !room) {
    navigateTo("/");
  }

  socket.value = io({
    path: "/api/socket.io",
  });

  // Connected
  socket.value.on("connect", () => {
    console.log("Connected to server");
  });

  // Join Room
  socket.value.emit("joinRoom", { username, room });

  // Message
  socket.value.on("message", (response: Chat) => {
    chats.value.push(response);
  });

  // Socket Typing
  socket.value.on("typing", (username: string) => {
    if (username) {
      typingUsers.value.add(username);
    } else {
      typingUsers.value.clear();
    }
  });

  // Room Users
  socket.value.on("roomUsers", (response: { room: string; users: User[] }) => {
    currentRoom.value = response.room;
    users.value = response.users;
  });

  // Kicked
  socket.value.on("kicked", (message: string) => {
    console.log("Received kicked message:", message);
    alert(message);
    navigateTo("/");
  });

  // Message Update
  socket.value.on("messageUpdate", ({ messageId, text, edited }: Chat) => {
    const chat = chats.value.find((chat: Chat) => chat.messageId === messageId);
    if (chat) {
      chat.text = text;
      chat.edited = edited;
    }
  });

  // Message Reply
  socket.value.on(
    "reply",
    (response: {
      originalMessageId: number;
      replyId: number;
      text: string;
    }) => {
      const originalChat = chats.value.find(
        (chat: Chat) => chat.messageId === response.originalMessageId
      );
      if (originalChat) {
        if (!originalChat.replies) {
          originalChat.replies = [];
        }
        originalChat.replies.push({
          messageId: response.replyId,
          text: response.text,
          username: currentUsername.value,
          time: new Date().toLocaleTimeString(),
          replyTo: 0,
          edited: false,
          replyId: "",
        });
      }
    }
  );

  // Reply Updated
  socket.value.on("replyUpdate", ({ replyId, text, edited }: Reply) => {
    for (const chat of chats.value) {
      if (chat.replies) {
        const reply = chat.replies.find((r: any) => r.messageId === replyId);
        if (reply) {
          reply.text = text;
          reply.edited = edited;
        }
      }
    }
  });

  // Message Deleted
  socket.value.on("messageDeleted", (messageId: string) => {
    chats.value = chats.value.filter(
      (chat: any) => chat.messageId !== messageId
    );
  });

  // Reply Deleted
  socket.value.on("replyDeleted", (replyId: number) => {
    for (const chat of chats.value) {
      if (chat.replies) {
        chat.replies = chat.replies.filter(
          (reply: Reply) => reply.messageId !== replyId
        );
      }
    }
  });

  const inputElement = document.querySelector("input");
  if (inputElement) {
    inputElement.addEventListener("input", typing);
  }
});

onBeforeUnmount(() => {
  if (socket.value) {
    socket.value.emit("disconnectUser", {
      room: currentRoom.value,
      username: route.query.username,
    });
    socket.value.disconnect();
  }

  const inputElement = document.querySelector("input");
  if (inputElement) {
    inputElement.removeEventListener("input", typing);
  }
});
</script>

<template>
  <UCard class="" :ui="{ body: { padding: 'p-0 sm:p-0' } }">
    <template #header>
      <div class="flex items-center justify-between text-primary">
        <div class="flex items-center gap-x-2">
          <UIcon
            name="i-heroicons-chat-bubble-left-right"
            class="w-6 h-6 font-semibold"
          />
          <div class="text-primary font-semibold text-center text-xl">
            Nuxt Chat App
          </div>
        </div>
        <div v-if="typingUsers.size > 0" class="text-gray-500 mt-2">
          <span v-for="user in typingUsers" :key="user"
            >{{ user }} is typing...</span
          >
        </div>
        <div
          @click="() => navigateTo('/')"
          class="bg-primary px-3 py-1.5 text-white cursor-pointer"
        >
          Leave {{ route.query.room }}
        </div>
      </div>
    </template>
    <div class="flex">
      <!-- Sidebar -->
      <div class="bg-slate-100 py-4 px-6">
        <div class="mb-4">
          <div
            class="flex items-center gap-x-2 mb-2 px-3 py-1.5 rounded-md bg-white"
          >
            <UIcon
              name="i-heroicons-chat-bubble-bottom-center-text"
              class="w-6 h-6 font-semibold"
            />
            <div class="text-base">Room Name</div>
          </div>
          <div
            class="text-gray-500 hover:text-gray-900 mb-2 capitalize text-base ml-2"
          >
            {{ currentRoom }}
          </div>
        </div>
        <div>
          <div
            class="flex items-center gap-x-2 mb-2 px-3 py-1.5 rounded-md bg-white"
          >
            <UIcon
              name="i-heroicons-user-group"
              class="w-6 h-6 font-semibold"
            />
            <div class="text-base">Users</div>
          </div>
          <div
            v-for="(user, i) in users"
            :key="i"
            class="text-gray-500 hover:text-gray-900 mb-2 capitalize text-base ml-2 flex items-center"
            :class="{
              'border-b border-primary': user.username === route.query.username,
            }"
          >
            {{ user.username }}
            <span
              v-if="user.isOnline"
              class="ml-2 w-2.5 h-2.5 bg-green-500 rounded-full"
              title="Online"
            ></span>
            <span
              v-else
              class="ml-2 w-2.5 h-2.5 bg-gray-400 rounded-full"
              title="Offline"
            ></span>
            <button
              v-if="isAdmin && user.username !== route.query.username"
              @click="showKickConfirmation(user.username)"
              class="ml-2 text-red-500 hover:text-red-700"
            >
              Kick
            </button>
          </div>
        </div>
      </div>
      <!-- Chat -->
      <div class="h-96 overflow-y-auto px-8 py-10 flex-1 relative">
        <div
          class="bg-transparent w-full mb-3 flex relative"
          v-for="(chat, i) in chats"
          :key="i"
          :class="{
            'justify-center': chat.username === 'NuxtChatapp Admin',
            'justify-end': chat.username === route.query.username,
            'justify-start': chat.username !== route.query.username,
          }"
        >
          <div
            class="px-6 py-2 w-1/2 rounded-md mb-3"
            :class="{
              'bg-red-100': chat.username === 'NuxtChatapp Admin',
              'bg-primary/20': chat.username === route.query.username,
              'bg-green-300': chat.username !== route.query.username,
            }"
          >
            <div class="flex items-center gap-x-3">
              <div class="text-xs text-primary font-semibold">
                {{ chat.username }}
              </div>
              <div class="text-xs">{{ chat.time }}</div>
              <button
                v-if="chat.username === route.query.username"
                @click="toggleMenu(chat.messageId)"
                class="text-gray-500 hover:text-gray-700 ml-auto"
              >
                ⋮
              </button>
            </div>
            <div class="mt-1 text-base">
              {{ chat.text }}
            </div>
            <div v-if="chat.edited" class="text-xs text-gray-500 mt-1">
              <em>edited</em>
            </div>

            <!-- Reply Button -->
            <button
              v-if="chat.username !== route.query.username"
              @click="replyToMessage(chat.messageId)"
              class="text-gray-500 hover:text-gray-700 mt-2"
            >
              Reply
            </button>

            <!-- Replies -->
            <div
              v-if="chat.replies && chat.replies.length > 0"
              class="ml-4 mt-2 reply-container"
            >
              <div
                v-for="reply in chat.replies"
                :key="reply.messageId"
                class="reply-message"
              >
                <div class="flex items-center gap-x-3">
                  <div class="text-xs text-primary font-semibold">
                    {{ reply.username }}
                  </div>
                  <div class="text-xs">{{ reply.time }}</div>
                  <button
                    v-if="reply.username === route.query.username"
                    @click="() => toggleMenu(reply.messageId)"
                    class="text-gray-500 hover:text-gray-700 ml-auto"
                  >
                    ⋮
                  </button>
                </div>
                <div class="text-base reply">
                  {{ reply.text }}
                </div>
                <div v-if="reply.edited" class="text-xs text-gray-500 mt-1">
                  <em>edited</em>
                </div>

                <!-- Reply Modal -->
                <div
                  v-if="showMenu[reply.messageId]"
                  class="reply-menu bg-white border border-gray-200 rounded-lg shadow-lg"
                >
                  <button
                    @click="editReply(reply.messageId)"
                    class="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    @click="confirmDeleteReply(reply.messageId)"
                    class="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Menu -->
          <div
            v-if="showMenu[chat.messageId]"
            class="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg"
          >
            <button
              @click="editMessage(chat.messageId)"
              class="w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Edit
            </button>
            <button
              @click="confirmDeleteMessage(chat.messageId)"
              class="w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Delete
            </button>
            <button
              v-if="chat.username !== route.query.username"
              @click="replyToMessage(chat.messageId)"
              class="text-gray-500 hover:text-gray-700 ml-auto"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <form @submit.prevent="sendMessage">
        <UInput
          v-model="message"
          placeholder="Enter your message...."
          :ui="{ padding: 'px-6 py-10' }"
          @keypress="typing"
        >
          <template #trailing>
            <UButton
              icon="i-heroicons-paper-airplane"
              size="xs"
              color="primary"
              variant="solid"
              :trailing="false"
              label="Send"
              class="my-3"
              type="submit"
            />
          </template>
        </UInput>
      </form>
    </template>

    <!-- Kick Confirmation Modal -->
    <div
      v-if="showKickModal"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <h3>Are you sure you want to kick {{ userToKick }}?</h3>
        <div class="flex justify-end gap-2">
          <button
            @click="kickUser"
            class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Yes
          </button>
          <button
            @click="showKickModal = false"
            class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
          >
            No
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Message Modal -->
    <div
      v-if="editingMessageId !== null"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-lg p-6 max-w-3xl w-full mx-4 relative"
      >
        <p class="text-lg mb-4">Edit your message:</p>
        <textarea
          v-model="editedMessage"
          placeholder="Enter your message...."
          rows="10"
          class="w-full p-4 border border-gray-300 rounded resize-none outline-none"
          style="min-height: 300px"
        ></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button
            @click="updateMessage(editingMessageId)"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Update
          </button>
          <button
            @click="cancelEdit"
            class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Reply Modal -->
    <div
      v-if="editingReplyId !== null"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4 relative"
      >
        <p class="text-lg mb-4">Edit your reply:</p>
        <textarea
          v-model="editedReplyText"
          placeholder="Enter your reply...."
          rows="5"
          class="w-full p-4 border border-gray-300 rounded resize-none outline-none"
        ></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button
            @click="updateReply"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Update
          </button>
          <button
            @click="cancelEditReply"
            class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog for Reply Deletion -->
    <div
      v-if="deletingReplyId !== null"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <p class="text-lg mb-4">Are you sure you want to delete this reply?</p>
        <div class="flex justify-end gap-2">
          <button
            @click="deleteReply(deletingReplyId)"
            class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Delete
          </button>
          <button
            @click="cancelDeleteReply"
            class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <div
      v-if="deletingMessageId !== null"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <p class="text-lg mb-4">
          Are you sure you want to delete this message?
        </p>
        <div class="flex justify-end gap-2">
          <button
            @click="deleteMessage(deletingMessageId)"
            class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Delete
          </button>
          <button
            @click="cancelDelete"
            class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Reply Modal -->
    <div
      v-if="replyingToMessageId !== null"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4 relative"
      >
        <p class="text-lg mb-4">Reply to the message:</p>
        <textarea
          v-model="replyMessage"
          placeholder="Enter your reply...."
          rows="5"
          class="w-full p-4 border border-gray-300 rounded resize-none outline-none"
        ></textarea>
        <div class="flex justify-end gap-2 mt-4">
          <button
            @click="sendReply"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Send
          </button>
          <button
            @click="cancelReply"
            class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </UCard>
</template>

<style>
.chat-container {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  overflow-x: hidden;
}

.reply {
  overflow-wrap: break-word;
}

.reply-container {
  display: flex;
  flex-direction: column;
  margin-left: 1rem;
  word-wrap: break-word;
}

.reply-message {
  background-color: #f0f0f0;
  padding: 0.5rem;
  border-radius: 0.5rem;
  max-width: 100%;
  overflow-wrap: break-word;
  margin-bottom: 0.5rem;
}

.reply-message {
  position: relative;
}

.reply-menu {
  position: absolute;
  right: 0;
  top: 0;
  transform: translateY(10px);
  z-index: 1000;
}
</style>
