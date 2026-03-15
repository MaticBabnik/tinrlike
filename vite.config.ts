import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    build: {
        target: "esnext",
    },
    plugins: [
        vue(),
        visualizer({
            emitFile: true,
            filename: "stats.html",
        }),
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
});
