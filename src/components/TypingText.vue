<script setup lang="ts">
import { ref, watch } from "vue";

interface Props {
  text: string;
  speed?: number;
}

const props = defineProps<Props>();
const displayed = ref("");

// Whenever props.text changes (new chunks), animate typing
watch(
  () => props.text,
  async (newText) => {
    // If new chunk arrives, type it out
    if (newText.length > displayed.value.length) {
      const diff = newText.slice(displayed.value.length);
      for (const char of diff) {
        displayed.value += char;
        await new Promise((r) => setTimeout(r, props.speed ?? 20));
      }
    }
  }
);
</script>

<template>
  <p class="whitespace-pre-wrap">{{ displayed }}</p>
</template>
