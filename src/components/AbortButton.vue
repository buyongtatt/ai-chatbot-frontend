<script setup lang="ts">
const emit = defineEmits<{
  (e: "abort"): void;
}>();
</script>

<template>
  <button
    @click="emit('abort')"
    class="mt-4 px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
  >
    Stop Generating
  </button>
</template>
