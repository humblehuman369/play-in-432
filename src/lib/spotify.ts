/**
 * Spotify Web API — PKCE auth + playlist / liked-songs metadata.
 * Used only for titles; matching happens against local library.
 * Set VITE_SPOTIFY_CLIENT_ID in .env (see .env.example).
 */
import { APP_URL_SCHEME, isNativeApp } from "./native";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

/** Synthetic id — Liked Songs is not a normal playlist in Spotify's API. */
export const SPOTIFY_LIKED_SONGS_ID = "__liked_songs__";

const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  /** Required to read Liked Songs via /me/tracks */
  "user-library-read",
].join(" ");

const LS_VERIFIER = "playin432_spotify_pkce_verifier";
const LS_STATE = "playin432_spotify_oauth_state";
const LS_TOKENS = "playin432_spotify_tokens";
/** Redirect URI used for the in-flight auth (must match token exchange). */
const LS_REDIRECT = "playin432_spotify_oauth_redirect";

export type SpotifyTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
  token_type: string;
  /** Space-separated scopes granted at token time (if Spotify returned them). */
  scope?: string;
};

export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  trackCount: number;
  imageUrl: string | null;
  owner: string;
  /** True for the special Liked Songs library list */
  isLikedSongs?: boolean;
};

export type SpotifyPlaylistTrack = {
  title: string;
  artist: string;
  durationMs: number | null;
  spotifyUri: string | null;
};

export function getSpotifyClientId(): string | null {
  const id = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
  return id?.trim() || null;
}

/**
 * Spotify requires HTTPS except for loopback IPs.
 * `localhost` is NOT allowed — use 127.0.0.1 (or [::1]).
 *
 * Web: site origin root with trailing slash.
 * Native: HTTPS bridge on playin432.com (custom schemes often fail Spotify
 * Dashboard matching even when entered). Bridge pages:
 *   /spotify-start.html → Spotify → /spotify-callback.html → playin432://oauth
 *
 * Dashboard must list every URI character-for-character.
 * @see https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
 */
export const SPOTIFY_NATIVE_REDIRECT_URI =
  "https://playin432.com/spotify-callback.html";

export const SPOTIFY_NATIVE_START_URL =
  "https://playin432.com/spotify-start.html";

export function getSpotifyRedirectUri(): string {
  const override = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as
    | string
    | undefined;
  if (override?.trim()) return override.trim();

  // Native uses HTTPS bridge pages (not playin432://…) so Spotify always
  // sees a registered https redirect_uri.
  if (isNativeApp()) {
    return SPOTIFY_NATIVE_REDIRECT_URI;
  }

  const { protocol, hostname, port } = window.location;
  // Production brand domain — always apex HTTPS so Dashboard needs only one URI
  // (avoids www vs non-www and path mismatches).
  if (
    hostname === "playin432.com" ||
    hostname === "www.playin432.com"
  ) {
    return "https://playin432.com/";
  }

  // Map localhost → 127.0.0.1 so OAuth matches Spotify's allowlist
  const host =
    hostname === "localhost" || hostname === "[::1]"
      ? "127.0.0.1"
      : hostname;
  const portPart = port ? `:${port}` : "";
  // Origin root only — trailing slash is intentional and must match Dashboard
  return `${protocol}//${host}${portPart}/`;
}

/** URIs to paste into Spotify Dashboard for this product. */
export function getSpotifyDashboardRedirectHints(): string[] {
  return [
    "https://playin432.com/",
    "https://playin432.com/spotify-callback.html",
    "https://www.playin432.com/",
    "http://127.0.0.1:5173/",
  ];
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

export function loadSpotifyTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(LS_TOKENS);
    if (!raw) return null;
    const t = JSON.parse(raw) as SpotifyTokens;
    if (!t.access_token || !t.expires_at) return null;
    return t;
  } catch {
    return null;
  }
}

function saveSpotifyTokens(t: SpotifyTokens) {
  localStorage.setItem(LS_TOKENS, JSON.stringify(t));
}

export function clearSpotifyTokens() {
  localStorage.removeItem(LS_TOKENS);
  localStorage.removeItem(LS_VERIFIER);
  localStorage.removeItem(LS_STATE);
  localStorage.removeItem(LS_REDIRECT);
}

export function isSpotifyConnected(): boolean {
  const t = loadSpotifyTokens();
  return Boolean(t?.access_token);
}

