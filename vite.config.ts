import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
// import { analyzer } from 'vite-bundle-analyzer'
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    build: {
        target: "esnext",
        chunkSizeWarningLimit: 1024,
    },
    plugins: [
        vue(),
        // analyzer(),
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
