export function parseBoardPartToMatrix(boardPart: string): (string | null)[][] {
  const rows = boardPart.split('/');
  const matrix: (string | null)[][] = [];
  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r];
    const row: (string | null)[] = [];
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '8') {
        const n = parseInt(ch);
        for (let i = 0; i < n; i++) row.push(null);
      } else {
        row.push(ch);
      }
    }
    matrix.push(row);
  }
  return matrix;
}

export function matrixToBoardPart(matrix: (string | null)[][]): string {
  const parts: string[] = [];
  for (let r = 0; r < 8; r++) {
    let rowStr = '';
    let emptyCount = 0;
    for (let c = 0; c < 8; c++) {
      const cell = matrix[r][c];
      if (!cell) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += String(emptyCount);
          emptyCount = 0;
        }
        rowStr += cell;
      }
    }
    if (emptyCount > 0) rowStr += String(emptyCount);
    parts.push(rowStr);
  }
  return parts.join('/');
}

export function notationToCoords(notation: string): { r: number; c: number } {
  const file = notation.charCodeAt(0) - 97; // a=0
  const rank = parseInt(notation[1], 10); // 1-8
  const r = 8 - rank;
  const c = file;
  return { r, c };
}

export function isKingCapturedFromBoardPart(boardPart: string): boolean {
  const hasWhiteKing = boardPart.includes('K');
  const hasBlackKing = boardPart.includes('k');
  return !hasWhiteKing || !hasBlackKing;
}
