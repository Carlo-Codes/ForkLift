// The Plan editor row whose editor is open after a tap on `tapped`: one row
// is open at a time, so a tap opens that row (closing any other), and a tap
// on the open row closes it.
export function openRowAfterTap(open: string | undefined, tapped: string): string | undefined {
  return open === tapped ? undefined : tapped;
}
