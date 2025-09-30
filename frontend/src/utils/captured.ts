function countPiecesFromBoardPart(boardPart: string) {
  const counts: Record<string, number> = {
    K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0,
    k: 0, q: 0, r: 0, b: 0, n: 0, p: 0
  };
  for (const ch of boardPart) {
    if (Object.prototype.hasOwnProperty.call(counts, ch)) {
      counts[ch]++;
    }
  }
  return counts;
}

function initialCountsFor(color: 'white' | 'black') {
  if (color === 'white') {
    return { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };
  } else {
    return { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };
  }
}

export function getCapturedPiecesForColor(fen: string, playerColor: 'white' | 'black'): string[] {
  const boardPart = fen.split(' ')[0];
  const counts = countPiecesFromBoardPart(boardPart);
  const result: string[] = [];

  if (playerColor === 'white') {
    const init = initialCountsFor('black');
    const mapping: [keyof typeof init, string][] = [
      ['q', 'q'], ['r', 'r'], ['b', 'b'], ['n', 'n'], ['p', 'p'], ['k', 'k']
    ];
    for (const [key, sym] of mapping) {
      const present = counts[key as string] || 0;
      const missing = (init as any)[key] - present;
      for (let i = 0; i < Math.max(0, missing); i++) result.push(sym);
    }
  } else {
    const init = initialCountsFor('white');
    const mapping: [keyof typeof init, string][] = [
      ['Q', 'Q'], ['R', 'R'], ['B', 'B'], ['N', 'N'], ['P', 'P'], ['K', 'K']
    ];
    for (const [key, sym] of mapping) {
      const present = counts[key as string] || 0;
      const missing = (init as any)[key] - present;
      for (let i = 0; i < Math.max(0, missing); i++) result.push(sym);
    }
  }
  return result;
}

export function getPieceImageBySymbol(pieceSymbol: string): string {
  const pieceMap: { [key: string]: string } = {
    'K': 'king-white',
    'Q': 'queen-white',
    'R': 'rook-white',
    'B': 'bishop-white',
    'N': 'knight-white',
    'P': 'pawn-white',
    'k': 'king-black',
    'q': 'queen-black',
    'r': 'rook-black',
    'b': 'bishop-black',
    'n': 'knight-black',
    'p': 'pawn-black'
  };
  const pieceName = pieceMap[pieceSymbol] || 'pawn-white';
  return new URL(`../assets/pieces/${pieceName}.svg`, import.meta.url).href;
}


