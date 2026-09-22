import JSZip from 'jszip';
import type { JointType } from '../types';

// ── Types ──

export interface ParsedKMLJoint {
  id: string; // temp ID for linking cables before DB save
  label: string;
  lat: number;
  lng: number;
  jointType: JointType;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  notes: string;
  icon: string;
  errors: string[];
  source: 'kml';
}

export interface ParsedKMLCable {
  id: string;
  label: string;
  fromJointId: string; // temp ID or existing joint ID
  toJointId: string;
  fromLabel: string;
  toLabel: string;
  waypoints: Array<{ lat: number; lng: number }>;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lengthMeters: number;
  errors: string[];
  source: 'kml';
  folderName?: string;
  wireName?: string;
  wireColor?: string;
  wireId?: string;
}

export interface DetectedKMLWire {
  tempId: string;
  name: string;
  color: string;
  cableCount: number;
  matchedExistingWireId?: string;
  isNew: boolean;
}

export interface ExistingWireInfo {
  id: string;
  name: string;
  color: string;
}

export interface KMLParseResult {
  joints: ParsedKMLJoint[];
  cables: ParsedKMLCable[];
  detectedWires: DetectedKMLWire[];
  fileName: string;
}

// ── Constants ──

const JOINT_TYPE_KEYWORDS: Record<string, { type: JointType; icon: string }> = {
  'hub': { type: 'Base', icon: 'building' },
  'base': { type: 'Base', icon: 'building' },
  'office': { type: 'Base', icon: 'building' },
  'central': { type: 'Base', icon: 'building' },
  'hq': { type: 'Base', icon: 'building' },
  'olt': { type: 'Base', icon: 'building' },
  'main': { type: 'Main', icon: 'default' },
  'junction': { type: 'Main', icon: 'default' },
  'pole': { type: 'Main', icon: 'pole' },
  'tower': { type: 'Main', icon: 'tower' },
  'cabinet': { type: 'Sub', icon: 'cabinet' },
  'box': { type: 'Sub', icon: 'box' },
  'fdb': { type: 'Sub', icon: 'box' },
  'fat': { type: 'Sub', icon: 'box' },
  'sub': { type: 'Sub', icon: 'box' },
  'customer': { type: 'Sub', icon: 'home' },
  'ont': { type: 'Sub', icon: 'home' },
  'onu': { type: 'Sub', icon: 'home' },
  'splice': { type: 'Splice', icon: 'default' },
  'manhole': { type: 'Splice', icon: 'manhole' },
  'closure': { type: 'Splice', icon: 'manhole' },
  'handhole': { type: 'Splice', icon: 'manhole' },
  'router': { type: 'Sub', icon: 'router' },
};

const ICON_OPTIONS = [
  'default', 'star', 'home', 'building', 'box', 'pole', 'manhole', 'cabinet', 'tower', 'router',
];

export const WIRE_PALETTE = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#a855f7', // Purple
  '#84cc16', // Lime
  '#e11d48', // Rose
];

// ── Helpers ──

let tempIdCounter = 0;
function generateTempId(): string {
  return `kml_temp_${Date.now()}_${tempIdCounter++}`;
}

