import { useState, useEffect } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { createTerminal } from "../hooks/useSocket";

interface Favorite {
  name: string;
  cwd: string;
}

const FAVORITES_KEY = "smartterm-favorites";

function loadFavorites(): Favorite[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFavorites(favs: Favorite[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

export default function NewTerminalModal() {
  const open = useTerminalStore((s) => s.newModalOpen);
  const setOpen = useTerminalStore((s) => s.setNewModalOpen);

  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (open) setFavorites(loadFavorites());
  }, [open]);

  if (!open) return null;

  const handleCreate = (overrideName?: string, overrideCwd?: string) => {
    createTerminal({
      name: (overrideName || name).trim() || undefined,
      cwd: (overrideCwd || cwd).trim() || undefined,
    });
    setName("");
    setCwd("");
    setOpen(false);
  };

  const handleSaveFavorite = () => {
    if (!name.trim() || !cwd.trim()) return;
    const updated = [...favorites, { name: name.trim(), cwd: cwd.trim() }];
    saveFavorites(updated);
    setFavorites(updated);
    setShowSave(false);
  };

  const handleRemoveFavorite = (idx: number) => {
    const updated = favorites.filter((_, i) => i !== idx);
    saveFavorites(updated);
    setFavorites(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-sm p-5">
        <h2 className="text-terminal-accent font-medium text-sm mb-4">New Terminal</h2>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider text-terminal-dim mb-2">Favorites</div>
            <div className="space-y-1">
              {favorites.map((fav, i) => (
                <div key={i} className="flex items-center gap-1">
                  <button
                    onClick={() => handleCreate(fav.name, fav.cwd)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left bg-terminal-border/30 hover:bg-terminal-accent/10 hover:text-terminal-accent transition-colors"
                  >
                    <span className="text-terminal-accent font-medium">{fav.name}</span>
                    <span className="text-terminal-dim truncate text-[10px]">{fav.cwd}</span>
                  </button>
                  <button
                    onClick={() => handleRemoveFavorite(i)}
                    className="w-6 h-6 flex items-center justify-center text-terminal-dim hover:text-terminal-red rounded shrink-0"
                    title="Remove"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="3" y1="3" x2="9" y2="9" />
                      <line x1="9" y1="3" x2="3" y2="9" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-terminal-dim mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. backend, frontend, tests"
              className="input-field text-xs"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div>
            <label className="block text-[11px] text-terminal-dim mb-1">Working Directory</label>
            <input
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="e.g. C:/Users/you/projects/myapp"
              className="input-field text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div>
            {name.trim() && cwd.trim() && (
              showSave ? (
                <button onClick={handleSaveFavorite} className="text-[11px] text-terminal-accent hover:underline">
                  Confirm save
                </button>
              ) : (
                <button onClick={() => setShowSave(true)} className="text-[11px] text-terminal-dim hover:text-terminal-accent">
                  Save as favorite
                </button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost text-xs py-1">
              Cancel
            </button>
            <button onClick={() => handleCreate()} className="btn-primary text-xs py-1">
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
