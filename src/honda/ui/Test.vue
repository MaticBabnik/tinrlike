<script setup lang="ts">
import { ref } from 'vue';

const lastMessage = ref<unknown>(null);

defineExpose({
    onMessage(message: unknown) {
        lastMessage.value = message;
    }
})
</script>


<template>
    <div>
        <h2>Test Component</h2>
        <pre>{{ lastMessage }}</pre>
    </div>
</template>


<style scoped>
div {
    margin: auto;
    background-color: black;
}

h2,
pre {
    color: white;
}
</style>