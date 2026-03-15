<script lang="ts" setup>
const props = defineProps<{
    defs: [number, string][];
    value: number;
}>();

const emit = defineEmits<{
    value: [number];
}>();
</script>

<template>
    <div>
        <button
            v-for="[val, label] in defs"
            :key="val"
            @click="emit('value', val)"
            :class="{ active: val === value }"
        >
            {{ label }}
        </button>
    </div>
</template>

<style scoped>
button {
    font-size: 32px;
    border: none;
    background-color: transparent;
    color: white;
    font-family: "rsPlain";
    padding: 10px;
    border-inline: 4px solid transparent;

    transition: color 0.1s ease-out, border-color 0.3s ease-out;

    &:hover {
        color: rgb(255, 136, 0);
    }
}

div {
    display: flex;
    gap: 0;

    & > button {
        flex: 1;

        &.active {
            border-color: rgb(255, 196, 0);
            color: rgb(255, 136, 0);
        }
    }
}
</style>
