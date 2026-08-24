import { useCallback, useRef } from 'react';

// Shared pointer-drawing logic for the kana canvases (free-form writing
// practice + the handwriting quiz). Captures raw stroke point sequences in
// canvas-pixel space, so the same stroke data can be rendered as ink,
// persisted to the backend, and fed to shape recognition without three
// separate copies of the pointer-event plumbing.
export function useKanaCanvas(canvasRef, penSize = 10) {
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const drawingRef = useRef(false);

  const getPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, [canvasRef]);

  const setInkStyle = useCallback((ctx) => {
    ctx.strokeStyle = '#262421';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = penSize;
  }, [penSize]);

  const pointerDown = useCallback((e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [getPoint(e)];
  }, [canvasRef, getPoint]);

  const pointerMove = useCallback((e) => {
    if (!drawingRef.current) return;
    const pt = getPoint(e);
    currentStrokeRef.current.push(pt);
    const ctx = canvasRef.current.getContext('2d');
    const stroke = currentStrokeRef.current;
    const n = stroke.length;
    if (n >= 2) {
      setInkStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(stroke[n - 2].x, stroke[n - 2].y);
      ctx.lineTo(stroke[n - 1].x, stroke[n - 1].y);
      ctx.stroke();
    }
  }, [canvasRef, getPoint, setInkStyle]);

  const pointerUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentStrokeRef.current?.length > 0) strokesRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
  }, []);

  const clearStrokes = useCallback(() => {
    strokesRef.current = [];
  }, []);

  const undoStroke = useCallback(() => {
    strokesRef.current.pop();
  }, []);

  const drawInkStrokes = useCallback((ctx) => {
    setInkStyle(ctx);
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }, [setInkStyle]);

  return { strokesRef, pointerDown, pointerMove, pointerUp, clearStrokes, undoStroke, drawInkStrokes };
}
