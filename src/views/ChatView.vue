<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import FileUpload from "../components/FileUpload.vue";
import { useAskStream } from "../composables/useAskStream";

const { answer, messages, askStream, abortStream, downloadFile, loading, error } = useAskStream();
const question = ref("");
const attachedFile = ref<File | null>(null);

onMounted(() => {
  messages.value.push({
    role: "assistant",
    type: "text",
    content: "Hello 👋 I’m your Copilot. How can I help you today?",
  });
});

function submit() {
  if (!question.value.trim() && !attachedFile.value) return;

  // Show user bubble with file + question
  let userMsg = question.value.trim();
  if (attachedFile.value) {
    userMsg = `📎 Attached file: ${attachedFile.value.name}\n❓ Question: ${userMsg}`;
  }
  messages.value.push({ role: "user", type: "text", content: userMsg });

  // Send to backend only now
  askStream(question.value.trim(), attachedFile.value || undefined);

  // Reset
  question.value = "";
  attachedFile.value = null;
}

watch(answer, (newVal) => {
  if (newVal) {
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === "assistant" && last.type === "text") {
      last.content = newVal;
    } else {
      messages.value.push({ role: "assistant", type: "text", content: newVal });
    }
  }
});

function handleAttach(file: File) {
  attachedFile.value = file;
}

function handleEnter(e: KeyboardEvent) {
  if (e.shiftKey) {
    // allow newline
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    question.value = question.value.substring(0, start) + "\n" + question.value.substring(end);
    nextTick(() => {
      target.selectionStart = target.selectionEnd = start + 1;
    });
  } else {
    // plain Enter → send
    submit();
  }
}

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  const maxHeight = 150; // px, ~6 lines
  target.style.height = Math.min(target.scrollHeight, maxHeight) + "px";
}
</script>

<template>
  <div class="flex flex-col min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]">
    <!-- Messages -->
    <div class="flex-1 overflow-y-auto p-6 space-y-4">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        :class="msg.role === 'user' ? 'text-right' : 'text-left'"
      >
        <div
          :class="[
            'inline-block px-4 py-2 rounded-lg max-w-xl whitespace-pre-line',
            msg.role === 'user'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-muted)] text-[var(--color-text)]',
          ]"
        >
          <!-- Text -->
          <span v-if="!msg.type || msg.type === 'text'">{{ msg.content }}</span>

          <!-- File -->
          <div v-else-if="msg.type === 'file'" class="flex items-center gap-2">
            📥 {{ msg.content }}
            <button
              @click="downloadFile(msg.blob!, msg.filename!)"
              class="px-2 py-1 rounded bg-[var(--color-accent)] text-white text-sm hover:opacity-90"
            >
              Download
            </button>
          </div>

          <!-- Image -->
          <div v-else-if="msg.type === 'image'">
            <img :src="msg.url" alt="Answer image" class="rounded-lg shadow-md max-w-xs" />
          </div>
        </div>
      </div>

      <LoadingIndicator v-if="loading" />
      <ErrorMessage v-if="error" :message="error" />
    </div>

    <!-- Input bar -->
    <div class="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div class="flex flex-col gap-2 max-w-3xl mx-auto">
        <!-- Attachment chip(s) on top -->
        <div
          v-if="attachedFile"
          class="flex items-center gap-2 bg-[var(--color-muted)] text-[var(--color-text)] px-3 py-2 rounded-lg text-sm"
        >
          📎 {{ attachedFile.name }}
          <button
            @click="attachedFile = null"
            class="ml-2 text-red-500 hover:text-red-700 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <!-- Input + buttons row -->
        <div class="flex items-center gap-2">
          <textarea
            v-model="question"
            placeholder="Ask me anything..."
            class="flex-1 px-4 py-3 bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none overflow-hidden rounded-lg"
            :disabled="loading"
            rows="1"
            @keydown.enter.prevent="handleEnter"
            @input="autoResize"
          />

          <!-- Send / Stop -->
          <button
            v-if="!loading"
            @click="submit"
            class="px-4 py-2 rounded-full bg-[var(--color-primary)] text-white hover:opacity-90 transition cursor-pointer"
          >
            Send
          </button>
          <button
            v-else
            @click="abortStream"
            class="px-4 py-2 rounded-full bg-red-500 text-white hover:opacity-90 transition cursor-pointer"
          >
            Stop
          </button>

          <!-- File Upload -->
          <FileUpload @attach="handleAttach" />
        </div>
      </div>
    </div>
    <ThemeToggle />
  </div>
</template>
