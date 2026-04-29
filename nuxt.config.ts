// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",

  // SPA mode: pages are rendered in the browser; Nitro still serves server/api routes.
  ssr: false,

  runtimeConfig: {
    // Server-only secrets — set via NUXT_OPENAI_API_KEY etc. at runtime.
    openaiApiKey: "",
    openaiProjectId: "",
    mcpServerUrl: "https://mcp.hipeac.net/",
    hipeacApiUrl: "https://www.hipeac.net/api/v3/",

    // Public (client-visible) — override via NUXT_PUBLIC_HIPEAC_BASE_URL.
    public: {
      hipeacBaseUrl: "https://www.hipeac.net",
    },
  },

  app: {
    head: {
      title: "Ask HiPEAC",
      meta: [
        { charset: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          name: "description",
          content: "Ask questions about HiPEAC Vision documents, events, and the research network.",
        },
      ],
    },
  },
});
