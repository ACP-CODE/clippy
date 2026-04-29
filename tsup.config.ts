import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  outDir: 'dist',
  target: 'node18',
  platform: 'node',
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  shims: false,
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.mjs',
  }),
});
