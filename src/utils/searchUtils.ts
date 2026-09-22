/**
 * Smart search matcher for joints, supporting tokens like:
 * - `starts:B` or `prefix:B` (starts with B)
 * - `ends:01` or `suffix:01` (ends with 01)
 * - `len:5` or `length:5` (exact length 5)
 * - `len>5` or `length>5` (length > 5)
 * - `len<10` or `length<10` (length < 10)
 * - `type:Base` or `type:Main` (joint type)
 * - Or normal text queries
 */
export function matchesSmartSearch(
  item: { label: string; notes?: string; jointType?: string },
  query: string,
): boolean {
  if (!query || !query.trim()) return true;

  const tokens = query.trim().split(/\s+/);
  const label = item.label.trim();
  const labelUpper = label.toUpperCase();
  const notesUpper = (item.notes || '').toUpperCase();
  const typeUpper = (item.jointType || '').toUpperCase();
  const len = label.length;

  for (const token of tokens) {
    const lowerToken = token.toLowerCase();

    // Check starts: or prefix: (e.g. starts:B or starts:B:5)
    if (lowerToken.startsWith('starts:') || lowerToken.startsWith('prefix:')) {
      const rest = token.slice(token.indexOf(':') + 1);
      const parts = rest.split(':');
      const val = parts[0].toUpperCase();
      if (!labelUpper.startsWith(val)) return false;
      if (parts.length > 1) {
        const reqLen = parseInt(parts[1]);
        if (!isNaN(reqLen) && len !== reqLen) return false;
      }
      continue;
    }

    // Check ends: or suffix: (e.g. ends:01 or ends:01:5)
    if (lowerToken.startsWith('ends:') || lowerToken.startsWith('suffix:')) {
      const rest = token.slice(token.indexOf(':') + 1);
      const parts = rest.split(':');
      const val = parts[0].toUpperCase();
      if (!labelUpper.endsWith(val)) return false;
      if (parts.length > 1) {
        const reqLen = parseInt(parts[1]);
        if (!isNaN(reqLen) && len !== reqLen) return false;
      }
      continue;
    }

    // Check len: or length:
    if (lowerToken.startsWith('len:') || lowerToken.startsWith('length:')) {
      const val = token.slice(token.indexOf(':') + 1);
      if (val.startsWith('>=')) {
        const num = parseInt(val.slice(2));
        if (isNaN(num) || len < num) return false;
      } else if (val.startsWith('<=')) {
        const num = parseInt(val.slice(2));
        if (isNaN(num) || len > num) return false;
      } else if (val.startsWith('>')) {
        const num = parseInt(val.slice(1));
        if (isNaN(num) || len <= num) return false;
      } else if (val.startsWith('<')) {
        const num = parseInt(val.slice(1));
        if (isNaN(num) || len >= num) return false;
      } else {
        const num = parseInt(val);
        if (isNaN(num) || len !== num) return false;
      }
      continue;
    }

    // Check len> or length>
    if (lowerToken.startsWith('len>') || lowerToken.startsWith('length>')) {
      const num = parseInt(lowerToken.slice(lowerToken.indexOf('>') + 1));
      if (isNaN(num) || len <= num) return false;
      continue;
    }

    // Check len< or length<
    if (lowerToken.startsWith('len<') || lowerToken.startsWith('length<')) {
      const num = parseInt(lowerToken.slice(lowerToken.indexOf('<') + 1));
      if (isNaN(num) || len >= num) return false;
      continue;
    }

    // Check len= or length=
    if (lowerToken.startsWith('len=') || lowerToken.startsWith('length=')) {
      const num = parseInt(lowerToken.slice(lowerToken.indexOf('=') + 1));
      if (isNaN(num) || len !== num) return false;
      continue;
    }

    // Check type:
    if (lowerToken.startsWith('type:')) {
      const val = token.slice(token.indexOf(':') + 1).toUpperCase();
      if (!typeUpper.startsWith(val)) return false;
      continue;
    }

    // Standard substring search
    const searchVal = token.toUpperCase();
    if (!labelUpper.includes(searchVal) && !notesUpper.includes(searchVal)) {
      return false;
    }
  }

  return true;
}