/**
 * Start PKCE authorization.
 * Always requests library scope and forces the consent screen so reconnect
 * actually upgrades old tokens (Spotify otherwise reuses the prior grant).
 */
export async function beginSpotifyLogin(opts?: {
  /** Force Spotify to show the permission dialog (default true). */
  forceConsent?: boolean;
}): Promise<void> {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    throw new Error(
      "Missing VITE_SPOTIFY_CLIENT_ID. Add it to .env (see .env.example).",
    );
  }

  const forceConsent = opts?.forceConsent !== false;

  // Native: HTTPS bridge on playin432.com (PKCE in Safari sessionStorage),
  // then deep-link tokens back via playin432://oauth#…
  if (isNativeApp()) {
    const { openExternalUrl } = await import("./native");
    const start = new URL(SPOTIFY_NATIVE_START_URL);
    start.searchParams.set("client_id", clientId);
    start.searchParams.set("return", `${APP_URL_SCHEME}://oauth`);
    if (forceConsent) start.searchParams.set("show_dialog", "true");
    // Cache-bust so Safari does not reuse a stale start page without library scope
    start.searchParams.set("v", "2");
    await openExternalUrl(start.toString());
    return;
  }

  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = base64UrlEncode(await sha256(verifier));

  const redirectUri = getSpotifyRedirectUri();
  localStorage.setItem(LS_VERIFIER, verifier);
  localStorage.setItem(LS_STATE, state);
  localStorage.setItem(LS_REDIRECT, redirectUri);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  if (forceConsent) params.set("show_dialog", "true");

  window.location.assign(`${AUTH_URL}?${params.toString()}`);
}

/**
 * Native bridge return: playin432://oauth#access_token=…&refresh_token=…
 * (tokens already exchanged on https://playin432.com/spotify-callback.html)
 */
export function completeSpotifyLoginFromDeepLink(
  href: string = window.location.href,
): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    try {
      url = new URL(href.replace(/^([^:]+):\/\//, "https://"));
    } catch {
      return false;
    }
  }

  const isOauthHost =
    url.protocol === `${APP_URL_SCHEME}:` &&
    (url.hostname === "oauth" ||
      url.pathname === "/oauth" ||
      url.pathname.endsWith("oauth") ||
      // playin432://oauth → hostname oauth
      url.host === "oauth");

  const hashRaw = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const fromHash = new URLSearchParams(hashRaw);
  const fromSearch = url.searchParams;
  const access =
    fromHash.get("access_token") || fromSearch.get("access_token");
  if (!access) {
    // Also accept hash-only on any playin432 deep link
    if (!hashRaw.includes("access_token")) return false;
  }
  if (!access && !isOauthHost) return false;
  const token = access || fromHash.get("access_token");
  if (!token) return false;

  const expiresIn = Number(
    fromHash.get("expires_in") || fromSearch.get("expires_in") || "3600",
  );
  const refresh =
    fromHash.get("refresh_token") ||
    fromSearch.get("refresh_token") ||
    undefined;
  const tokenType =
    fromHash.get("token_type") ||
    fromSearch.get("token_type") ||
    "Bearer";
  const scope =
    fromHash.get("scope") || fromSearch.get("scope") || undefined;

  saveSpotifyTokens({
    access_token: token,
    refresh_token: refresh,
    expires_at: Date.now() + (Math.max(60, expiresIn) - 60) * 1000,
    token_type: tokenType,
    scope: scope || undefined,
  });

  try {
    const clean = new URL(window.location.href);
    clean.searchParams.delete("access_token");
    clean.hash = "";
    if (clean.pathname.includes("oauth")) clean.pathname = "/app";
    window.history.replaceState({}, "", clean.pathname + clean.search);
  } catch {
    /* ignore */
  }
  return true;
}

async function exchangeToken(
  body: Record<string, string>,
): Promise<SpotifyTokens> {
  const clientId = getSpotifyClientId();
  if (!clientId) throw new Error("Missing VITE_SPOTIFY_CLIENT_ID");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, client_id: clientId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Spotify token error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };

  const prev = loadSpotifyTokens();
  const tokens: SpotifyTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? prev?.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
    token_type: data.token_type || "Bearer",
    scope: data.scope ?? prev?.scope,
  };
  saveSpotifyTokens(tokens);
  return tokens;
}

