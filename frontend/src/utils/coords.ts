export function mapCoordFog(coord: string): string {
  if (!coord || coord.length < 2) return coord;
  const file = coord[0];
  const rankStr = coord.slice(1);
  const fileMapped = String.fromCharCode(file.charCodeAt(0) + 3);
  const rankMapped = (parseInt(rankStr, 10) + 3).toString();
  return `${fileMapped}${rankMapped}`;
}
