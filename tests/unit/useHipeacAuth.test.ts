// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { buildHipeacTokenUrl, useHipeacAuth } from "../../composables/useHipeacAuth";

declare global {
  // Nuxt auto-imported helper mocked for unit tests.
  // eslint-disable-next-line no-var
  var useRuntimeConfig: () => { public: { hipeacBaseUrl: string } };
  // Nuxt/Vue auto-import mocked for unit tests.
  // eslint-disable-next-line no-var
  var ref: typeof ref;
}

describe("useHipeacAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { hipeacBaseUrl: "https://www.hipeac.net" },
    }));
    vi.stubGlobal("ref", ref);
    window.history.replaceState({}, "", "/");
  });

  it("loads token from URL and stores it", () => {
    window.history.replaceState({}, "", "/?token=url-token");
    const auth = useHipeacAuth();

    auth.init();

    expect(auth.token.value).toBe("url-token");
    expect(localStorage.getItem("hipeac_token")).toBe("url-token");
    expect(window.location.search).toBe("");
    expect(auth.isReady.value).toBe(true);
  });

  it("loads token from localStorage when URL has no token", () => {
    localStorage.setItem("hipeac_token", "stored-token");
    const auth = useHipeacAuth();

    auth.init();

    expect(auth.token.value).toBe("stored-token");
    expect(auth.isReady.value).toBe(true);
  });

  it("clears token on logout", () => {
    localStorage.setItem("hipeac_token", "stored-token");
    const auth = useHipeacAuth();
    auth.init();

    auth.logout();

    expect(auth.token.value).toBeNull();
    expect(localStorage.getItem("hipeac_token")).toBeNull();
  });

  it("builds login URL with encoded next origin", () => {
    const url = buildHipeacTokenUrl("https://www.hipeac.net", "http://localhost:3000");

    expect(url).toBe("https://www.hipeac.net/api/auth/token/?next=http%3A%2F%2Flocalhost%3A3000");
  });
});
