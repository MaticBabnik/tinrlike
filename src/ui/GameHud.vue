<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{ message: [unknown] }>();

const health = ref(100);
const maxHealth = ref(100);
const abilities = ref([] as string[]);

defineExpose({
    onMessage(msg: Record<string, unknown> | null) {
        if (typeof msg !== 'object' || msg === null) return;

        if (typeof msg.health === 'number')
            health.value = msg.health;

        if (typeof msg.maxHealth === 'number')
            maxHealth.value = msg.maxHealth;

        if (Array.isArray(msg.abilities)) {
            abilities.value = msg.abilities.filter(a => typeof a === 'string') as string[];
        }
    }
})


</script>

<template>
    <div class="hud">
        <div class="abilities">
            <div v-for="ability in abilities" :key="ability" class="ability">
                {{ ability }}
            </div>
        </div>

        <div class="health-container">
            <div class="health-bar" :style="`width: ${health / maxHealth * 100}%;`">
            </div>
            <div class="health-text">
                {{ health.toFixed(0) }}
            </div>
        </div>
    </div>
</template>


<style scoped>
.hud {
    position: absolute;
    bottom: 20px;
    left: 20px;


    * {
        font-family: 'rsPlain';
    }
}

.abilities {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
    align-items: flex-start;
}

.ability {
    font-size: 16px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    font-weight: 600;
    color: orange;
    outline: 2px solid rgb(221, 131, 21);
}

.health-container {
    font-size: 32px;

    position: relative;
    width: 300px;
    background-color: rgba(0, 0, 0, 0.7);
    border: 4px solid white;
    box-shadow: 0 0 10px 2px rgba(0, 0, 0, 0.2);
}

.health-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background-color: red;
}

.health-text {
    position: relative;
    font-weight: bold;
    color: white;
    z-index: 100;
    padding: .5rem
}
</style>