/** Haversine distance in meters */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convert KML color string (aabbggrr or rrggbb) to standard #rrggbb */
export function kmlColorToHex(kmlColor: string | null | undefined): string | null {
  if (!kmlColor) return null;
  const clean = kmlColor.trim().replace(/^#/, '');
  if (clean.length === 8) {
    // KML format is AABBGGRR
    const bb = clean.substring(2, 4);
    const gg = clean.substring(4, 6);
    const rr = clean.substring(6, 8);
    return `#${rr}${gg}${bb}`.toLowerCase();
  } else if (clean.length === 6) {
    return `#${clean}`.toLowerCase();
  }
  return null;
}

/** Try to detect joint type and icon from name/description keywords */
function detectJointTypeAndIcon(text: string): { type: JointType; icon: string } {
  const lower = text.toLowerCase();
  for (const [keyword, result] of Object.entries(JOINT_TYPE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return result;
    }
  }
  return { type: 'Main', icon: 'default' };
}

/** Try to detect fiber count from text like "48F", "24 fiber", etc. */
function detectFiberCount(text: string): number | null {
  const match = text.match(/(\d+)\s*[-]?\s*f(?:iber)?s?\b/i);
  if (match) {
    const count = parseInt(match[1]);
    if (count > 0 && count <= 1000) return count;
  }
  return null;
}

/** Parse KML coordinate string "lng,lat,alt" into { lat, lng } */
function parseKMLCoordinate(coordStr: string): { lat: number; lng: number } | null {
  const parts = coordStr.trim().split(',');
  if (parts.length < 2) return null;
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Parse a multi-coordinate string from <coordinates> tag */
function parseKMLCoordinates(coordText: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  const entries = coordText.trim().split(/\s+/);
  for (const entry of entries) {
    if (!entry.trim()) continue;
    const point = parseKMLCoordinate(entry);
    if (point) points.push(point);
  }
  return points;
}

/** Calculate total polyline distance from a list of points */
function polylineLength(points: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng,
    );
  }
  return Math.round(total);
}

/** Get inner text of a tag from an XML element */
function getTagText(el: Element, tagName: string): string {
  const tag = el.getElementsByTagName(tagName)[0];
  return tag?.textContent?.trim() || '';
}

/** Check if a folder name is generic and unhelpful */
function isGenericFolderName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return (
    !lower ||
    lower === 'untitled folder' ||
    lower === 'my places' ||
    lower === 'temporary places' ||
    lower === 'waypoints' ||
    lower === 'places' ||
    lower === 'lines' ||
    lower === 'paths' ||
    lower === 'kml'
  );
}

/** Find enclosing folder name of a placemark element */
function getParentFolderName(el: Element): string | null {
  let curr = el.parentElement;
  while (curr) {
    if (curr.tagName.toLowerCase() === 'folder') {
      for (let i = 0; i < curr.children.length; i++) {
        const child = curr.children[i];
        if (child.tagName.toLowerCase() === 'name') {
          const name = child.textContent?.trim();
          if (name && !isGenericFolderName(name)) {
            return name;
          }
        }
      }
    }
    curr = curr.parentElement;
  }
  return null;
}

/** Check ExtendedData for wire or cable name attributes */
function getExtendedDataWire(pm: Element): string | null {
  const ext = pm.getElementsByTagName('ExtendedData')[0];
  if (!ext) return null;

  const searchKeys = ['wire', 'cable', 'route', 'layer', 'group', 'line'];

  // Check <Data name="...">
  const dataList = ext.getElementsByTagName('Data');
  for (let i = 0; i < dataList.length; i++) {
    const d = dataList[i];
    const name = d.getAttribute('name')?.toLowerCase() || '';
    if (searchKeys.some(k => name === k || name.includes(k))) {
      const val = d.getElementsByTagName('value')[0]?.textContent?.trim();
      if (val && !isGenericFolderName(val)) return val;
    }
  }

  // Check <SimpleData name="...">
  const sList = ext.getElementsByTagName('SimpleData');
  for (let i = 0; i < sList.length; i++) {
    const s = sList[i];
    const name = s.getAttribute('name')?.toLowerCase() || '';
    if (searchKeys.some(k => name === k || name.includes(k))) {
      const val = s.textContent?.trim();
      if (val && !isGenericFolderName(val)) return val;
    }
  }

  return null;
}

/** Detect common cable group prefix from placemark name (e.g. "Feeder 1 - Span A" -> "Feeder 1") */
function extractNamePrefix(name: string): string | null {
  const delimiters = [' - ', ' — ', ' : ', ' / ', '_'];
  for (const delim of delimiters) {
    if (name.includes(delim)) {
      const prefix = name.split(delim)[0].trim();
      if (prefix && prefix.length >= 3 && !/^\d+$/.test(prefix)) {
        return prefix;
      }
    }
  }
  return null;
}

// ── KML Parsing ──

interface ExistingJoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

