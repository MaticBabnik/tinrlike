<script setup lang="ts">
import { shallowRef, useTemplateRef, type Component } from 'vue';

const currentViewComponent = shallowRef<Component>();
const mountedView = useTemplateRef<Component>('mv');
const gameQueue: unknown[] = [];

function sendMessageToView(message: unknown) {
    //@ts-expect-error bullshit
    mountedView.value?.onMessage?.(message);
}

function sendMessageToGame(message: unknown) {
    gameQueue.push(message);
}

defineExpose({
    currentViewComponent,
    sendMessageToView,
    isChildMounted() {
        return !!mountedView.value;
    },
    gameQueue,
});

</script>

<template>
    <component v-if="currentViewComponent" :is="currentViewComponent" @message="sendMessageToGame($event)" ref="mv" />
</template>