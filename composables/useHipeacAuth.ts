/**
 * Manages HiPEAC authentication for the standalone ask app.
 *
 * Flow:
 * 1. User visits ask.hipeac.net with no token → call login() to redirect to hipeac.net.
 * 2. hipeac.net authenticates the user and redirects back with ?token=<key>.
 * 3. init() reads the token from the URL, stores it in localStorage, and cleans the URL.
 * 4. Subsequent visits read the token from localStorage directly.
 */

const TOKEN_KEY = "hipeac_token";

export function useHipeacAuth() {
  const token = ref<string | null>(null);
  const isReady = ref(false);

  /**
   * Initialise auth state. Must be called once from onMounted (client-only).
   * Reads the token from the URL (on redirect from hipeac.net) or from localStorage.
   */
  function init(): void {
    const url = new URL(window.location.href);
    const urlToken = url.searchParams.get("token");

    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
      token.value = urlToken;
    } else {
      token.value = localStorage.getItem(TOKEN_KEY);
    }

    isReady.value = true;
  }

  /** Redirect the user to the HiPEAC login flow. */
  function login(): void {
    const { public: pub } = useRuntimeConfig();
    const tokenUrl = `${pub.hipeacBaseUrl}/api/auth/token/`;
    const next = encodeURIComponent(window.location.origin);
    window.location.href = `${tokenUrl}?next=${next}`;
  }

  /** Clear the stored token and mark the user as unauthenticated. */
  function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    token.value = null;
  }

  return { token, isReady, init, login, logout };
}
