import type { Move } from '../types';
import { mapCoordFog } from './coords';
import { toDatePGNString } from './format';

export function moveToChessComLAN(move: any): string {
  const piece = (move.piece || '').toString();
  const isPawn = piece.toLowerCase() === 'p' || piece === '';
  const pieceLetterMap: Record<string, string> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: '' };
  const prefix = isPawn ? '' : (pieceLetterMap[piece.toLowerCase()] || '');

  const fromOut = mapCoordFog(move.from);
  const toOut = mapCoordFog(move.to);

  const isCapture = !!move.captured;
  const delimiter = isCapture ? 'x' : '-';

  const capturedIsKing = move.captured === 'k' || move.captured === 'K';
  const checkOrMate = capturedIsKing ? '#' : '';

  const promo = move.promotion ? `=${String(move.promotion).toUpperCase()}` : '';

  return `${prefix}${fromOut}${delimiter}${toOut}${promo}${checkOrMate}`;
}

export function buildPGN(moves: Move[], whiteName: string, blackName: string, result: string, when: Date): string {
  const headers = [
    `[Event "FogChess"]`,
    `[Site "Local"]`,
    `[Date "${toDatePGNString(when)}"]`,
    `[Round "-"]`,
    `[White "${whiteName}"]`,
    `[Black "${blackName}"]`,
    `[Result "${result}"]`,
    `[Variant "Fog of War"]`,
    `[RuleVariants "EnPassant FogOfWar Play4Mate"]`
  ];

  const pgnMoves: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const turn = Math.floor(i / 2) + 1;
    const whiteMove = moves[i] ? moveToChessComLAN(moves[i]) : '';
    const blackMove = moves[i + 1] ? moveToChessComLAN(moves[i + 1]) : '';
    pgnMoves.push(`${turn}. ${whiteMove}${blackMove ? ' ' + blackMove : ''}`.trim());
  }

  return headers.join('\n') + `\n\n` + pgnMoves.join(' ');
}
