<script setup lang="ts">
const emit = defineEmits<{ message: [unknown] }>();

function back() {
    emit("message", "menu");
}
</script>

<template>
    <div class="fire"></div>

    <div class="full">
        <h1 class="pxfont">Settings</h1>

        <div class="hstack">
            <button @click="back">Back</button>
        </div>

        <!-- <button @click="emit('message', 'play')"> Play </button> -->
    </div>
</template>

<style scoped>
.fire {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    background-size: 133.7%, 133.7%, 100%;
    background-image:
        url("../assets/noise.png"), url("../assets/noise.png"),
        radial-gradient(circle, #000, #000 20%, #747474 25%, #000 50%);
    background-blend-mode: difference, difference, normal;
    filter: sepia(1) contrast(6);
    animation:
        sliding 10.5s linear infinite,
        blink 1.337s linear infinite;
}

.full {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

hr {
    width: 400px;
    border: 2px solid rgba(255, 196, 0);
    margin: 20px 0;
}

h1 {
    font-family: "rsQuill";
    font-size: 96px;
    margin: 20px 0;

    color: black;
    text-shadow:
        0 0 4px rgb(255, 196, 0),
        0 0 50px rgb(255, 196, 0);
}

.settings-grid {
    display: grid;
    grid-template-columns: auto auto;
    gap: 20px 60px;

    align-items: center;

    padding: 20px;
    margin: 20px 0;
    border-block: 2px solid rgb(255, 136, 0);

    background-color: #000a;
}

.settings-grid span {
    font-size: 32px;
    border: none;
    background-color: transparent;
    color: white;
    font-family: "rsPlain";
}

.hstack {
    display: flex;
    flex-direction: row;
    gap: 10px;
}

button {
    font-size: 32px;
    border: none;
    background-color: transparent;
    color: white;
    font-family: "rsPlain";
    padding: 10px;
    border-inline: 4px solid transparent;

    transition:
        color 0.1s ease-out,
        border-color 0.3s ease-out;

    &:hover {
        border-color: rgb(255, 196, 0);
        color: rgb(255, 136, 0);
    }
}

@keyframes sliding {
    0%,
    100% {
        background-position:
            1337px 0,
            -2222px 0,
            -13px 0;
    }

    25% {
        background-position:
            0 1337px,
            0 -2222px,
            0 -13px;
    }

    50% {
        background-position:
            -1337px 0,
            2222px 0,
            13px 0;
    }

    75% {
        background-position:
            0 -1337px,
            0 2222px,
            0 13px;
    }
}

@keyframes blink {
    0%,
    13%,
    46%,
    67%,
    100% {
        opacity: 1;
    }

    3%,
    30%,
    80% {
        opacity: 0.9;
    }
}
</style>
