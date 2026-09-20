import { useState, useRef, useCallback } from 'react';
import type { CreateJointPayload, JointType, FiberJoint } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Upload, Download, FileSpreadsheet, AlertCircle, Check, X,
  Loader2, ChevronDown, Trash2, Eye, EyeOff,
} from 'lucide-react';

// ── Icon options (matching MapView.tsx) ──
const ICON_OPTIONS = [
  'default', 'star', 'home', 'building', 'box', 'pole', 'manhole', 'cabinet', 'tower', 'router',
];

const JOINT_TYPES: JointType[] = ['Base', 'Main', 'Sub', 'Splice'];
const CABLE_TYPES = ['Single Mode', 'Multi Mode'];

// ── CSV Sample ──
const SAMPLE_CSV_HEADER = 'label,latitude,longitude,jointType,cableType,fiberCount,notes,icon';
const SAMPLE_CSV_ROWS = [
  'Main Hub Office,8.336639,77.869861,Base,Single Mode,48,Central office hub,building',
  'Pole Junction A,8.338100,77.871200,Main,Single Mode,24,Street pole junction,pole',
  'Customer Splice Box,8.339500,77.870300,Sub,Multi Mode,12,Near apartment complex,box',
  'Manhole Splice Point,8.337200,77.868900,Splice,Single Mode,12,,manhole',
];

function generateSampleCSV(): string {
  return [SAMPLE_CSV_HEADER, ...SAMPLE_CSV_ROWS].join('\n');
}

// ── CSV Parser ──
interface ParsedRow {
  label: string;
  latitude: number;
  longitude: number;
  jointType: JointType;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  notes: string;
  icon: string;
  errors: string[];
  rowIndex: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));

  // Map column indices
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => { colMap[h] = i; });

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.every(c => !c)) continue; // skip empty rows

    const errors: string[] = [];

    const label = cells[colMap['label'] ?? -1] || '';
    const latStr = cells[colMap['latitude'] ?? colMap['lat'] ?? -1] || '';
    const lngStr = cells[colMap['longitude'] ?? colMap['lng'] ?? colMap['long'] ?? -1] || '';
    const jointTypeRaw = cells[colMap['jointtype'] ?? colMap['type'] ?? -1] || 'Main';
    const cableTypeRaw = cells[colMap['cabletype'] ?? -1] || 'Single Mode';
    const fiberCountStr = cells[colMap['fibercount'] ?? colMap['fibers'] ?? -1] || '12';
    const notes = cells[colMap['notes'] ?? -1] || '';
    const icon = cells[colMap['icon'] ?? -1] || 'default';

    // Validate
    if (!label) errors.push('Missing label');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || lat < -90 || lat > 90) errors.push('Invalid latitude');
    if (isNaN(lng) || lng < -180 || lng > 180) errors.push('Invalid longitude');

    const jointType = JOINT_TYPES.find(t => t.toLowerCase() === jointTypeRaw.toLowerCase()) || 'Main';
    if (!JOINT_TYPES.find(t => t.toLowerCase() === jointTypeRaw.toLowerCase()) && jointTypeRaw) {
      errors.push(`Unknown joint type: ${jointTypeRaw}`);
    }

    const cableType: 'Single Mode' | 'Multi Mode' = CABLE_TYPES.includes(cableTypeRaw) ? cableTypeRaw as any : 'Single Mode';
    const fiberCount = parseInt(fiberCountStr) || 12;
    if (fiberCount < 1 || fiberCount > 1000) errors.push('Fiber count out of range');

    const validIcon = ICON_OPTIONS.includes(icon.toLowerCase()) ? icon.toLowerCase() : 'default';

    rows.push({
      label, latitude: lat, longitude: lng,
      jointType, cableType, fiberCount,
      notes, icon: validIcon,
      errors, rowIndex: i,
    });
  }
  return rows;
}

// ── Component ──

interface BulkImportModalProps {
  onClose: () => void;
  onImport: (payload: CreateJointPayload) => Promise<FiberJoint>;
}