/** True if the stored token includes user-library-read (Liked Songs). */
export function hasSpotifyLibraryScope(): boolean {
  const t = loadSpotifyTokens();
  const scope = t?.scope || "";
  return scope.split(/\s+/).includes("user-library-read");
}

/** Handle ?code= redirect; returns true if tokens were obtained. */
export async function completeSpotifyLoginFromUrl(
  href: string = window.location.href,
): Promise<boolean> {
  const url = new URL(href, window.location.origin);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    // Clean URL
    try {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("error");
      clean.searchParams.delete("state");
      clean.searchParams.delete("code");
      window.history.replaceState({}, "", clean.pathname + clean.search);
    } catch {
      /* ignore */
    }
    throw new Error(`Spotify auth denied: ${error}`);
  }

  if (!code) return false;

  const expected = localStorage.getItem(LS_STATE);
  if (!state || !expected || state !== expected) {
    throw new Error("Spotify OAuth state mismatch. Try connecting again.");
  }

  const verifier = localStorage.getItem(LS_VERIFIER);
  if (!verifier) {
    throw new Error("Missing PKCE verifier. Try connecting again.");
  }

  const redirectUri =
    localStorage.getItem(LS_REDIRECT) || getSpotifyRedirectUri();

  await exchangeToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  localStorage.removeItem(LS_VERIFIER);
  localStorage.removeItem(LS_STATE);
  localStorage.removeItem(LS_REDIRECT);

  try {
    const clean = new URL(window.location.href);
    clean.searchParams.delete("code");
    clean.searchParams.delete("state");
    clean.searchParams.delete("error");
    window.history.replaceState({}, "", clean.pathname + clean.search);
  } catch {
    /* ignore */
  }
  return true;
}

async function refreshIfNeeded(): Promise<string> {
  let t = loadSpotifyTokens();
  if (!t) throw new Error("Not connected to Spotify");

  if (Date.now() < t.expires_at) return t.access_token;

  if (!t.refresh_token) {
    clearSpotifyTokens();
    throw new Error("Spotify session expired. Connect again.");
  }

  t = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: t.refresh_token,
  });
  return t.access_token;
}

