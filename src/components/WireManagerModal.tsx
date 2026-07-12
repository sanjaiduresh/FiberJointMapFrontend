import { useState } from 'react';
import type { Wire, CreateWirePayload } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Cable, Plus, Trash2, Loader2, AlertCircle, Pencil, Check, X } from 'lucide-react';

// Preset colors for quick selection
const PRESET_COLORS = [
  { color: '#3b82f6', label: 'Blue' },
  { color: '#ef4444', label: 'Red' },
  { color: '#22c55e', label: 'Green' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#a855f7', label: 'Purple' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#f97316', label: 'Orange' },
  { color: '#14b8a6', label: 'Teal' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#64748b', label: 'Slate' },
  { color: '#84cc16', label: 'Lime' },
];

interface WireManagerModalProps {
  wires: Wire[];
  onCreateWire: (payload: CreateWirePayload) => Promise<Wire>;
  onUpdateWire: (id: string, payload: Partial<CreateWirePayload>) => Promise<Wire>;
  onDeleteWire: (id: string) => Promise<void>;
  onClose: () => void;
}

export default function WireManagerModal({
  wires, onCreateWire, onUpdateWire, onDeleteWire, onClose,
}: WireManagerModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Wire name is required'); return; }
    setCreating(true);
    setError('');
    try {
      await onCreateWire({ name: name.trim(), color });
      setName('');
      setColor('#3b82f6');
    } catch (err: any) {
      setError(err.message || 'Failed to create wire');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await onUpdateWire(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update wire');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this wire? Connections using it will no longer have a wire assigned.')) return;
    setDeletingId(id);
    try {
      await onDeleteWire(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete wire');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Cable className="size-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle>Manage Wires</DialogTitle>
              <DialogDescription>Create and manage different wire types with colors</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Create new wire form */}
        <form onSubmit={handleCreate} className="grid gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
          <Label className="text-emerald-800 font-medium text-xs uppercase tracking-wider">Create New Wire</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Wire name (e.g. Fiber Trunk A)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              type="submit"
              disabled={creating || !name.trim()}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-9 px-3"
            >
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              <span className="ml-1">Add</span>
            </Button>
          </div>

          {/* Color picker */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-emerald-700">Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setColor(preset.color)}
                  className="size-7 rounded-lg border-2 transition-all hover:scale-110 flex items-center justify-center"
                  style={{
                    backgroundColor: preset.color,
                    borderColor: color === preset.color ? '#1e293b' : 'transparent',
                    boxShadow: color === preset.color ? '0 0 0 2px white, 0 0 0 4px #1e293b' : 'none',
                  }}
                  title={preset.label}
                >
                  {color === preset.color && <Check className="size-3.5 text-white" />}
                </button>
              ))}
              {/* Custom color input */}
              <div className="relative">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-7 rounded-lg cursor-pointer border-2 border-gray-200 hover:border-gray-400 transition-colors"
                  title="Custom color"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Wire list */}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Existing Wires ({wires.length})
          </Label>
          {wires.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No wires created yet. Add your first wire above.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {wires.map((wire) => (
                <div
                  key={wire.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group"
                >
                  {editingId === wire.id ? (
                    // Edit mode
                    <>
                      <div
                        className="size-4 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                        style={{ backgroundColor: editColor }}
                      />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {PRESET_COLORS.slice(0, 6).map((preset) => (
                          <button
                            key={preset.color}
                            type="button"
                            onClick={() => setEditColor(preset.color)}
                            className="size-4 rounded-full border transition-all hover:scale-125"
                            style={{
                              backgroundColor: preset.color,
                              borderColor: editColor === preset.color ? '#1e293b' : 'transparent',
                            }}
                          />
                        ))}
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="size-4 rounded cursor-pointer"
                        />
                      </div>
                      <Button
                        variant="ghost" size="icon-xs"
                        onClick={() => handleUpdate(wire.id)}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 h-6 w-6"
                      >
                        {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon-xs"
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground hover:text-foreground h-6 w-6"
                      >
                        <X className="size-3" />
                      </Button>
                    </>
                  ) : (
                    // View mode
                    <>
                      <div
                        className="size-4 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                        style={{ backgroundColor: wire.color }}
                      />
                      <span className="text-sm font-medium text-foreground flex-1 truncate">{wire.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {wire.color}
                      </span>
                      <Button
                        variant="ghost" size="icon-xs"
                        onClick={() => {
                          setEditingId(wire.id);
                          setEditName(wire.name);
                          setEditColor(wire.color);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-600 h-6 w-6 transition-opacity"
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon-xs"
                        onClick={() => handleDelete(wire.id)}
                        disabled={deletingId === wire.id}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive h-6 w-6 transition-opacity"
                      >
                        {deletingId === wire.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="pt-1">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