export default function BulkImportModal({ onClose, onImport }: BulkImportModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [showErrors, setShowErrors] = useState(true);
  const [expandedPreview, setExpandedPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = parsedRows.filter(r => r.errors.length === 0);
  const invalidRows = parsedRows.filter(r => r.errors.length > 0);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a .csv file');
      return;
    }
    setFileName(file.name);
    setImportResults(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDownloadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'joints_import_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRemoveRow = (rowIndex: number) => {
    setParsedRows(prev => prev.filter(r => r.rowIndex !== rowIndex));
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await onImport({
          label: row.label,
          lat: row.latitude,
          lng: row.longitude,
          jointType: row.jointType,
          cableType: row.cableType,
          fiberCount: row.fiberCount,
          notes: row.notes,
          icon: row.icon,
        });
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row ${row.rowIndex}: ${row.label} — ${err.message || 'Failed'}`);
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
      // Small delay to avoid overwhelming the server
      if (i < validRows.length - 1) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    setImportResults(results);
    setImporting(false);

    // Clear successfully imported rows from preview
    if (results.success > 0) {
      setParsedRows(prev => prev.filter(r => r.errors.length > 0));
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setFileName(null);
    setImportResults(null);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !importing) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="size-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Import Joints from CSV</DialogTitle>
              <DialogDescription>Bulk-add joints to the map from a spreadsheet file</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Download Sample */}
        <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Need a template?</p>
            <p className="text-[11px] text-blue-600/80 mt-0.5">
              Download a sample CSV with the correct column format
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={handleDownloadSample}
            className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 gap-1.5 shrink-0"
          >
            <Download className="size-3.5" />
            Sample CSV
          </Button>
        </div>

        {/* Column reference */}
        <details className="group">
          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5 select-none">
            <ChevronDown className="size-3 group-open:rotate-180 transition-transform" />
            Column reference
          </summary>
          <div className="mt-2 p-2.5 rounded-lg border border-border bg-muted/50 text-[10px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
            <span><strong className="text-foreground">label</strong> — Joint name (required)</span>
            <span><strong className="text-foreground">latitude</strong> — Decimal lat (required)</span>
            <span><strong className="text-foreground">longitude</strong> — Decimal lng (required)</span>
            <span><strong className="text-foreground">jointType</strong> — Base/Main/Sub/Splice</span>
            <span><strong className="text-foreground">cableType</strong> — Single Mode/Multi Mode</span>
            <span><strong className="text-foreground">fiberCount</strong> — Number of fibers</span>
            <span><strong className="text-foreground">notes</strong> — Free text notes</span>
            <span><strong className="text-foreground">icon</strong> — {ICON_OPTIONS.join(', ')}</span>
          </div>
        </details>

        {/* File Upload */}
        {parsedRows.length === 0 && !importResults && (
          <div
            className={cn(
              'relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group',
              dragOver
                ? 'border-blue-400 bg-blue-50/80 scale-[1.01]'
                : 'border-border hover:border-blue-300 hover:bg-blue-50/30',
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                'size-14 rounded-2xl flex items-center justify-center transition-colors',
                dragOver ? 'bg-blue-200 text-blue-700' : 'bg-muted text-muted-foreground group-hover:bg-blue-100 group-hover:text-blue-600',
              )}>
                <Upload className="size-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {dragOver ? 'Drop your CSV file here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .csv files
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && !importResults && (
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                  <FileSpreadsheet className="size-3" />
                  {fileName}
                </Badge>
                <Badge className="text-[10px] h-5 bg-green-100 text-green-700 border border-green-200">
                  {validRows.length} valid
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge className="text-[10px] h-5 bg-red-100 text-red-700 border border-red-200">
                    {invalidRows.length} errors
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon-xs" className="h-6 w-6" title="Toggle preview" onClick={() => setExpandedPreview(v => !v)}>
                  {expandedPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
                <Button variant="ghost" size="icon-xs" className="h-6 w-6 text-destructive hover:text-destructive" title="Clear file" onClick={handleReset}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Error rows */}
            {invalidRows.length > 0 && showErrors && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-red-700 flex items-center gap-1.5">
                    <AlertCircle className="size-3.5" />
                    {invalidRows.length} row{invalidRows.length > 1 ? 's' : ''} with errors (will be skipped)
                  </p>
                  <Button variant="ghost" size="icon-xs" className="h-5 w-5 text-red-500" onClick={() => setShowErrors(false)}>
                    <X className="size-3" />
                  </Button>
                </div>
                {invalidRows.slice(0, 5).map(r => (
                  <p key={r.rowIndex} className="text-[10px] text-red-600">
                    Row {r.rowIndex}: <strong>{r.label || '(no label)'}</strong> — {r.errors.join(', ')}
                  </p>
                ))}
                {invalidRows.length > 5 && (
                  <p className="text-[10px] text-red-500 italic">...and {invalidRows.length - 5} more</p>
                )}
              </div>
            )}

            {/* Preview table */}
            {expandedPreview && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/70 sticky top-0">
                      <tr>
                        <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">#</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Label</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Lat</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Lng</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Type</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Icon</th>
                        <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Fibers</th>
                        <th className="px-2.5 py-2 text-center font-semibold text-muted-foreground">Status</th>
                        <th className="px-2.5 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.map((row) => {
                        const hasError = row.errors.length > 0;
                        return (
                          <tr key={row.rowIndex} className={cn('hover:bg-muted/30', hasError && 'bg-red-50/50')}>
                            <td className="px-2.5 py-1.5 text-muted-foreground font-mono">{row.rowIndex}</td>
                            <td className="px-2.5 py-1.5 font-medium text-foreground max-w-[120px] truncate">{row.label || '—'}</td>
                            <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{isNaN(row.latitude) ? '—' : row.latitude.toFixed(4)}</td>
                            <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{isNaN(row.longitude) ? '—' : row.longitude.toFixed(4)}</td>
                            <td className="px-2.5 py-1.5">
                              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-md border font-medium',
                                row.jointType === 'Base' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                row.jointType === 'Main' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                row.jointType === 'Sub' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                'bg-purple-100 text-purple-700 border-purple-200',
                              )}>{row.jointType}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-muted-foreground capitalize">{row.icon}</td>
                            <td className="px-2.5 py-1.5 text-muted-foreground">{row.fiberCount}</td>
                            <td className="px-2.5 py-1.5 text-center">
                              {hasError
                                ? <span className="text-red-500" title={row.errors.join(', ')}><AlertCircle className="size-3.5 inline" /></span>
                                : <span className="text-green-500"><Check className="size-3.5 inline" /></span>
                              }
                            </td>
                            <td className="px-2.5 py-1.5">
                              <button
                                onClick={() => handleRemoveRow(row.rowIndex)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title="Remove row"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import button + progress */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={handleReset}
                disabled={importing}
                className="gap-1.5"
              >
                <X className="size-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {importing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Importing... {importProgress}%
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    Import {validRows.length} Joint{validRows.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>

            {/* Progress bar */}
            {importing && (
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {importResults && (
          <div className="space-y-3">
            <div className={cn(
              'p-4 rounded-xl border text-center',
              importResults.failed === 0
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50',
            )}>
              <div className={cn(
                'size-12 rounded-2xl mx-auto flex items-center justify-center mb-3',
                importResults.failed === 0 ? 'bg-green-200' : 'bg-amber-200',
              )}>
                {importResults.failed === 0
                  ? <Check className="size-6 text-green-700" />
                  : <AlertCircle className="size-6 text-amber-700" />
                }
              </div>
              <p className="text-sm font-semibold text-foreground">Import Complete</p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong className="text-green-700">{importResults.success}</strong> joint{importResults.success !== 1 ? 's' : ''} added successfully
                {importResults.failed > 0 && (
                  <>, <strong className="text-red-600">{importResults.failed}</strong> failed</>
                )}
              </p>
            </div>

            {importResults.errors.length > 0 && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 space-y-1">
                <p className="text-[11px] font-medium text-red-700">Failed rows:</p>
                {importResults.errors.map((e, i) => (
                  <p key={i} className="text-[10px] text-red-600">{e}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleReset}>
                Import More
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
