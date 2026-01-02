<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<template>
  <div class="mt-4 px-4 py-2 rounded bg-red-100 text-red-700 border border-red-300">
    ⚠️ {{ message }}
  </div>
</template>
