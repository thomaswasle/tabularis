// SQL Analysis Utilities - Pure logic functions for parsing and analyzing SQL

// SQL reserved words that are never valid unquoted table aliases
const SQL_RESERVED = new Set([
  'where', 'on', 'set', 'having', 'group', 'order', 'limit', 'offset',
  'join', 'left', 'right', 'inner', 'outer', 'cross', 'union', 'intersect',
  'except', 'select', 'from', 'into', 'values', 'update', 'delete', 'insert',
  'create', 'drop', 'alter', 'and', 'or', 'not', 'is', 'in', 'between',
  'like', 'as', 'distinct', 'case', 'when', 'then', 'else', 'end', 'by',
  'asc', 'desc', 'null', 'with', 'exists', 'all', 'any', 'using',
]);

// Optimized table parser - early exit and minimal allocations
export const parseTablesFromQuery = (sql: string): Map<string, string> | null => {
  if (!sql || sql.length === 0) return null;

  const lowerSql = sql.toLowerCase();

  // Quick check if query contains FROM/JOIN keywords
  if (!lowerSql.includes('from') && !lowerSql.includes('join')) {
    return null;
  }

  const tableMap = new Map<string, string>();
  const fromPattern = /(?:from|join)\s+(?:`)?([a-z_][a-z0-9_]*)(?:`)?(?:\s+(?:as\s+)?(?:`)?([a-z_][a-z0-9_]*)(?:`)?)?/gi;

  let match;
  let matchCount = 0;
  const MAX_MATCHES = 10; // Prevent regex catastrophic backtracking

  while ((match = fromPattern.exec(lowerSql)) !== null && matchCount++ < MAX_MATCHES) {
    const tableName = match[1];
    const rawAlias = match[2];
    // Ignore captured word if it's a SQL keyword (e.g. WHERE captured after table name)
    const alias = (rawAlias && !SQL_RESERVED.has(rawAlias)) ? rawAlias : tableName;
    tableMap.set(alias, tableName);
  }

  return tableMap.size > 0 ? tableMap : null;
};

// Optimized statement extractor - avoid full text scan when possible
export const getCurrentStatement = (model: { getValue: () => string; getOffsetAt: (position: { lineNumber: number; column: number }) => number }, position: { lineNumber: number; column: number }): string => {
  const fullText = model.getValue();
  
  // For small files, just return full text
  if (fullText.length < 500) {
    return fullText;
  }
  
  const offset = model.getOffsetAt(position);
  let start = 0;
  let end = fullText.length;
  
  // Search within reasonable bounds (±2000 chars from cursor)
  const searchStart = Math.max(0, offset - 2000);
  const searchEnd = Math.min(fullText.length, offset + 2000);
  
  // Find previous semicolon
  for (let i = offset - 1; i >= searchStart; i--) {
    if (fullText[i] === ';') {
      start = i + 1;
      break;
    }
  }
  
  // Find next semicolon
  for (let i = offset; i < searchEnd; i++) {
    if (fullText[i] === ';') {
      end = i;
      break;
    }
  }
  
  return fullText.substring(start, end).trim();
};
