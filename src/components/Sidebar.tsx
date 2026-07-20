import {
  Heart,
  Library,
  ListMusic,
  Plus,
  Waves,
} from "lucide-react";
import type { Playlist, View } from "../lib/types";

type Props = {
  view: View;
  playlists: Playlist[];
  trackCount: number;
  favoriteCount: number;
  onNavigate: (view: View) => void;
  onCreatePlaylist: () => void;
};

export function Sidebar({
  view,
  playlists,
  trackCount,
  favoriteCount,
  onNavigate,
  onCreatePlaylist,
}: Props) {
  const isLibrary = view.kind === "library";
  const isFavorites = view.kind === "favorites";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark sm">
          <Waves size={18} strokeWidth={2.25} />
        </div>
        <div>
          <div className="sidebar-title">Play In 432</div>
          <div className="sidebar-sub">TrueHz technology</div>
        </div>
      </div>

      <nav className="nav-block">
        <button
          type="button"
          className={`nav-item ${isLibrary ? "active" : ""}`}
          onClick={() => onNavigate({ kind: "library" })}
        >
          <Library size={18} />
          <span>Library</span>
          <span className="nav-count">{trackCount}</span>
        </button>
        <button
          type="button"
          className={`nav-item ${isFavorites ? "active" : ""}`}
          onClick={() => onNavigate({ kind: "favorites" })}
        >
          <Heart size={18} />
          <span>Favorites</span>
          <span className="nav-count">{favoriteCount}</span>
        </button>
      </nav>

      <div className="nav-section-head">
        <span>Playlists</span>
        <button
          type="button"
          className="icon-btn ghost sm"
          onClick={onCreatePlaylist}
          aria-label="Create playlist"
          title="New playlist"
        >
          <Plus size={16} />
        </button>
      </div>

      <nav className="nav-block playlists-nav">
        {playlists.length === 0 ? (
          <p className="nav-empty">No playlists yet</p>
        ) : (
          playlists.map((pl) => {
            const active =
              view.kind === "playlist" && view.playlistId === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() =>
                  onNavigate({ kind: "playlist", playlistId: pl.id })
                }
              >
                <ListMusic size={18} />
                <span className="nav-label">{pl.name}</span>
                <span className="nav-count">{pl.trackIds.length}</span>
              </button>
            );
          })
        )}
      </nav>
    </aside>
  );
}
