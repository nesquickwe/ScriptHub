import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.DISCORD_BOT_TOKEN': JSON.stringify(process.env.DISCORD_BOT_TOKEN)
  },
  resolve: {
    alias: {
      'zlib': 'browserify-zlib',
    }
  },
  optimizeDeps: {
    exclude: ['discord.js']
  }
});
