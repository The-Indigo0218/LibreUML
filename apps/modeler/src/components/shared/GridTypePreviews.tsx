/** Tiny SVG previews for each GridType — used in the status bar picker and canvas widget. */

export function DotsPreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="currentColor">
      {([3, 11, 19] as number[]).flatMap((cx) =>
        ([3, 8, 13] as number[]).map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} opacity={0.75} />
        )),
      )}
    </svg>
  );
}

export function LinesPreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" stroke="currentColor" strokeWidth={0.9} fill="none" opacity={0.75}>
      <line x1={5}  y1={0} x2={5}  y2={16} />
      <line x1={11} y1={0} x2={11} y2={16} />
      <line x1={17} y1={0} x2={17} y2={16} />
      <line x1={0} y1={4}  x2={22} y2={4}  />
      <line x1={0} y1={9}  x2={22} y2={9}  />
      <line x1={0} y1={14} x2={22} y2={14} />
    </svg>
  );
}

export function GridPreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" stroke="currentColor" fill="none">
      <g opacity={0.3} strokeWidth={0.5}>
        {[4, 7, 15, 18].map((x) => <line key={`v${x}`} x1={x} y1={0} x2={x} y2={16} />)}
        {[4, 7, 12].map((y) => <line key={`h${y}`} x1={0} y1={y} x2={22} y2={y} />)}
      </g>
      <g opacity={0.7} strokeWidth={1}>
        <line x1={11} y1={0} x2={11} y2={16} />
        <line x1={0}  y1={8} x2={22} y2={8}  />
      </g>
    </svg>
  );
}

export function NonePreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
      <rect x={1} y={1} width={20} height={14} rx={2} stroke="currentColor" strokeWidth={1} opacity={0.4} strokeDasharray="3 2" />
    </svg>
  );
}
