import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(projectDir, 'public');
const outDirRelative = '../dist';
const outDir = resolve(projectDir, 'dist');
const dataDir = resolve(projectDir, 'data');

export default defineConfig(() => {
  const base = process.env.GITHUB_PAGES_BASE ?? '/';

  return {
    root: rootDir,
    base,
    publicDir: false,
    build: {
      outDir: outDirRelative,
      emptyOutDir: true,
    },
    plugins: [
      {
        name: 'copy-daily-data',
        closeBundle() {
          if (!existsSync(dataDir)) {
            return;
          }

          const targetDir = resolve(outDir, 'data');
          rmSync(targetDir, { recursive: true, force: true });
          mkdirSync(targetDir, { recursive: true });
          cpSync(dataDir, targetDir, { recursive: true });
        },
      },
    ],
  };
});
