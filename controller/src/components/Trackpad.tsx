import { useRef } from "react";

type TrackpadProps = {
  onMove: (dx: number, dy: number) => void;
  onClick: () => void;
  onRightClick: () => void;
  onScroll: (dx: number, dy: number) => void;
};

export function Trackpad({ onMove, onClick, onRightClick, onScroll }: TrackpadProps) {
  const last = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  return (
    <div
      className="trackpad"
      role="application"
      aria-label="Trackpad"
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick();
      }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        last.current = { x: e.clientX, y: e.clientY };
        moved.current = false;
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;

        if (pointers.current.size >= 2) {
          const pts = [...pointers.current.values()];
          const prevAvgY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const next = [...pointers.current.values()];
          const avgY = next.reduce((s, p) => s + p.y, 0) / next.length;
          const dy = Math.round((avgY - prevAvgY) / 8);
          if (dy !== 0) onScroll(0, -dy);
          return;
        }

        const prev = last.current;
        if (!prev) return;
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          moved.current = true;
          onMove(dx * 1.6, dy * 1.6);
          last.current = { x: e.clientX, y: e.clientY };
        }
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (!moved.current && pointers.current.size === 0) {
          onClick();
        }
        last.current = null;
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        last.current = null;
      }}
    >
      <span className="trackpad-hint">Drag to move · Tap to click · Two fingers scroll</span>
    </div>
  );
}
