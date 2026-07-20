"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_CONSENT } from "@/lib/esign";

type Props = {
  clientName: string;
  loading?: boolean;
  onSubmit: (payload: {
    typedName: string;
    agreedToElectronicSignature: true;
    signatureDataUrl: string | null;
    consentText: string;
  }) => Promise<void>;
};

export function SignaturePad({ clientName, loading, onSubmit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [typedName, setTypedName] = useState(clientName);
  const [agreed, setAgreed] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState("");

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = Math.min(parent?.clientWidth || 480, 560);
    const height = 160;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const onPointerUp = () => {
    drawing.current = false;
  };

  const clear = () => resizeCanvas();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("You must agree to the electronic signature disclosure");
      return;
    }
    if (typedName.trim().length < 2) {
      setError("Type your full legal name");
      return;
    }

    let dataUrl: string | null = null;
    if (hasInk && canvasRef.current) {
      dataUrl = canvasRef.current.toDataURL("image/png");
    }

    try {
      await onSubmit({
        typedName: typedName.trim(),
        agreedToElectronicSignature: true,
        signatureDataUrl: dataUrl,
        consentText: DEFAULT_CONSENT,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signature failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Full legal name
        </label>
        <Input
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={clientName}
          required
          autoComplete="name"
        />
        <p className="text-xs text-slate-500 mt-1">
          Must match the name on your account ({clientName})
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-slate-700">
            Draw signature <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <button
            type="button"
            onClick={clear}
            className="text-xs text-navy-700 hover:underline"
          >
            Clear pad
          </button>
        </div>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair block"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 rounded border-slate-300"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>{DEFAULT_CONSENT}</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        Sign & authorize filing
      </Button>
    </form>
  );
}