/** Normalize next-page URLs from Spotify into path+query for spotifyFetch. */
function toApiPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (next.startsWith("http")) {
    try {
      const u = new URL(next);
      return u.pathname.replace(/^\/v1/, "") + u.search;
    } catch {
      return next.replace(API, "").replace(/^https?:\/\/api\.spotify\.com\/v1/, "");
    }
  }
  return next.startsWith("/") ? next : `/${next}`;
}

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = await refreshIfNeeded();
  const apiPath = path.startsWith("http") ? toApiPath(path)! : path;
  const res = await fetch(`${API}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (res.status === 401) {
    clearSpotifyTokens();
    throw new Error("Spotify session expired. Connect again.");
  }
  if (res.status === 403) {
    const errText = await res.text();
    throw new Error(
      `Spotify permission denied (403). Disconnect and reconnect, approve all checkboxes including library access. ${errText.slice(0, 120)}`,
    );
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Spotify API ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

type SpotifyPaging<T> = {
  items: T[];
  next: string | null;
  total: number;
};

type SpotifyPlaylistItem = {
  id: string;
  name: string;
  tracks: { total: number };
  images?: { url: string }[];
  owner?: { display_name?: string };
};

type SpotifyTrackItem = {
  track: {
    name?: string;
    uri?: string;
    duration_ms?: number;
    artists?: { name: string }[];
  } | null;
};

type SpotifySavedTrackItem = {
  track: {
    name?: string;
    uri?: string;
    duration_ms?: number;
    artists?: { name: string }[];
  } | null;
};

function trackFromSpotifyObj(
  t: {
    name?: string;
    uri?: string;
    duration_ms?: number;
    artists?: { name: string }[];
  } | null | undefined,
): SpotifyPlaylistTrack | null {
  if (!t?.name) return null;
  const artists = t.artists ?? [];
  return {
    title: t.name,
    artist: artists.map((a) => a.name).join(", "),
    durationMs: t.duration_ms ?? null,
    spotifyUri: t.uri ?? null,
  };
}

/** Liked Songs (saved tracks) — different endpoint from playlists. */
export async function fetchLikedTracks(): Promise<SpotifyPlaylistTrack[]> {
  const out: SpotifyPlaylistTrack[] = [];
  let path: string | null = "/me/tracks?limit=50&market=from_token";
  let pages = 0;
  const maxPages = 40; // safety cap (~2000 titles)

  while (path && pages < maxPages) {
    pages++;
    const page = await spotifyFetch<SpotifyPaging<SpotifySavedTrackItem>>(path);
    for (const item of page.items || []) {
      const row = trackFromSpotifyObj(item.track);
      if (row) out.push(row);
    }
    path = toApiPath(page.next);
  }

  return out;
}

async function fetchLikedSongsCount(): Promise<number> {
  try {
    const page = await spotifyFetch<
      SpotifyPaging<SpotifySavedTrackItem> & { total?: number }
    >("/me/tracks?limit=1&market=from_token");
    return typeof page.total === "number" ? page.total : page.items?.length ?? 0;
  } catch (e) {
    console.warn(
      "[Spotify] Liked Songs count failed (reconnect for user-library-read?)",
      e,
    );
    return -1;
  }
}

export async function fetchUserPlaylists(): Promise<SpotifyPlaylistSummary[]> {
  const out: SpotifyPlaylistSummary[] = [];

  const likedCount = await fetchLikedSongsCount();
  out.push({
    id: SPOTIFY_LIKED_SONGS_ID,
    name: "Liked Songs",
    trackCount: likedCount,
    imageUrl: null,
    owner: "You",
    isLikedSongs: true,
  });

  let path: string | null = "/me/playlists?limit=50";
  while (path) {
    const page = await spotifyFetch<SpotifyPaging<SpotifyPlaylistItem>>(path);
    for (const p of page.items || []) {
      if (/^liked songs$/i.test(p.name) && out.some((x) => x.isLikedSongs)) {
        continue;
      }
      const total =
        typeof p.tracks?.total === "number"
          ? p.tracks.total
          : // Some responses omit tracks.total — still list the playlist
            0;
      out.push({
        id: p.id,
        name: p.name,
        trackCount: total,
        imageUrl: p.images?.[0]?.url ?? null,
        owner: p.owner?.display_name ?? "",
      });
    }
    path = toApiPath(page.next);
  }

  return out;
}

export async function fetchPlaylistTracks(
  playlistId: string,
): Promise<SpotifyPlaylistTrack[]> {
  if (
    playlistId === SPOTIFY_LIKED_SONGS_ID ||
    playlistId === "liked" ||
    playlistId === "liked-songs"
  ) {
    return fetchLikedTracks();
  }

  const out: SpotifyPlaylistTrack[] = [];
  // Do not use fields=… filters — they have broken track payloads for some users.
  // market=from_token + additional_types helps return playable metadata.
  let path: string | null =
    `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&market=from_token&additional_types=track`;
  let pages = 0;
  const maxPages = 40;

  while (path && pages < maxPages) {
    pages++;
    const page = await spotifyFetch<SpotifyPaging<SpotifyTrackItem>>(path);
    for (const item of page.items || []) {
      const row = trackFromSpotifyObj(item.track);
      if (row) out.push(row);
    }
    path = toApiPath(page.next);
  }

  return out;
}

/**
 * Quick connectivity probe after login — surfaces scope / token problems.
 */
export async function probeSpotifyAccess(): Promise<{
  ok: boolean;
  displayName?: string;
  likedCount: number;
  playlistCount: number;
  scopes: string;
  error?: string;
}> {
  try {
    const me = await spotifyFetch<{ display_name?: string; id?: string }>("/me");
    const playlists = await fetchUserPlaylists();
    const liked = playlists.find((p) => p.isLikedSongs);
    return {
      ok: true,
      displayName: me.display_name || me.id,
      likedCount: liked?.trackCount ?? -1,
      playlistCount: playlists.filter((p) => !p.isLikedSongs).length,
      scopes: loadSpotifyTokens()?.scope || "(scope not stored — reconnect)",
    };
  } catch (e) {
    return {
      ok: false,
      likedCount: -1,
      playlistCount: 0,
      scopes: loadSpotifyTokens()?.scope || "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function spotifyTracksToQueries(
  tracks: SpotifyPlaylistTrack[],
): import("./trackMatch").MatchQuery[] {
  return tracks.map((t) => ({
    title: t.title,
    artist: t.artist,
    duration: t.durationMs != null ? t.durationMs / 1000 : null,
    location: null,
  }));
}
