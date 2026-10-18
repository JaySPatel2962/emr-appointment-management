// Makes import.meta.env reject any variable that isn't declared in ImportMetaEnv below.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  /** Base URL of the REST API, including /api/v1. */
  readonly VITE_API_URL?: string;
  /** Origin of the Socket.IO server. Defaults to the origin of VITE_API_URL. */
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
