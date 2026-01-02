<script setup lang="ts">
import { ref } from "vue";

// Local state for the input field
const question = ref("");

// Emit event to parent when user submits
const emit = defineEmits<{
  (e: "ask", value: string): void;
}>();

function submit() {
  if (!question.value.trim()) return;
  emit("ask", question.value.trim());
  question.value = ""; // clear after sending
}
</script>

<template>
  <form @submit.prevent="submit" class="flex w-full max-w-xl gap-2 mt-6">
    <input
      v-model="question"
      type="text"
      placeholder="Ask me anything..."
      class="flex-1 px-3 py-2 rounded border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
    />
    <button
      type="submit"
      class="px-4 py-2 rounded bg-primary text-white hover:bg-primary/80 transition-colors"
    >
      Send
    </button>
  </form>
</template>
