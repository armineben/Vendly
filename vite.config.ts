import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite"; // Il est ici !
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ 
      // C'est ici que la magie de la génération opère
    }), 
    viteReact(),
  ],
});