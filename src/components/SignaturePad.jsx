// SignaturePad.jsx -- hand-built draw-to-sign canvas for the front-desk
// tablet (finger or stylus) and a mouse on a laptop. Pointer events cover all
// three; touch-action:none stops the page from scrolling under the stroke.
// The canvas backing store is sized to devicePixelRatio so the line stays
// crisp on a retina tablet, and strokes are kept as points so a resize can
// redraw them instead of losing the signature.
//
// The pad is always a white "paper" with dark ink, in both themes, because
// the PNG it exports goes on the printed/PDF form.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "../lib/cn.js";

const INK = "#0F172A";
const LINE_WIDTH = 2.5;

const SignaturePad = forwardRef(function SignaturePad({ onChange, label, placeholder, className }, ref) {
  const canvasRef = useRef(null);
  const [empty, setEmpty] = useState(true);
  const strokes = useRef([]);
  const drawing = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokes.current.forEach((pts) => {
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    });
  }, []);

  // Match the backing store to the rendered size (and keep it matched).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    function fit() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      redraw();
    }
    fit();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([point(e)]);
    setEmpty(false);
    redraw();
  }
  function onPointerMove(e) {
    if (!drawing.current) return;
    e.preventDefault();
    strokes.current[strokes.current.length - 1].push(point(e));
    redraw();
  }
  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (onChange) onChange(true);
  }

  useImperativeHandle(ref, () => ({
    clear() {
      strokes.current = [];
      setEmpty(true);
      redraw();
      if (onChange) onChange(false);
    },
    isEmpty() {
      return strokes.current.length === 0;
    },
    // A tight PNG of just the ink (white background), so the signature
    // sits on the form's signature line without a big empty margin.
    toDataURL() {
      const all = strokes.current.flat();
      if (!all.length) return "";
      const pad = 8;
      const xs = all.map((p) => p.x);
      const ys = all.map((p) => p.y);
      const minX = Math.max(0, Math.min(...xs) - pad);
      const minY = Math.max(0, Math.min(...ys) - pad);
      const w = Math.max(...xs) + pad - minX;
      const h = Math.max(...ys) + pad - minY;
      const scale = 2;
      const out = document.createElement("canvas");
      out.width = Math.round(w * scale);
      out.height = Math.round(h * scale);
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      strokes.current.forEach((pts) => {
        ctx.beginPath();
        if (pts.length === 1) {
          ctx.arc(pts[0].x, pts[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      });
      return out.toDataURL("image/png");
    },
  }), [onChange, redraw]);

  return (
    <div className={cn("relative overflow-hidden rounded-control border border-line-strong bg-white", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="block h-48 w-full cursor-crosshair touch-none select-none sm:h-56"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {empty && placeholder ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-12 text-center text-body text-slate-500">{placeholder}</span>
      ) : null}
      {/* The signature line, drawn under the ink (pointer-events off). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-300" />
    </div>
  );
});

export default SignaturePad;
