<script setup lang="ts">
import { ref, onMounted } from "vue";

const theme = ref<"light" | "dark">("light");

onMounted(() => {
  const saved = localStorage.getItem("theme");
  const init = saved === "dark" ? "dark" : "light";
  theme.value = init;
  document.documentElement.classList.toggle("dark", init === "dark");
});

function toggleTheme() {
  const next = theme.value === "light" ? "dark" : "light";
  theme.value = next;
  document.documentElement.classList.toggle("dark", next === "dark");
  localStorage.setItem("theme", next);
}
</script>

<template>
  <button
    @click="toggleTheme"
    class="fixed top-4 right-4 px-3 py-2 rounded bg-(--color-muted) text-(--color-text) border border-(--color-border) shadow-sm cursor-pointer"
  >
    {{ theme === "light" ? "🌞 Light" : "🌙 Dark" }}
  </button>
</template>
