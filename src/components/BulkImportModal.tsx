import { useState, useRef, useCallback } from 'react';
import type { CreateJointPayload, JointType, FiberJoint, CreateSegmentPayload, Segment, Wire, CreateWirePayload } from '../types';
import {
  parseKMLOrKMZFile,
  type ParsedKMLJoint,
  type ParsedKMLCable,
  type DetectedKMLWire,
  type ExistingWireInfo,
  type KMLParseResult,
  WIRE_PALETTE,
} from '../utils/kmlParser';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Upload, FileSpreadsheet, AlertCircle, Check, X,
  Loader2, Trash2, Eye, EyeOff, Globe, Cable, MapPin,
  Layers, Wand2, Settings2, RotateCcw, Plus,
} from 'lucide-react';

// ── Icon options (matching MapView.tsx) ──
const ICON_OPTIONS = [
  'default', 'star', 'home', 'building', 'box', 'pole', 'manhole', 'cabinet', 'tower', 'router',
];

const JOINT_TYPES: JointType[] = ['Base', 'Main', 'Sub', 'Splice'];
const CABLE_TYPES = ['Single Mode', 'Multi Mode'];
const FIBER_COUNT_PRESETS = [6, 12, 24, 48, 96, 144, 288];

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

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => { colMap[h] = i; });

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.every(c => !c)) continue;

    const errors: string[] = [];
    const label = cells[colMap['label'] ?? -1] || '';
    const latStr = cells[colMap['latitude'] ?? colMap['lat'] ?? -1] || '';
    const lngStr = cells[colMap['longitude'] ?? colMap['lng'] ?? colMap['long'] ?? -1] || '';
    const jointTypeRaw = cells[colMap['jointtype'] ?? colMap['type'] ?? -1] || 'Main';
    const cableTypeRaw = cells[colMap['cabletype'] ?? -1] || 'Single Mode';
    const fiberCountStr = cells[colMap['fibercount'] ?? colMap['fibers'] ?? -1] || '12';
    const notes = cells[colMap['notes'] ?? -1] || '';
    const icon = cells[colMap['icon'] ?? -1] || 'default';

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

// ── Name Matching Rules ──
export interface NameRule {
  id: string;
  pattern: string;
  matchType: 'startsWith' | 'endsWith' | 'contains' | 'lengthEquals' | 'lengthMin' | 'lengthMax' | 'regex';
  requiredLength?: number | null;
  jointType: JointType;
  icon: string;
  enabled: boolean;
}

export const DEFAULT_NAME_RULES: NameRule[] = [
  { id: 'r-b1', pattern: 'B', matchType: 'startsWith', jointType: 'Base', icon: 'building', enabled: true },
  { id: 'r-b2', pattern: 'BS', matchType: 'startsWith', jointType: 'Base', icon: 'building', enabled: true },
  { id: 'r-b3', pattern: 'BASE', matchType: 'contains', jointType: 'Base', icon: 'building', enabled: true },
  { id: 'r-m1', pattern: 'M', matchType: 'startsWith', jointType: 'Main', icon: 'circle-dot', enabled: true },
  { id: 'r-m2', pattern: 'MAIN', matchType: 'contains', jointType: 'Main', icon: 'circle-dot', enabled: true },
  { id: 'r-s1', pattern: 'S', matchType: 'startsWith', jointType: 'Sub', icon: 'circle', enabled: true },
  { id: 'r-s2', pattern: 'SUB', matchType: 'contains', jointType: 'Sub', icon: 'circle', enabled: true },
  { id: 'r-sp1', pattern: 'SP', matchType: 'startsWith', jointType: 'Splice', icon: 'scissors', enabled: true },
  { id: 'r-sp2', pattern: 'SPL', matchType: 'startsWith', jointType: 'Splice', icon: 'scissors', enabled: true },
  { id: 'r-sp3', pattern: 'SPLICE', matchType: 'contains', jointType: 'Splice', icon: 'scissors', enabled: true },
];

function applyRulesToLabel(label: string, rules: NameRule[]): { jointType: JointType; icon: string } | null {
  const trimmed = label.trim();
  const upper = trimmed.toUpperCase();
  const len = trimmed.length;

  for (const r of rules) {
    if (!r.enabled) continue;

    // Optional required length constraint
    if (r.requiredLength != null && r.requiredLength > 0) {
      if (len !== r.requiredLength) continue;
    }

    const patUpper = (r.pattern || '').trim().toUpperCase();
    let matches = false;

    switch (r.matchType) {
      case 'startsWith':
        matches = patUpper.length > 0 ? upper.startsWith(patUpper) : true;
        break;
      case 'endsWith':
        matches = patUpper.length > 0 ? upper.endsWith(patUpper) : true;
        break;
      case 'contains':
        matches = patUpper.length > 0 ? upper.includes(patUpper) : true;
        break;
      case 'lengthEquals': {
        const targetLen = parseInt(r.pattern.trim()) || r.requiredLength || 0;
        matches = targetLen > 0 && len === targetLen;
        break;
      }
      case 'lengthMin': {
        const minLen = parseInt(r.pattern.trim()) || r.requiredLength || 0;
        matches = minLen > 0 && len >= minLen;
        break;
      }
      case 'lengthMax': {
        const maxLen = parseInt(r.pattern.trim()) || r.requiredLength || 0;
        matches = maxLen > 0 && len <= maxLen;
        break;
      }
      case 'regex': {
        try {
          if (r.pattern.trim()) {
            const rx = new RegExp(r.pattern.trim(), 'i');
            matches = rx.test(trimmed);
          }
        } catch {
          matches = false;
        }
        break;
      }
    }

    if (matches) {
      return { jointType: r.jointType, icon: r.icon };
    }
  }
  return null;
}

// ── Component ──

type ImportMode = 'csv' | 'kml';
type PreviewTab = 'joints' | 'cables';

interface BulkImportModalProps {
  onClose: () => void;
  onImport: (payload: CreateJointPayload) => Promise<FiberJoint>;
  onImportBulk?: (payloads: CreateJointPayload[]) => Promise<FiberJoint[]>;
  onImportSegment?: (payload: CreateSegmentPayload) => Promise<Segment>;
  onImportSegmentBulk?: (payloads: CreateSegmentPayload[]) => Promise<Segment[]>;
  existingJoints?: FiberJoint[];
  wires?: Wire[];
  onCreateWire?: (payload: CreateWirePayload) => Promise<Wire>;
}

