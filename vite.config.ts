
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace 'YOUR_REPOSITORY_NAME' with the actual name of your GitHub repo.
  // For example, if your repo is 'https://github.com/username/graph-maker', use '/graph-maker/'
  base: '/YOUR_REPOSITORY_NAME/', 
});
