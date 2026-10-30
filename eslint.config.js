import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['dist/**', '.test-dist/**', 'src-tauri/target/**', 'zips/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files:['tests/**/*.cjs','scripts/**/*.cjs'],languageOptions:{globals:globals.node},rules:{'@typescript-eslint/no-require-imports':'off','@typescript-eslint/no-unused-vars':'off'} },
  { files: ['src/**/*.{ts,tsx}', 'vite.config.ts'], languageOptions: { globals: { ...globals.browser, ...globals.node } }, plugins: { 'react-hooks': reactHooks }, rules: { ...reactHooks.configs.recommended.rules } },
);
