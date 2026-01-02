<script setup lang="ts">
import { ref } from "vue";
const fileInput = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
  fileInput.value?.click();
}

const emit = defineEmits<{
  (e: "attach", file: File): void;
}>();

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    emit("attach", target.files[0]);
    target.value = ""; // reset input
  }
}
</script>

<template>
  <div>
    <input type="file" class="hidden" @change="handleFileChange" ref="fileInput" />
    <button
      @click="triggerFileInput"
      class="px-4 py-2 rounded-full bg-[var(--color-accent)] text-white hover:opacity-90 transition cursor-pointer"
    >
      📎 Attach File
    </button>
  </div>
</template>