export default function BulkImportModal({
  onClose,
  onImport,
  onImportBulk,
  onImportSegment,
  onImportSegmentBulk,
  existingJoints = [],
  wires = [],
  onCreateWire,
}: BulkImportModalProps) {
  // CSV state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // KML state
  const [kmlJoints, setKmlJoints] = useState<ParsedKMLJoint[]>([]);
  const [kmlCables, setKmlCables] = useState<ParsedKMLCable[]>([]);
  const [detectedWires, setDetectedWires] = useState<DetectedKMLWire[]>([]);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('joints');

  // KML bulk defaults
  const [defaultCableType, setDefaultCableType] = useState<'Single Mode' | 'Multi Mode'>('Single Mode');
  const [defaultFiberCount, setDefaultFiberCount] = useState(12);
  const [bulkWireOption, setBulkWireOption] = useState<string>('auto');

  // Wire editing state
  const [colorPickerWireId, setColorPickerWireId] = useState<string | null>(null);

  // Name Matching Rules State
  const [nameRules, setNameRules] = useState<NameRule[]>(DEFAULT_NAME_RULES);
  const [rulesConfigOpen, setRulesConfigOpen] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleMatchType, setNewRuleMatchType] = useState<'startsWith' | 'endsWith' | 'contains' | 'lengthEquals' | 'lengthMin' | 'lengthMax' | 'regex'>('startsWith');
  const [newRuleRequiredLength, setNewRuleRequiredLength] = useState<string>('');
  const [newRuleJointType, setNewRuleJointType] = useState<JointType>('Base');
  const [newRuleIcon, setNewRuleIcon] = useState('building');

  // Shared state
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    cablesSuccess: number;
    cablesFailed: number;
    wiresCreated: number;
    errors: string[];
  } | null>(null);
  const [showErrors, setShowErrors] = useState(true);
  const [expandedPreview, setExpandedPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV computed
  const validRows = parsedRows.filter(r => r.errors.length === 0);
  const invalidRows = parsedRows.filter(r => r.errors.length > 0);

  // KML computed
  const validKmlJoints = kmlJoints.filter(j => j.errors.length === 0);
  const invalidKmlJoints = kmlJoints.filter(j => j.errors.length > 0);
  const validKmlCables = kmlCables.filter(c => c.errors.length === 0);
  const invalidKmlCables = kmlCables.filter(c => c.errors.length > 0);

  const hasContent = importMode === 'csv' ? parsedRows.length > 0 : (kmlJoints.length > 0 || kmlCables.length > 0);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    setFileName(file.name);
    setImportResults(null);

    if (ext === 'csv') {
      setImportMode('csv');
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        const processed = rows.map(r => {
          const match = applyRulesToLabel(r.label, nameRules);
          if (match) {
            return { ...r, jointType: match.jointType, icon: match.icon };
          }
          return r;
        });
        setParsedRows(processed);
      };
      reader.readAsText(file);
    } else if (ext === 'kml' || ext === 'kmz') {
      setImportMode('kml');
      try {
        const existingForParser = existingJoints.map(j => ({
          id: j.id,
          label: j.label,
          lat: j.lat,
          lng: j.lng,
        }));
        const existingWiresForParser: ExistingWireInfo[] = wires.map(w => ({
          id: w.id,
          name: w.name,
          color: w.color,
        }));
        const result: KMLParseResult = await parseKMLOrKMZFile(file, existingForParser, existingWiresForParser);
        const processedJoints = result.joints.map(j => {
          const match = applyRulesToLabel(j.label, nameRules);
          if (match) {
            return { ...j, jointType: match.jointType, icon: match.icon };
          }
          return j;
        });
        setKmlJoints(processedJoints);
        setKmlCables(result.cables);
        setDetectedWires(result.detectedWires);
        // Auto-switch to cables tab if there are cables but no joints
        if (result.joints.length === 0 && result.cables.length > 0) {
          setPreviewTab('cables');
        } else {
          setPreviewTab('joints');
        }
      } catch (err: any) {
        alert(`Failed to parse KML file: ${err.message}`);
      }
    } else {
      alert('Please upload a .csv, .kml, or .kmz file');
    }
  }, [existingJoints, wires, nameRules]);

  // Name Matching Rules Handlers
  const handleReapplyRules = (rulesToUse = nameRules) => {
    setParsedRows(prev => prev.map(r => {
      const match = applyRulesToLabel(r.label, rulesToUse);
      if (match) {
        return { ...r, jointType: match.jointType, icon: match.icon };
      }
      return r;
    }));
    setKmlJoints(prev => prev.map(j => {
      const match = applyRulesToLabel(j.label, rulesToUse);
      if (match) {
        return { ...j, jointType: match.jointType, icon: match.icon };
      }
      return j;
    }));
  };

  const handleAddRule = () => {
    if (!newRulePattern.trim() && !['lengthEquals', 'lengthMin', 'lengthMax'].includes(newRuleMatchType)) return;
    const reqLen = parseInt(newRuleRequiredLength.trim()) || undefined;
    const newRule: NameRule = {
      id: `rule-${Date.now()}`,
      pattern: newRulePattern.trim(),
      matchType: newRuleMatchType,
      requiredLength: reqLen,
      jointType: newRuleJointType,
      icon: newRuleIcon,
      enabled: true,
    };
    const updated = [newRule, ...nameRules];
    setNameRules(updated);
    setNewRulePattern('');
    setNewRuleRequiredLength('');
    handleReapplyRules(updated);
  };

  const handleToggleRule = (id: string) => {
    const updated = nameRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setNameRules(updated);
    handleReapplyRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = nameRules.filter(r => r.id !== id);
    setNameRules(updated);
    handleReapplyRules(updated);
  };

  const handleUpdateRowJointType = (rowIndex: number, newType: JointType) => {
    setParsedRows(prev => prev.map(r => r.rowIndex === rowIndex ? { ...r, jointType: newType } : r));
  };

  const handleUpdateRowIcon = (rowIndex: number, newIcon: string) => {
    setParsedRows(prev => prev.map(r => r.rowIndex === rowIndex ? { ...r, icon: newIcon } : r));
  };

  const handleUpdateKmlJointType = (id: string, newType: JointType) => {
    setKmlJoints(prev => prev.map(j => j.id === id ? { ...j, jointType: newType } : j));
  };

  const handleUpdateKmlIcon = (id: string, newIcon: string) => {
    setKmlJoints(prev => prev.map(j => j.id === id ? { ...j, icon: newIcon } : j));
  };

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

  const handleRemoveKmlJoint = (id: string) => {
    setKmlJoints(prev => prev.filter(j => j.id !== id));
    setKmlCables(prev => prev.filter(c => c.fromJointId !== id && c.toJointId !== id));
  };

  const handleRemoveKmlCable = (id: string) => {
    setKmlCables(prev => {
      const remaining = prev.filter(c => c.id !== id);
      // Recalculate wire cable counts
      setDetectedWires(dwList => dwList.map(dw => ({
        ...dw,
        cableCount: remaining.filter(c => c.wireName === dw.name).length,
      })).filter(dw => dw.cableCount > 0));
      return remaining;
    });
  };

  // ── Detected Wire Handlers ──
  const handleUpdateDetectedWireName = (tempId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const oldWire = detectedWires.find(w => w.tempId === tempId);
    if (!oldWire) return;
    const oldName = oldWire.name;

    // Check if newName matches an existing wire
    const matched = wires.find(w => w.name.toLowerCase() === trimmed.toLowerCase());

    setDetectedWires(prev => prev.map(dw => {
      if (dw.tempId !== tempId) return dw;
      return {
        ...dw,
        name: trimmed,
        matchedExistingWireId: matched?.id,
        isNew: !matched,
        color: matched ? matched.color : dw.color,
      };
    }));

    // Update cables associated with this wire
    setKmlCables(prev => prev.map(c => {
      if (c.wireName === oldName) {
        return {
          ...c,
          wireName: trimmed,
          wireId: matched?.id,
          wireColor: matched ? matched.color : c.wireColor,
        };
      }
      return c;
    }));
  };

  const handleUpdateDetectedWireColor = (tempId: string, newColor: string) => {
    setDetectedWires(prev => prev.map(dw => {
      if (dw.tempId !== tempId) return dw;
      return { ...dw, color: newColor };
    }));

    const wire = detectedWires.find(w => w.tempId === tempId);
    if (wire) {
      setKmlCables(prev => prev.map(c => {
        if (c.wireName === wire.name) {
          return { ...c, wireColor: newColor };
        }
        return c;
      }));
    }
    setColorPickerWireId(null);
  };

  const handleMapDetectedWireToExisting = (tempId: string, selectedValue: string) => {
    if (selectedValue === 'new') {
      setDetectedWires(prev => prev.map(dw => {
        if (dw.tempId !== tempId) return dw;
        return { ...dw, matchedExistingWireId: undefined, isNew: true };
      }));
      const dw = detectedWires.find(w => w.tempId === tempId);
      if (dw) {
        setKmlCables(prev => prev.map(c => {
          if (c.wireName === dw.name) {
            return { ...c, wireId: undefined };
          }
          return c;
        }));
      }
    } else {
      const existingWire = wires.find(w => w.id === selectedValue);
      if (!existingWire) return;

      const dw = detectedWires.find(w => w.tempId === tempId);
      const oldName = dw?.name;

      setDetectedWires(prev => prev.map(w => {
        if (w.tempId !== tempId) return w;
        return {
          ...w,
          matchedExistingWireId: existingWire.id,
          isNew: false,
          color: existingWire.color,
        };
      }));

      if (oldName) {
        setKmlCables(prev => prev.map(c => {
          if (c.wireName === oldName) {
            return {
              ...c,
              wireId: existingWire.id,
              wireColor: existingWire.color,
            };
          }
          return c;
        }));
      }
    }
  };

  // Reassign single cable's wire
  const handleAssignCableWire = (cableId: string, selection: string) => {
    if (selection === 'none') {
      setKmlCables(prev => prev.map(c => {
        if (c.id !== cableId) return c;
        return { ...c, wireId: undefined, wireName: undefined, wireColor: undefined };
      }));
      return;
    }

    if (selection.startsWith('detected:')) {
      const dwName = selection.replace('detected:', '');
      const dw = detectedWires.find(w => w.name === dwName);
      setKmlCables(prev => prev.map(c => {
        if (c.id !== cableId) return c;
        return {
          ...c,
          wireName: dwName,
          wireColor: dw?.color,
          wireId: dw?.matchedExistingWireId,
        };
      }));
    } else if (selection.startsWith('existing:')) {
      const wId = selection.replace('existing:', '');
      const ew = wires.find(w => w.id === wId);
      setKmlCables(prev => prev.map(c => {
        if (c.id !== cableId) return c;
        return {
          ...c,
          wireId: wId,
          wireName: ew?.name,
          wireColor: ew?.color,
        };
      }));
    }
  };

  // Apply bulk defaults to all KML cables
  const handleApplyBulkDefaults = () => {
    setKmlCables(prev => prev.map(c => {
      let wireUpdate: Partial<ParsedKMLCable> = {};

      if (bulkWireOption !== 'auto') {
        if (bulkWireOption.startsWith('detected:')) {
          const dwName = bulkWireOption.replace('detected:', '');
          const dw = detectedWires.find(w => w.name === dwName);
          wireUpdate = {
            wireName: dwName,
            wireColor: dw?.color,
            wireId: dw?.matchedExistingWireId,
          };
        } else if (bulkWireOption.startsWith('existing:')) {
          const wId = bulkWireOption.replace('existing:', '');
          const ew = wires.find(w => w.id === wId);
          wireUpdate = {
            wireId: wId,
            wireName: ew?.name,
            wireColor: ew?.color,
          };
        } else if (bulkWireOption === 'none') {
          wireUpdate = { wireId: undefined, wireName: undefined, wireColor: undefined };
        }
      }

      return {
        ...c,
        cableType: defaultCableType,
        fiberCount: defaultFiberCount,
        ...wireUpdate,
      };
    }));
  };

  // ── CSV Import ──
  const handleCSVImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportProgress(10);
    const results = { success: 0, failed: 0, cablesSuccess: 0, cablesFailed: 0, wiresCreated: 0, errors: [] as string[] };

    const payloads = validRows.map(row => ({
      label: row.label,
      lat: row.latitude,
      lng: row.longitude,
      jointType: row.jointType,
      cableType: row.cableType,
      fiberCount: row.fiberCount,
      notes: row.notes,
      icon: row.icon,
    }));

    if (onImportBulk) {
      try {
        const created = await onImportBulk(payloads);
        results.success = created.length;
        setImportProgress(100);
      } catch (err: any) {
        results.failed = validRows.length;
        results.errors.push(`Bulk Import Failed: ${err.message || 'Server error'}`);
      }
    } else {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          await onImport(payloads[i]);
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Row ${row.rowIndex}: ${row.label} — ${err.message || 'Failed'}`);
        }
        setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
      }
    }

    setImportResults(results);
    setImporting(false);

    if (results.success > 0) {
      setParsedRows(prev => prev.filter(r => r.errors.length > 0));
    }
  };

  // ── KML Import (wires first, then joints, then cables) ──
  const handleKMLImport = async () => {
    if (validKmlJoints.length === 0 && validKmlCables.length === 0) return;
    setImporting(true);
    setImportProgress(5);

    const results = { success: 0, failed: 0, cablesSuccess: 0, cablesFailed: 0, wiresCreated: 0, errors: [] as string[] };
    const idMap: Record<string, string> = {};

    // ── Stage 1: Auto-create any new wires detected from KML ──
    const wireNameToIdMap: Record<string, string> = {};

    // First map existing wires by name and ID
    wires.forEach(w => {
      wireNameToIdMap[w.name.toLowerCase()] = w.id;
      wireNameToIdMap[w.id] = w.id;
    });

    // Also map detected wires that were mapped to existing wires
    detectedWires.forEach(dw => {
      if (dw.matchedExistingWireId) {
        wireNameToIdMap[dw.name.toLowerCase()] = dw.matchedExistingWireId;
        wireNameToIdMap[dw.tempId] = dw.matchedExistingWireId;
      }
    });

    // Auto-create new wires if onCreateWire is available
    if (onCreateWire && validKmlCables.length > 0) {
      for (const dw of detectedWires) {
        if (dw.isNew && !dw.matchedExistingWireId) {
          // Check if any cable is using this wire
          const isUsed = validKmlCables.some(
            c => (c.wireName?.toLowerCase() === dw.name.toLowerCase()) ||
                 (c.wireId === dw.matchedExistingWireId)
          );
          if (isUsed && !wireNameToIdMap[dw.name.toLowerCase()]) {
            try {
              const createdWire = await onCreateWire({
                name: dw.name.trim(),
                color: dw.color,
              });
              wireNameToIdMap[dw.name.toLowerCase()] = createdWire.id;
              wireNameToIdMap[dw.tempId] = createdWire.id;
              results.wiresCreated++;
            } catch (err: any) {
              console.error(`Failed to auto-create wire ${dw.name}:`, err);
            }
          }
        }
      }
    }

    setImportProgress(20);

    // ── Stage 2: Import joints ──
    if (validKmlJoints.length > 0) {
      const jointPayloads = validKmlJoints.map(joint => ({
        label: joint.label,
        lat: joint.lat,
        lng: joint.lng,
        jointType: joint.jointType,
        cableType: joint.cableType,
        fiberCount: joint.fiberCount,
        notes: joint.notes,
        icon: joint.icon,
      }));

      if (onImportBulk) {
        try {
          const createdList = await onImportBulk(jointPayloads);
          createdList.forEach((created, idx) => {
            idMap[validKmlJoints[idx].id] = created.id;
          });
          results.success = createdList.length;
        } catch (err: any) {
          results.failed = validKmlJoints.length;
          results.errors.push(`Bulk Joints Failed: ${err.message || 'Server error'}`);
        }
      } else {
        for (const joint of validKmlJoints) {
          try {
            const created = await onImport({
              label: joint.label,
              lat: joint.lat,
              lng: joint.lng,
              jointType: joint.jointType,
              cableType: joint.cableType,
              fiberCount: joint.fiberCount,
              notes: joint.notes,
              icon: joint.icon,
            });
            idMap[joint.id] = created.id;
            results.success++;
          } catch (err: any) {
            results.failed++;
            results.errors.push(`Joint: ${joint.label} — ${err.message || 'Failed'}`);
          }
        }
      }
    }

    setImportProgress(60);

    // ── Stage 3: Import cable segments with resolved wireId ──
    if (validKmlCables.length > 0 && (onImportSegmentBulk || onImportSegment)) {
      const isValidObjectId = (id?: string) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

      const segmentPayloads: CreateSegmentPayload[] = [];
      let unresolvableCables = 0;

      for (const cable of validKmlCables) {
        const fromId = idMap[cable.fromJointId] || cable.fromJointId;
        const toId = idMap[cable.toJointId] || cable.toJointId;

        if (!isValidObjectId(fromId) || !isValidObjectId(toId)) {
          unresolvableCables++;
          results.errors.push(`Cable "${cable.label}": could not resolve valid joint IDs (${cable.fromJointId} -> ${cable.toJointId})`);
          continue;
        }

        // Resolve wireId from cable.wireId, wireNameToIdMap, or cable.wireName
        let resolvedWireId: string | undefined = undefined;
        if (cable.wireId && wireNameToIdMap[cable.wireId]) {
          resolvedWireId = wireNameToIdMap[cable.wireId];
        } else if (cable.wireId && wires.some(w => w.id === cable.wireId)) {
          resolvedWireId = cable.wireId;
        } else if (cable.wireName && wireNameToIdMap[cable.wireName.toLowerCase()]) {
          resolvedWireId = wireNameToIdMap[cable.wireName.toLowerCase()];
        }

        segmentPayloads.push({
          fromJointId: fromId,
          toJointId: toId,
          waypoints: cable.waypoints,
          cableType: cable.cableType,
          fiberCount: cable.fiberCount,
          lengthMeters: cable.lengthMeters,
          wireId: resolvedWireId,
        });
      }

      if (unresolvableCables > 0) {
        results.cablesFailed += unresolvableCables;
      }

      if (segmentPayloads.length > 0 && onImportSegmentBulk) {
        try {
          const createdSegments = await onImportSegmentBulk(segmentPayloads);
          results.cablesSuccess += createdSegments.length;
        } catch (err: any) {
          results.cablesFailed += segmentPayloads.length;
          results.errors.push(`Bulk Cables Failed: ${err.message || 'Server error'}`);
        }
      } else if (segmentPayloads.length > 0 && onImportSegment) {
        for (let i = 0; i < segmentPayloads.length; i++) {
          const payload = segmentPayloads[i];
          try {
            await onImportSegment(payload);
            results.cablesSuccess++;
          } catch (err: any) {
            results.cablesFailed++;
            results.errors.push(`Cable creation failed — ${err.message || 'Failed'}`);
          }
        }
      }
    }

    setImportProgress(100);
    setImportResults(results);
    setImporting(false);

    if (results.success > 0 || results.cablesSuccess > 0) {
      setKmlJoints(prev => prev.filter(j => j.errors.length > 0));
      setKmlCables(prev => prev.filter(c => c.errors.length > 0));
    }
  };

  const handleImport = () => {
    if (importMode === 'csv') {
      handleCSVImport();
    } else {
      handleKMLImport();
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setKmlJoints([]);
    setKmlCables([]);
    setDetectedWires([]);
    setFileName(null);
    setImportMode(null);
    setImportResults(null);
    setImportProgress(0);
    setPreviewTab('joints');
    setColorPickerWireId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const jointTypeColor = (type: JointType) => {
    switch (type) {
      case 'Base': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Main': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sub': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Splice': return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5 text-blue-600" />
            Bulk Import Network Data
          </DialogTitle>
          <DialogDescription>
            Import joints and fiber cable runs from CSV spreadsheets or Google Earth KML / KMZ files.
          </DialogDescription>
        </DialogHeader>

        {/* ══════════════════════════════════════════════════ */}
        {/* Upload Drop Zone */}
        {/* ══════════════════════════════════════════════════ */}
        {!hasContent && !importResults && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                dragOver
                  ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                  : 'border-border hover:border-blue-400 hover:bg-muted/30',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.kml,.kmz"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <div className="size-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
                <Upload className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Drop your CSV or KML/KMZ file here, or <span className="text-blue-600 underline">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports CSV (joints only) or Google Earth KML/KMZ (joints, cables, folders, wires & styles)
              </p>
            </div>

            {/* Supported formats explanation */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileSpreadsheet className="size-3.5 text-green-600" />
                    CSV Format
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-blue-600 hover:text-blue-700 px-2"
                    onClick={(e) => { e.stopPropagation(); handleDownloadSample(); }}
                  >
                    Sample CSV
                  </Button>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Requires columns: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">label, lat, lng</code>. Optional: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">jointType, cableType, fiberCount, notes, icon</code>
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-blue-600" />
                  Google Earth KML / KMZ
                </span>
                <p className="text-muted-foreground text-[11px]">
                  Points become <strong>Joints</strong>. Paths/LineStrings become <strong>Cable Connections</strong>. Folders and styles are automatically detected as <strong>Wires</strong>!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* CSV Preview */}
        {/* ══════════════════════════════════════════════════ */}
        {importMode === 'csv' && parsedRows.length > 0 && !importResults && (
          <div className="space-y-3">
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

            {/* ── Name Matching Rules Bar ── */}
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="size-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-950">
                    Name Matching & Auto-Classification Rules
                  </span>
                  <Badge variant="outline" className="text-[9px] bg-white border-amber-300 text-amber-800">
                    {nameRules.filter(r => r.enabled).length} active
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    className="h-6 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={() => handleReapplyRules(nameRules)}
                    title="Re-run rules on all joint labels"
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Re-Apply Rules
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 text-[10px] text-amber-900 hover:bg-amber-100"
                    onClick={() => setRulesConfigOpen(!rulesConfigOpen)}
                  >
                    <Settings2 className="size-3 mr-1" />
                    {rulesConfigOpen ? 'Hide Rules' : 'Configure Rules'}
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-amber-800">
                Auto-assigns Joint Type (Base, Main, Sub, Splice) and Icon based on label prefixes (e.g. <code>B-</code>, <code>M-</code>, <code>S-</code>, <code>SP-</code>).
              </p>

              {/* Expandable Rule Editor */}
              {rulesConfigOpen && (
                <div className="pt-2 border-t border-amber-200/60 space-y-3">
                  {/* Existing Rules List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {nameRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={cn(
                          'flex items-center justify-between gap-1.5 p-1.5 rounded-md border text-[10px] bg-white',
                          rule.enabled ? 'border-amber-300' : 'border-border opacity-60',
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => handleToggleRule(rule.id)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-mono font-semibold text-amber-900 bg-amber-100 px-1 py-0.5 rounded shrink-0">
                            {rule.matchType === 'startsWith' && `${rule.pattern}*`}
                            {rule.matchType === 'endsWith' && `*${rule.pattern}`}
                            {rule.matchType === 'contains' && `*${rule.pattern}*`}
                            {rule.matchType === 'lengthEquals' && `${rule.pattern || rule.requiredLength} letters`}
                            {rule.matchType === 'lengthMin' && `>=${rule.pattern || rule.requiredLength} letters`}
                            {rule.matchType === 'lengthMax' && `<=${rule.pattern || rule.requiredLength} letters`}
                            {rule.matchType === 'regex' && `/${rule.pattern}/`}
                            {rule.requiredLength && !['lengthEquals', 'lengthMin', 'lengthMax'].includes(rule.matchType) ? ` (${rule.requiredLength} letters)` : ''}
                          </span>
                          <span className={cn('px-1 py-0.5 rounded border text-[9px] font-medium shrink-0', jointTypeColor(rule.jointType))}>
                            {rule.jointType}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Rule Form */}
                  <div className="pt-2 border-t border-amber-200/60 bg-amber-100/40 p-2.5 rounded-xl space-y-2">
                    <span className="text-[11px] font-semibold text-amber-950 flex items-center gap-1">
                      <Plus className="size-3.5 text-amber-600" />
                      Add Custom Rule
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Condition</label>
                        <select
                          value={newRuleMatchType}
                          onChange={(e) => setNewRuleMatchType(e.target.value as any)}
                          className="text-[10px] h-7 w-full px-1.5 rounded-lg border border-amber-300 bg-white text-amber-950 font-medium"
                        >
                          <option value="startsWith">Starts with (Prefix)</option>
                          <option value="endsWith">Ends with (Suffix)</option>
                          <option value="contains">Contains text</option>
                          <option value="lengthEquals">Exact Length (=N)</option>
                          <option value="lengthMin">Length at least (&gt;=N)</option>
                          <option value="lengthMax">Length at most (&lt;=N)</option>
                          <option value="regex">Regex Match</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Prefix / Text</label>
                        <input
                          type="text"
                          placeholder={['lengthEquals', 'lengthMin', 'lengthMax'].includes(newRuleMatchType) ? 'e.g. 5' : 'e.g. B, M, SP'}
                          value={newRulePattern}
                          onChange={(e) => setNewRulePattern(e.target.value)}
                          className="text-[10px] h-7 w-full px-2 rounded-lg border border-amber-300 bg-white text-amber-950 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Letter Count N (Opt)</label>
                        <input
                          type="number"
                          placeholder="e.g. 5, 7, 10"
                          value={newRuleRequiredLength}
                          onChange={(e) => setNewRuleRequiredLength(e.target.value)}
                          disabled={['lengthEquals', 'lengthMin', 'lengthMax'].includes(newRuleMatchType)}
                          className="text-[10px] h-7 w-full px-2 rounded-lg border border-amber-300 bg-white text-amber-950 font-mono disabled:opacity-40"
                          title="Type how many total letters/characters the joint name must have (e.g. 5)"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Assign Joint Type</label>
                        <select
                          value={newRuleJointType}
                          onChange={(e) => setNewRuleJointType(e.target.value as JointType)}
                          className="text-[10px] h-7 w-full px-1.5 rounded-lg border border-amber-300 bg-white text-amber-950 font-medium"
                        >
                          {JOINT_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                        <div className="flex-1">
                          <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Assign Icon</label>
                          <select
                            value={newRuleIcon}
                            onChange={(e) => setNewRuleIcon(e.target.value)}
                            className="text-[10px] h-7 w-full px-1.5 rounded-lg border border-amber-300 bg-white text-amber-950 capitalize"
                          >
                            {ICON_OPTIONS.map(i => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          size="xs"
                          className="h-7 mt-3.5 bg-amber-600 hover:bg-amber-700 text-white gap-1 px-3 font-medium shrink-0"
                          onClick={handleAddRule}
                        >
                          <Plus className="size-3.5" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
              </div>
            )}

            {/* CSV preview table */}
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
                              <select
                                value={row.jointType}
                                onChange={(e) => handleUpdateRowJointType(row.rowIndex, e.target.value as JointType)}
                                className={cn('text-[10px] h-6 px-1 rounded border font-medium cursor-pointer', jointTypeColor(row.jointType))}
                              >
                                {JOINT_TYPES.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2.5 py-1.5">
                              <select
                                value={row.icon}
                                onChange={(e) => handleUpdateRowIcon(row.rowIndex, e.target.value)}
                                className="text-[10px] h-6 px-1 rounded border border-border bg-background capitalize cursor-pointer"
                              >
                                {ICON_OPTIONS.map(icon => (
                                  <option key={icon} value={icon}>{icon}</option>
                                ))}
                              </select>
                            </td>
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
              <Button variant="outline" size="sm" onClick={handleReset} disabled={importing} className="gap-1.5">
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

            {importing && (
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${importProgress}%` }} />
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* KML / KMZ Preview */}
        {/* ══════════════════════════════════════════════════ */}
        {importMode === 'kml' && (kmlJoints.length > 0 || kmlCables.length > 0) && !importResults && (
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                  <Globe className="size-3" />
                  {fileName}
                </Badge>
                <Badge className="text-[10px] h-5 bg-green-100 text-green-700 border border-green-200">
                  {validKmlJoints.length} joints
                </Badge>
                <Badge className="text-[10px] h-5 bg-sky-100 text-sky-700 border border-sky-200">
                  {validKmlCables.length} cables
                </Badge>
                {detectedWires.length > 0 && (
                  <Badge className="text-[10px] h-5 bg-purple-100 text-purple-700 border border-purple-200 gap-1">
                    <Layers className="size-2.5" />
                    {detectedWires.length} wire{detectedWires.length !== 1 ? 's' : ''} detected
                  </Badge>
                )}
                {(invalidKmlJoints.length + invalidKmlCables.length) > 0 && (
                  <Badge className="text-[10px] h-5 bg-red-100 text-red-700 border border-red-200">
                    {invalidKmlJoints.length + invalidKmlCables.length} errors
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

            {/* Tabs */}
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted/60">
              <button
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-md transition-all',
                  previewTab === 'joints'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setPreviewTab('joints')}
              >
                <MapPin className="size-3" />
                Joints ({kmlJoints.length})
              </button>
              <button
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-md transition-all',
                  previewTab === 'cables'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setPreviewTab('cables')}
              >
                <Cable className="size-3" />
                Cables & Wires ({kmlCables.length})
              </button>
            </div>

            {/* Error summary */}
            {(invalidKmlJoints.length > 0 || invalidKmlCables.length > 0) && showErrors && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-red-700 flex items-center gap-1.5">
                    <AlertCircle className="size-3.5" />
                    {invalidKmlJoints.length + invalidKmlCables.length} item{(invalidKmlJoints.length + invalidKmlCables.length) > 1 ? 's' : ''} with errors (will be skipped)
                  </p>
                  <Button variant="ghost" size="icon-xs" className="h-5 w-5 text-red-500" onClick={() => setShowErrors(false)}>
                    <X className="size-3" />
                  </Button>
                </div>
                {[...invalidKmlJoints.slice(0, 2).map(j => ({ label: j.label, errors: j.errors, type: 'Joint' })),
                  ...invalidKmlCables.slice(0, 2).map(c => ({ label: c.label, errors: c.errors, type: 'Cable' })),
                ].map((item, i) => (
                  <p key={i} className="text-[10px] text-red-600">
                    {item.type}: <strong>{item.label}</strong> — {item.errors.join(', ')}
                  </p>
                ))}
              </div>
            )}

            {/* Joints preview table */}
            {expandedPreview && previewTab === 'joints' && (
              <div className="space-y-3">
                {/* ── Name Matching Rules Bar ── */}
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wand2 className="size-4 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-950">
                        Name Matching & Auto-Classification Rules
                      </span>
                      <Badge variant="outline" className="text-[9px] bg-white border-amber-300 text-amber-800">
                        {nameRules.filter(r => r.enabled).length} active
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-6 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-100"
                        onClick={() => handleReapplyRules(nameRules)}
                        title="Re-run rules on all joint labels"
                      >
                        <RotateCcw className="size-3 mr-1" />
                        Re-Apply Rules
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 text-[10px] text-amber-900 hover:bg-amber-100"
                        onClick={() => setRulesConfigOpen(!rulesConfigOpen)}
                      >
                        <Settings2 className="size-3 mr-1" />
                        {rulesConfigOpen ? 'Hide Rules' : 'Configure Rules'}
                      </Button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-800">
                    Auto-assigns Joint Type (Base, Main, Sub, Splice) and Icon based on label prefixes (e.g. <code>B-</code>, <code>M-</code>, <code>S-</code>, <code>SP-</code>).
                  </p>

                  {/* Expandable Rule Editor */}
                  {rulesConfigOpen && (
                    <div className="pt-2 border-t border-amber-200/60 space-y-3">
                      {/* Existing Rules List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {nameRules.map((rule) => (
                          <div
                            key={rule.id}
                            className={cn(
                              'flex items-center justify-between gap-1.5 p-1.5 rounded-md border text-[10px] bg-white',
                              rule.enabled ? 'border-amber-300' : 'border-border opacity-60',
                            )}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={rule.enabled}
                                onChange={() => handleToggleRule(rule.id)}
                                className="rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span className="font-mono font-semibold text-amber-900 bg-amber-100 px-1 py-0.5 rounded shrink-0">
                                {rule.matchType === 'startsWith' ? `${rule.pattern}*` : rule.matchType === 'endsWith' ? `*${rule.pattern}` : `*${rule.pattern}*`}
                              </span>
                              <span className={cn('px-1 py-0.5 rounded border text-[9px] font-medium shrink-0', jointTypeColor(rule.jointType))}>
                                {rule.jointType}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                  {/* Add New Rule Form */}
                  <div className="pt-2 border-t border-amber-200/60 bg-amber-100/40 p-2.5 rounded-xl space-y-2">
                    <span className="text-[11px] font-semibold text-amber-950 flex items-center gap-1">
                      <Plus className="size-3.5 text-amber-600" />
                      Add Custom Rule
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Condition</label>
                        <select
                          value={newRuleMatchType}
                          onChange={(e) => setNewRuleMatchType(e.target.value as any)}
                          className="text-[10px] h-7 w-full px-1.5 rounded-lg border border-amber-300 bg-white text-amber-950 font-medium"
                        >
                          <option value="startsWith">Starts with (Prefix)</option>
                          <option value="endsWith">Ends with (Suffix)</option>
                          <option value="contains">Contains text</option>
                          <option value="lengthEquals">Exact Length (=N)</option>
                          <option value="lengthMin">Length at least (&gt;=N)</option>
                          <option value="lengthMax">Length at most (&lt;=N)</option>
                          <option value="regex">Regex Match</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Prefix / Text</label>
                        <input
                          type="text"
                          placeholder={['lengthEquals', 'lengthMin', 'lengthMax'].includes(newRuleMatchType) ? 'e.g. 5' : 'e.g. B, M, SP'}
                          value={newRulePattern}
                          onChange={(e) => setNewRulePattern(e.target.value)}
                          className="text-[10px] h-7 w-full px-2 rounded-lg border border-amber-300 bg-white text-amber-950 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Letter Count N (Opt)</label>
                        <input
                          type="number"
                          placeholder="e.g. 5, 7, 10"
                          value={newRuleRequiredLength}
                          onChange={(e) => setNewRuleRequiredLength(e.target.value)}
                          disabled={['lengthEquals', 'lengthMin', 'lengthMax'].includes(newRuleMatchType)}
                          className="text-[10px] h-7 w-full px-2 rounded-lg border border-amber-300 bg-white text-amber-950 font-mono disabled:opacity-40"
                          title="Type how many total letters/characters the joint name must have (e.g. 5)"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Assign Joint Type</label>
                        <select
                          value={newRuleJointType}
                          onChange={(e) => setNewRuleJointType(e.target.value as JointType)}
                          className="text-[10px] h-7 w-full px-1.5 rounded-lg border border-amber-300 bg-white text-amber-950 font-medium"
                        >
                          {JOINT_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                        <div className="flex-1">
                          <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Assign Icon</label>
                          <select
                            value={newRuleIcon}
                            onChange={(e) => setNewRuleIcon(e.target.value)}
                            className="text-[10px] h-7 w-full px-1.5 rounded-lg border border-amber-300 bg-white text-amber-950 capitalize"
                          >
                            {ICON_OPTIONS.map(i => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          size="xs"
                          className="h-7 mt-3.5 bg-amber-600 hover:bg-amber-700 text-white gap-1 px-3 font-medium shrink-0"
                          onClick={handleAddRule}
                        >
                          <Plus className="size-3.5" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                    </div>
                  )}
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  {kmlJoints.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs">
                      No point placemarks found in this KML file
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/70 sticky top-0">
                          <tr>
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
                          {kmlJoints.map((joint) => {
                            const hasError = joint.errors.length > 0;
                            return (
                              <tr key={joint.id} className={cn('hover:bg-muted/30', hasError && 'bg-red-50/50')}>
                                <td className="px-2.5 py-1.5 font-medium text-foreground max-w-[140px] truncate">{joint.label}</td>
                                <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{joint.lat.toFixed(4)}</td>
                                <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{joint.lng.toFixed(4)}</td>
                                <td className="px-2.5 py-1.5">
                                  <select
                                    value={joint.jointType}
                                    onChange={(e) => handleUpdateKmlJointType(joint.id, e.target.value as JointType)}
                                    className={cn('text-[10px] h-6 px-1 rounded border font-medium cursor-pointer', jointTypeColor(joint.jointType))}
                                  >
                                    {JOINT_TYPES.map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2.5 py-1.5">
                                  <select
                                    value={joint.icon}
                                    onChange={(e) => handleUpdateKmlIcon(joint.id, e.target.value)}
                                    className="text-[10px] h-6 px-1 rounded border border-border bg-background capitalize cursor-pointer"
                                  >
                                    {ICON_OPTIONS.map(icon => (
                                      <option key={icon} value={icon}>{icon}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-2.5 py-1.5 text-muted-foreground">{joint.fiberCount}</td>
                                <td className="px-2.5 py-1.5 text-center">
                                  {hasError
                                    ? <span className="text-red-500" title={joint.errors.join(', ')}><AlertCircle className="size-3.5 inline" /></span>
                                    : <span className="text-green-500"><Check className="size-3.5 inline" /></span>
                                  }
                                </td>
                                <td className="px-2.5 py-1.5">
                                  <button
                                    onClick={() => handleRemoveKmlJoint(joint.id)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    title="Remove joint"
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
                  )}
                </div>
              </div>
            )}

            {/* Cables & Wires preview */}
            {expandedPreview && previewTab === 'cables' && (
              <div className="space-y-3">
                {/* ── Detected Wires Card ── */}
                {detectedWires.length > 0 && (
                  <div className="p-3 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50/60 to-indigo-50/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers className="size-3.5 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-950">
                          Detected Wires ({detectedWires.length})
                        </span>
                        <span className="text-[10px] text-purple-600">
                          (Extracted from KML folders, styles & names)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {detectedWires.map((dw) => {
                        const isMatched = !!dw.matchedExistingWireId;
                        return (
                          <div
                            key={dw.tempId}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/90 border border-purple-100 shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Color picker trigger */}
                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setColorPickerWireId(colorPickerWireId === dw.tempId ? null : dw.tempId)}
                                  className="size-5 rounded-full border-2 border-white shadow-xs cursor-pointer hover:scale-110 transition-transform shrink-0"
                                  style={{ backgroundColor: dw.color }}
                                  title="Change wire color"
                                />
                                {colorPickerWireId === dw.tempId && (
                                  <div className="absolute left-0 top-7 z-50 p-2 bg-white rounded-lg border border-border shadow-xl grid grid-cols-6 gap-1 w-36">
                                    {WIRE_PALETTE.map((c) => (
                                      <button
                                        key={c}
                                        type="button"
                                        className="size-4 rounded-full border border-black/10 hover:scale-125 transition-transform"
                                        style={{ backgroundColor: c }}
                                        onClick={() => handleUpdateDetectedWireColor(dw.tempId, c)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Editable Wire Name */}
                              <input
                                type="text"
                                defaultValue={dw.name}
                                onBlur={(e) => handleUpdateDetectedWireName(dw.tempId, e.target.value)}
                                className="text-[11px] font-medium text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded outline-hidden min-w-[100px] flex-1 truncate"
                                title="Click to rename wire"
                              />

                              {/* Cable count */}
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {dw.cableCount}c
                              </span>
                            </div>

                            {/* Existing match or create new dropdown */}
                            <div className="shrink-0 flex items-center gap-1.5">
                              {isMatched ? (
                                <Badge className="text-[9px] h-4.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Existing Wire
                                </Badge>
                              ) : (
                                <Badge className="text-[9px] h-4.5 bg-blue-50 text-blue-700 border-blue-200">
                                  New Wire
                                </Badge>
                              )}

                              {wires.length > 0 && (
                                <select
                                  value={dw.matchedExistingWireId || 'new'}
                                  onChange={(e) => handleMapDetectedWireToExisting(dw.tempId, e.target.value)}
                                  className="text-[9px] h-5 px-1 rounded border border-purple-200 bg-white text-purple-900"
                                  title="Map to existing wire or create new"
                                >
                                  <option value="new">Create New Wire</option>
                                  {wires.map(w => (
                                    <option key={w.id} value={w.id}>
                                      Map to: {w.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bulk defaults toolbar */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-sky-200 bg-sky-50/50">
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-medium text-sky-800 shrink-0">Bulk defaults:</span>
                    <select
                      value={defaultCableType}
                      onChange={(e) => setDefaultCableType(e.target.value as 'Single Mode' | 'Multi Mode')}
                      className="text-[10px] h-6 px-1.5 rounded border border-sky-200 bg-white text-sky-800"
                    >
                      <option value="Single Mode">Single Mode</option>
                      <option value="Multi Mode">Multi Mode</option>
                    </select>

                    <select
                      value={defaultFiberCount}
                      onChange={(e) => setDefaultFiberCount(parseInt(e.target.value))}
                      className="text-[10px] h-6 px-1.5 rounded border border-sky-200 bg-white text-sky-800"
                    >
                      {FIBER_COUNT_PRESETS.map(n => (
                        <option key={n} value={n}>{n}F</option>
                      ))}
                    </select>

                    {/* Wire bulk assignment */}
                    <select
                      value={bulkWireOption}
                      onChange={(e) => setBulkWireOption(e.target.value)}
                      className="text-[10px] h-6 px-1.5 rounded border border-sky-200 bg-white text-sky-800 max-w-[180px]"
                    >
                      <option value="auto">Wire: Keep Detected</option>
                      {detectedWires.length > 0 && (
                        <optgroup label="Detected Wires">
                          {detectedWires.map(dw => (
                            <option key={dw.tempId} value={`detected:${dw.name}`}>
                              {dw.name} ({dw.cableCount}c)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {wires.length > 0 && (
                        <optgroup label="Existing Wires">
                          {wires.map(w => (
                            <option key={w.id} value={`existing:${w.id}`}>
                              {w.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="none">No Wire (Default)</option>
                    </select>

                    <Button
                      variant="outline" size="sm"
                      onClick={handleApplyBulkDefaults}
                      className="h-6 text-[10px] px-2 bg-white border-sky-200 text-sky-700 hover:bg-sky-50"
                    >
                      Apply to All Cables
                    </Button>
                  </div>
                </div>

                {/* Cables table */}
                <div className="border border-border rounded-xl overflow-hidden">
                  {kmlCables.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs">
                      No path/line placemarks found in this KML file
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/70 sticky top-0">
                          <tr>
                            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Cable</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">From Joint</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">To Joint</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Wire</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Cable Type</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Fibers</th>
                            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Length</th>
                            <th className="px-2.5 py-2 text-center font-semibold text-muted-foreground">Status</th>
                            <th className="px-2.5 py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {kmlCables.map((cable) => {
                            const hasError = cable.errors.length > 0;
                            // Determine active wire selection value
                            let currentVal = 'none';
                            if (cable.wireId && wires.some(w => w.id === cable.wireId)) {
                              currentVal = `existing:${cable.wireId}`;
                            } else if (cable.wireName) {
                              currentVal = `detected:${cable.wireName}`;
                            }

                            return (
                              <tr key={cable.id} className={cn('hover:bg-muted/30', hasError && 'bg-red-50/50')}>
                                <td className="px-2.5 py-1.5 font-medium text-foreground max-w-[120px] truncate" title={cable.label}>
                                  {cable.label}
                                </td>
                                <td className="px-2.5 py-1.5 text-muted-foreground max-w-[90px] truncate" title={cable.fromLabel}>
                                  {cable.fromLabel || '—'}
                                </td>
                                <td className="px-2.5 py-1.5 text-muted-foreground max-w-[90px] truncate" title={cable.toLabel}>
                                  {cable.toLabel || '—'}
                                </td>

                                {/* Wire selector column */}
                                <td className="px-2.5 py-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="size-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: cable.wireColor || '#94a3b8' }}
                                    />
                                    <select
                                      value={currentVal}
                                      onChange={(e) => handleAssignCableWire(cable.id, e.target.value)}
                                      className="text-[10px] h-5 px-1 rounded border border-border bg-white text-foreground max-w-[110px] truncate"
                                    >
                                      {detectedWires.length > 0 && (
                                        <optgroup label="Detected Wires">
                                          {detectedWires.map(dw => (
                                            <option key={dw.tempId} value={`detected:${dw.name}`}>
                                              {dw.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {wires.length > 0 && (
                                        <optgroup label="Existing Wires">
                                          {wires.map(w => (
                                            <option key={w.id} value={`existing:${w.id}`}>
                                              {w.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      <option value="none">No Wire</option>
                                    </select>
                                  </div>
                                </td>

                                <td className="px-2.5 py-1.5">
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md border font-medium bg-sky-100 text-sky-700 border-sky-200">
                                    {cable.cableType}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1.5 text-muted-foreground">{cable.fiberCount}F</td>
                                <td className="px-2.5 py-1.5 text-muted-foreground font-mono">
                                  {cable.lengthMeters >= 1000
                                    ? `${(cable.lengthMeters / 1000).toFixed(1)}km`
                                    : `${cable.lengthMeters}m`
                                  }
                                </td>
                                <td className="px-2.5 py-1.5 text-center">
                                  {hasError
                                    ? <span className="text-red-500" title={cable.errors.join(', ')}><AlertCircle className="size-3.5 inline" /></span>
                                    : <span className="text-green-500"><Check className="size-3.5 inline" /></span>
                                  }
                                </td>
                                <td className="px-2.5 py-1.5">
                                  <button
                                    onClick={() => handleRemoveKmlCable(cable.id)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    title="Remove cable"
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
                  )}
                </div>

                {!onImportSegment && kmlCables.length > 0 && (
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                    <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                      <AlertCircle className="size-3.5 shrink-0" />
                      Cable connection import is not available. Only joints will be imported.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Import button + progress */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={importing} className="gap-1.5">
                <X className="size-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || (validKmlJoints.length === 0 && validKmlCables.length === 0)}
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
                    Import {validKmlJoints.length} Joint{validKmlJoints.length !== 1 ? 's' : ''}
                    {onImportSegment && validKmlCables.length > 0 && ` + ${validKmlCables.length} Cable${validKmlCables.length !== 1 ? 's' : ''}`}
                    {detectedWires.filter(dw => dw.isNew).length > 0 && ` (${detectedWires.filter(dw => dw.isNew).length} Wires)`}
                  </>
                )}
              </Button>
            </div>

            {importing && (
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${importProgress}%` }} />
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* Results */}
        {/* ══════════════════════════════════════════════════ */}
        {importResults && (
          <div className="space-y-3">
            <div className={cn(
              'p-4 rounded-xl border text-center',
              (importResults.failed === 0 && importResults.cablesFailed === 0)
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50',
            )}>
              <div className={cn(
                'size-12 rounded-2xl mx-auto flex items-center justify-center mb-3',
                (importResults.failed === 0 && importResults.cablesFailed === 0) ? 'bg-green-200' : 'bg-amber-200',
              )}>
                {(importResults.failed === 0 && importResults.cablesFailed === 0)
                  ? <Check className="size-6 text-green-700" />
                  : <AlertCircle className="size-6 text-amber-700" />
                }
              </div>
              <p className="text-sm font-semibold text-foreground">Import Complete</p>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p>
                  <strong className="text-green-700">{importResults.success}</strong> joint{importResults.success !== 1 ? 's' : ''} added
                  {importResults.failed > 0 && (
                    <>, <strong className="text-red-600">{importResults.failed}</strong> failed</>
                  )}
                </p>
                {(importResults.cablesSuccess > 0 || importResults.cablesFailed > 0) && (
                  <p>
                    <strong className="text-green-700">{importResults.cablesSuccess}</strong> cable{importResults.cablesSuccess !== 1 ? 's' : ''} connected
                    {importResults.wiresCreated > 0 && (
                      <> across <strong className="text-purple-700">{importResults.wiresCreated}</strong> new wire{importResults.wiresCreated !== 1 ? 's' : ''}</>
                    )}
                    {importResults.cablesFailed > 0 && (
                      <>, <strong className="text-red-600">{importResults.cablesFailed}</strong> failed</>
                    )}
                  </p>
                )}
              </div>
            </div>

            {importResults.errors.length > 0 && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 space-y-1">
                <p className="text-[11px] font-medium text-red-700">Failed items:</p>
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
