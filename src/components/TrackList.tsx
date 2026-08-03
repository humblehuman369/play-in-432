import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Playlist, TrackMeta } from "../lib/types";
import { formatBytes, formatTime } from "../lib/retune";

type Props = {
  tracks: TrackMeta[];
  activeId: string | null;
  playing: boolean;
  playlists: Playlist[];
  /** When set, shows remove-from-playlist instead of only library delete */
  playlistId?: string;
  emptyMessage?: string;
  onPlay: (trackId: string) => void;
  onToggleFavorite: (trackId: string) => void;
  onDelete: (trackId: string) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onReorder?: (from: number, to: number) => void;
  onRename?: (trackId: string, name: string) => void;
};

export function TrackList({
  tracks,
  activeId,
  playing,
  playlists,
  playlistId,
  emptyMessage = "No tracks yet.",
  onPlay,
  onToggleFavorite,
  onDelete,
  onRemoveFromPlaylist,
  onAddToPlaylist,
  onReorder,
  onRename,
}: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuId) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuId]);

  if (!tracks.length) {
    return <p className="empty">{emptyMessage}</p>;
  }

  return (
    <ul className="track-list">
      <li className="track-list-head">
        <span className="col-num">#</span>
        <span className="col-title">Title</span>
        <span className="col-dur">Time</span>
        <span className="col-actions" />
      </li>
      {tracks.map((t, i) => {
        const isActive = t.id === activeId;
        const isPlayingHere = isActive && playing;
        return (
          <li
            key={t.id}
            className={`track-row ${isActive ? "active" : ""} ${
              dragIndex === i ? "dragging" : ""
            }`}
            draggable={Boolean(onReorder)}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => {
              if (onReorder) e.preventDefault();
            }}
            onDrop={() => {
              if (onReorder && dragIndex != null && dragIndex !== i) {
                onReorder(dragIndex, i);
              }
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            {onReorder && (
              <span className="reorder-controls">
                <span
                  className="drag-handle"
                  title="Drag to reorder"
                  aria-hidden
                >
                  <GripVertical size={14} />
                </span>
                <button
                  type="button"
                  className="reorder-btn"
                  onClick={() => onReorder(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move ${t.name} up`}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  className="reorder-btn"
                  onClick={() => onReorder(i, i + 1)}
                  disabled={i === tracks.length - 1}
                  aria-label={`Move ${t.name} down`}
                >
                  <ChevronDown size={14} />
                </button>
              </span>
            )}
            <button
              type="button"
              className={`col-num play-num ${isActive ? "is-active" : ""}`}
              onClick={() => onPlay(t.id)}
              aria-label={isPlayingHere ? "Playing" : `Play ${t.name}`}
            >
              {isPlayingHere ? (
                <Pause size={14} />
              ) : (
                <>
                  <span className="num">{i + 1}</span>
                  <Play size={14} className="hover-play" />
                </>
              )}
            </button>

            <div className="col-title">
              {editingId === t.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename?.(t.id, editName.trim() || t.name);
                    setEditingId(null);
                  }}
                >
                  <input
                    className="inline-edit"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                      onRename?.(t.id, editName.trim() || t.name);
                      setEditingId(null);
                    }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="title-btn"
                  onClick={() => onPlay(t.id)}
                  onDoubleClick={() => {
                    if (onRename) {
                      setEditingId(t.id);
                      setEditName(t.name);
                    }
                  }}
                >
                  <span className="tname">{t.name}</span>
                  <span className="tsub">
                    {t.artist ? `${t.artist} · ` : ""}
                    {t.duration != null
                      ? formatTime(t.duration)
                      : formatBytes(t.size)}
                    {t.playCount > 0 ? ` · ${t.playCount} plays` : ""}
                  </span>
                </button>
              )}
            </div>

            <span className="col-dur">
              {t.duration != null ? formatTime(t.duration) : "—"}
            </span>

            <div className="col-actions">
              <button
                type="button"
                className={`icon-btn ghost sm ${t.favorite ? "fav-on" : ""}`}
                onClick={() => onToggleFavorite(t.id)}
                aria-label={t.favorite ? "Unfavorite" : "Favorite"}
                title={t.favorite ? "Unfavorite" : "Favorite"}
              >
                <Heart size={15} fill={t.favorite ? "currentColor" : "none"} />
              </button>

              <div className="menu-wrap" ref={menuId === t.id ? menuRef : null}>
                <button
                  type="button"
                  className="icon-btn ghost sm"
                  onClick={() => setMenuId(menuId === t.id ? null : t.id)}
                  aria-label="More"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuId === t.id && (
                  <div className="menu-pop">
                    {playlists.length > 0 && (
                      <div className="menu-section">
                        <div className="menu-label">
                          <ListPlus size={12} /> Add to playlist
                        </div>
                        {playlists.map((pl) => (
                          <button
                            key={pl.id}
                            type="button"
                            className="menu-item"
                            disabled={pl.trackIds.includes(t.id)}
                            onClick={() => {
                              onAddToPlaylist(pl.id, t.id);
                              setMenuId(null);
                            }}
                          >
                            {pl.name}
                            {pl.trackIds.includes(t.id) ? " ✓" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                    {onRename && (
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setEditingId(t.id);
                          setEditName(t.name);
                          setMenuId(null);
                        }}
                      >
                        Rename
                      </button>
                    )}
                    {playlistId && onRemoveFromPlaylist && (
                      <button
                        type="button"
                        className="menu-item danger"
                        onClick={() => {
                          onRemoveFromPlaylist(t.id);
                          setMenuId(null);
                        }}
                      >
                        Remove from playlist
                      </button>
                    )}
                    <button
                      type="button"
                      className="menu-item danger"
                      onClick={() => {
                        onDelete(t.id);
                        setMenuId(null);
                      }}
                    >
                      <Trash2 size={14} /> Delete from library
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
