/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASHO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