const SNAP_THRESHOLD_METERS = 50;

/**
 * Find the nearest joint (from parsed or existing) within snap threshold.
 */
function findNearestJoint(
  lat: number, lng: number,
  parsedJoints: ParsedKMLJoint[],
  existingJoints: ExistingJoint[],
): { id: string; label: string } | null {
  let bestDist = Infinity;
  let bestMatch: { id: string; label: string } | null = null;

  for (const j of parsedJoints) {
    const dist = haversineDistance(lat, lng, j.lat, j.lng);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = { id: j.id, label: j.label };
    }
  }

  for (const j of existingJoints) {
    const dist = haversineDistance(lat, lng, j.lat, j.lng);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = { id: j.id, label: j.label };
    }
  }

  if (bestDist <= SNAP_THRESHOLD_METERS && bestMatch) {
    return bestMatch;
  }

  return null;
}

export function parseKMLString(
  xmlText: string,
  fileName: string,
  existingJoints: ExistingJoint[] = [],
  existingWires: ExistingWireInfo[] = [],
): KMLParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parsedJoints: ParsedKMLJoint[] = [];
  const cables: ParsedKMLCable[] = [];

  // ── Build Style Maps ──
  const styleColorMap = new Map<string, string>();
  const styleElements = doc.getElementsByTagName('Style');
  for (let i = 0; i < styleElements.length; i++) {
    const styleEl = styleElements[i];
    const id = styleEl.getAttribute('id');
    const lineStyle = styleEl.getElementsByTagName('LineStyle')[0];
    if (id && lineStyle) {
      const colorStr = getTagText(lineStyle, 'color');
      const hex = kmlColorToHex(colorStr);
      if (hex) styleColorMap.set(id, hex);
    }
  }

  // Parse StyleMap elements that link normal/highlight styles to base Style
  const styleMapElements = doc.getElementsByTagName('StyleMap');
  for (let i = 0; i < styleMapElements.length; i++) {
    const smEl = styleMapElements[i];
    const smId = smEl.getAttribute('id');
    if (!smId) continue;

    const pairs = smEl.getElementsByTagName('Pair');
    let targetStyleId = '';
    for (let j = 0; j < pairs.length; j++) {
      const key = getTagText(pairs[j], 'key');
      if (key === 'normal' || !targetStyleId) {
        targetStyleId = getTagText(pairs[j], 'styleUrl').replace(/^#/, '');
      }
    }
    if (targetStyleId && styleColorMap.has(targetStyleId)) {
      styleColorMap.set(smId, styleColorMap.get(targetStyleId)!);
    }
  }

  // Get all Placemarks
  const placemarks = doc.getElementsByTagName('Placemark');

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const name = getTagText(pm, 'name') || `Imported ${i + 1}`;
    const description = getTagText(pm, 'description');
    const combinedText = `${name} ${description}`;

    // Check if this is a Point or LineString
    const point = pm.getElementsByTagName('Point')[0];
    const lineString = pm.getElementsByTagName('LineString')[0];

    if (point) {
      // ── Parse as Joint ──
      const coordStr = getTagText(point, 'coordinates');
      const coord = parseKMLCoordinate(coordStr);
      const errors: string[] = [];

      if (!coord) {
        errors.push('Invalid or missing coordinates');
      }

      const detected = detectJointTypeAndIcon(combinedText);
      const detectedFibers = detectFiberCount(combinedText);

      parsedJoints.push({
        id: generateTempId(),
        label: name,
        lat: coord?.lat ?? 0,
        lng: coord?.lng ?? 0,
        jointType: detected.type,
        cableType: 'Single Mode',
        fiberCount: detectedFibers || 12,
        notes: description,
        icon: ICON_OPTIONS.includes(detected.icon) ? detected.icon : 'default',
        errors,
        source: 'kml',
      });
    } else if (lineString) {
      // ── Parse as Cable Connection ──
      const coordStr = getTagText(lineString, 'coordinates');
      const points = parseKMLCoordinates(coordStr);
      const errors: string[] = [];

      if (points.length < 2) {
        errors.push('LineString needs at least 2 points');
      }

      const detectedFibers = detectFiberCount(combinedText);
      const length = polylineLength(points);

      // Extract folder, style color, and wire group candidate
      const folderName = getParentFolderName(pm) || undefined;
      const extWire = getExtendedDataWire(pm) || undefined;

      // Extract style color
      let styleColor: string | undefined;
      const inlineStyle = pm.getElementsByTagName('Style')[0];
      if (inlineStyle) {
        const ls = inlineStyle.getElementsByTagName('LineStyle')[0];
        if (ls) {
          const hex = kmlColorToHex(getTagText(ls, 'color'));
          if (hex) styleColor = hex;
        }
      }
      if (!styleColor) {
        const styleUrl = getTagText(pm, 'styleUrl').replace(/^#/, '');
        if (styleUrl && styleColorMap.has(styleUrl)) {
          styleColor = styleColorMap.get(styleUrl);
        }
      }

      cables.push({
        id: generateTempId(),
        label: name,
        fromJointId: '',
        toJointId: '',
        fromLabel: '',
        toLabel: '',
        waypoints: points.length > 2 ? points.slice(1, -1) : [],
        cableType: 'Single Mode',
        fiberCount: detectedFibers || 12,
        lengthMeters: length,
        errors,
        source: 'kml',
        folderName,
        wireName: extWire || folderName || undefined,
        wireColor: styleColor,
      });

      // Store the raw start/end coordinates for snapping
      (cables[cables.length - 1] as any)._startCoord = points[0];
      (cables[cables.length - 1] as any)._endCoord = points[points.length - 1];
    }
  }

  // ── Snap cable endpoints to joints ──
  for (const cable of cables) {
    const startCoord = (cable as any)._startCoord as { lat: number; lng: number } | undefined;
    const endCoord = (cable as any)._endCoord as { lat: number; lng: number } | undefined;

    if (startCoord) {
      const match = findNearestJoint(startCoord.lat, startCoord.lng, parsedJoints, existingJoints);
      if (match) {
        cable.fromJointId = match.id;
        cable.fromLabel = match.label;
      } else {
        const autoJoint: ParsedKMLJoint = {
          id: generateTempId(),
          label: `${cable.label} — Start`,
          lat: startCoord.lat,
          lng: startCoord.lng,
          jointType: 'Splice',
          cableType: 'Single Mode',
          fiberCount: cable.fiberCount,
          notes: `Auto-generated endpoint for cable "${cable.label}"`,
          icon: 'default',
          errors: [],
          source: 'kml',
        };
        parsedJoints.push(autoJoint);
        cable.fromJointId = autoJoint.id;
        cable.fromLabel = autoJoint.label;
      }
    }

    if (endCoord) {
      const match = findNearestJoint(endCoord.lat, endCoord.lng, parsedJoints, existingJoints);
      if (match) {
        cable.toJointId = match.id;
        cable.toLabel = match.label;
      } else {
        const autoJoint: ParsedKMLJoint = {
          id: generateTempId(),
          label: `${cable.label} — End`,
          lat: endCoord.lat,
          lng: endCoord.lng,
          jointType: 'Splice',
          cableType: 'Single Mode',
          fiberCount: cable.fiberCount,
          notes: `Auto-generated endpoint for cable "${cable.label}"`,
          icon: 'default',
          errors: [],
          source: 'kml',
        };
        parsedJoints.push(autoJoint);
        cable.toJointId = autoJoint.id;
        cable.toLabel = autoJoint.label;
      }
    }

    if (!cable.fromJointId) cable.errors.push('Could not resolve start joint');
    if (!cable.toJointId) cable.errors.push('Could not resolve end joint');

    delete (cable as any)._startCoord;
    delete (cable as any)._endCoord;
  }

  // ── Infer and Group Wires ──
  // Check if cables without wireName share common prefixes in their names
  const prefixCounts = new Map<string, number>();
  cables.forEach(c => {
    if (!c.wireName) {
      const prefix = extractNamePrefix(c.label);
      if (prefix) {
        prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
      }
    }
  });

  // Default fallback wire name derived from file name
  const cleanFileName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
  const fileDefaultWireName = cleanFileName ? `${cleanFileName} Cable` : 'Main Cable';

  // Assign wire names to cables
  cables.forEach(c => {
    if (!c.wireName) {
      const prefix = extractNamePrefix(c.label);
      if (prefix && (prefixCounts.get(prefix) || 0) > 1) {
        c.wireName = prefix;
      } else if (c.wireColor) {
        // Color-based grouping if distinct color exists
        c.wireName = `Cable (${c.wireColor.toUpperCase()})`;
      } else {
        c.wireName = fileDefaultWireName;
      }
    }
  });

  // Group cables by wireName to form DetectedKMLWire list
  const wireGroupMap = new Map<string, {
    name: string;
    color?: string;
    count: number;
    cableIndices: number[];
  }>();

  cables.forEach((c, idx) => {
    const wName = c.wireName || fileDefaultWireName;
    if (!wireGroupMap.has(wName)) {
      wireGroupMap.set(wName, {
        name: wName,
        color: c.wireColor,
        count: 1,
        cableIndices: [idx],
      });
    } else {
      const entry = wireGroupMap.get(wName)!;
      entry.count++;
      entry.cableIndices.push(idx);
      if (!entry.color && c.wireColor) {
        entry.color = c.wireColor;
      }
    }
  });

  // Build DetectedKMLWire array and assign final colors and matching IDs
  const detectedWires: DetectedKMLWire[] = [];
  let paletteIdx = 0;

  wireGroupMap.forEach((grp) => {
    // Check if matches an existing wire in database
    const matchingExisting = existingWires.find(
      w => w.name.trim().toLowerCase() === grp.name.trim().toLowerCase(),
    );

    let chosenColor: string;
    let matchedId: string | undefined;

    if (matchingExisting) {
      matchedId = matchingExisting.id;
      chosenColor = matchingExisting.color;
    } else if (grp.color && grp.color !== '#000000' && grp.color !== '#ffffff') {
      chosenColor = grp.color;
    } else {
      chosenColor = WIRE_PALETTE[paletteIdx % WIRE_PALETTE.length];
      paletteIdx++;
    }

    const tempWireId = `kml_wire_${Date.now()}_${tempIdCounter++}`;
    detectedWires.push({
      tempId: tempWireId,
      name: grp.name,
      color: chosenColor,
      cableCount: grp.count,
      matchedExistingWireId: matchedId,
      isNew: !matchedId,
    });

    // Update cables in this group with color and wireId if already matched
    grp.cableIndices.forEach(cIdx => {
      cables[cIdx].wireColor = chosenColor;
      if (matchedId) {
        cables[cIdx].wireId = matchedId;
      }
    });
  });

  return { joints: parsedJoints, cables, detectedWires, fileName };
}

// ── KMZ Handling ──

export async function parseKMZFile(
  file: File,
  existingJoints: ExistingJoint[] = [],
  existingWires: ExistingWireInfo[] = [],
): Promise<KMLParseResult> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);

  let kmlText: string | null = null;
  for (const [name, entry] of Object.entries(contents.files)) {
    if (name.toLowerCase().endsWith('.kml') && !entry.dir) {
      kmlText = await entry.async('string');
      break;
    }
  }

  if (!kmlText) {
    throw new Error('No .kml file found inside the .kmz archive');
  }

  return parseKMLString(kmlText, file.name, existingJoints, existingWires);
}

// ── Main entry point ──

export async function parseKMLOrKMZFile(
  file: File,
  existingJoints: ExistingJoint[] = [],
  existingWires: ExistingWireInfo[] = [],
): Promise<KMLParseResult> {
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'kmz') {
    return parseKMZFile(file, existingJoints, existingWires);
  }

  if (ext === 'kml') {
    const text = await file.text();
    return parseKMLString(text, file.name, existingJoints, existingWires);
  }

  throw new Error('Unsupported file format. Please upload a .kml or .kmz file.');
}
