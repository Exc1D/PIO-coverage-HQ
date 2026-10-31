"use client";

import {
  ArrowUpRightIcon,
  CircleIcon,
  ClipboardCopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ImageUpIcon,
  LinkIcon,
  MinusIcon,
  PencilIcon,
  Redo2Icon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { manilaDate } from "@/lib/time";
import {
  arrowHead,
  boxOf,
  exportFileName,
  isTooSmall,
  strokeUnit,
  toImagePoint,
  type Point,
  type Shape,
  type Tool,
} from "@/lib/typhoon";
import { cn } from "@/lib/utils";

const TOOLS: { id: Tool; label: string; icon: LucideIcon; key: string }[] = [
  { id: "pen", label: "Pen", icon: PencilIcon, key: "p" },
  { id: "arrow", label: "Arrow", icon: ArrowUpRightIcon, key: "a" },
  { id: "line", label: "Line", icon: MinusIcon, key: "l" },
  { id: "ellipse", label: "Circle", icon: CircleIcon, key: "c" },
  { id: "rect", label: "Box", icon: SquareIcon, key: "b" },
  { id: "text", label: "Text", icon: TypeIcon, key: "t" },
];

const COLORS = [
  { value: "#dc2626", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#facc15", label: "Yellow" },
  { value: "#16a34a", label: "Green" },
  { value: "#2563eb", label: "Blue" },
  { value: "#111827", label: "Black" },
  { value: "#ffffff", label: "White" },
];

/** Stroke widths in strokeUnit()s, so they look the same on any image size. */
const WIDTHS = [
  { value: 3, label: "Thin" },
  { value: 6, label: "Medium" },
  { value: 11, label: "Thick" },
];

const PAGASA_URL = "https://www.panahon.gov.ph/";

type Base = { image: HTMLImageElement; url: string; name: string };
/** Text being typed; `scale` is screen pixels per image pixel, to size the box like the drawn text. */
type TextDraft = { at: Point; value: string; scale: number };

export function TrackAnnotator() {
  const [base, setBase] = useState<Base | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [undone, setUndone] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(WIDTHS[1].value);
  const [outline, setOutline] = useState(true);
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const unit = base ? strokeUnit(base.image.naturalWidth, base.image.naturalHeight) : 1;

  // Redraw the whole picture whenever anything on it changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !base) return;
    const { naturalWidth: w, naturalHeight: h } = base.image;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(base.image, 0, 0, w, h);
    for (const s of draft ? [...shapes, draft] : shapes) drawShape(ctx, s, unit, outline);
  }, [base, shapes, draft, unit, outline]);

  // Free the previous image's object URL when it's replaced.
  useEffect(() => () => {
    if (base) URL.revokeObjectURL(base.url);
  }, [base]);

  const loadBlob = async (blob: Blob, name: string) => {
    if (!blob.type.startsWith("image/") || blob.type === "image/svg+xml") {
      toast.error("That file isn't a PNG, JPEG, GIF or WebP image.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      toast.error("Couldn't open that image.");
      return;
    }
    setBase({ image, url, name });
    setShapes([]);
    setUndone([]);
    setDraft(null);
    setTextDraft(null);
  };

  const loadLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!link.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/typhoon/image?${new URLSearchParams({ url: link.trim() })}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "Couldn't load that image.");
        return;
      }
      await loadBlob(await res.blob(), link.trim());
      setLink("");
    } catch {
      toast.error("Couldn't load that image. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const commit = (shape: Shape) => {
    if (isTooSmall(shape, unit)) return;
    setShapes((prev) => [...prev, shape]);
    setUndone([]);
  };

  const undo = () => {
    if (shapes.length === 0) return;
    setUndone((u) => [...u, shapes[shapes.length - 1]]);
    setShapes((s) => s.slice(0, -1));
  };

  const redo = () => {
    if (undone.length === 0) return;
    setShapes((s) => [...s, undone[undone.length - 1]]);
    setUndone((u) => u.slice(0, -1));
  };

  const clear = () => {
    if (shapes.length === 0) return;
    const before = shapes;
    setShapes([]);
    setUndone([]);
    toast("Drawing cleared", { action: { label: "Undo", onClick: () => setShapes(before) } });
  };

  // Paste an image from the clipboard; keyboard shortcuts for undo/redo and tools.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      void loadBlob(file, "Pasted image");
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (!mod && !e.altKey) {
        const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
        if (t) setTool(t.id);
      }
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  });

  const pointAt = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return toImagePoint({ x: e.clientX, y: e.clientY }, rect, { width: e.currentTarget.width, height: e.currentTarget.height });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!base || e.button !== 0) return;
    const p = pointAt(e);
    if (tool === "text") {
      // Let the click land before focusing the new box, or it blurs at once.
      e.preventDefault();
      commitText();
      setTextDraft({ at: p, value: "", scale: e.currentTarget.getBoundingClientRect().width / e.currentTarget.width });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const style = { color, width };
    setDraft(tool === "pen" ? { kind: "pen", points: [p], ...style } : { kind: tool, a: p, b: p, ...style });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;
    const p = pointAt(e);
    setDraft(draft.kind === "pen" ? { ...draft, points: [...draft.points, p] } : draft.kind === "text" ? draft : { ...draft, b: p });
  };

  const onPointerUp = () => {
    if (!draft) return;
    commit(draft);
    setDraft(null);
  };

  const commitText = () => {
    if (!textDraft) return;
    commit({ kind: "text", at: textDraft.at, text: textDraft.value, color, width });
    setTextDraft(null);
  };

  const toBlob = () =>
    new Promise<Blob>((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error("no canvas"));
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), "image/png");
    });

  const download = async () => {
    commitText();
    try {
      const blob = await toBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = exportFileName(manilaDate(new Date()));
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      toast.error("Couldn't export the image.");
    }
  };

  const copy = async () => {
    commitText();
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob() })]);
      toast.success("Copied. Paste it into your graphic or post.");
    } catch {
      toast.error("This browser can't copy images. Use Download instead.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) void loadBlob(file, file.name);
  };

  const filePicker = (
    <input
      ref={fileRef}
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void loadBlob(file, file.name);
        e.target.value = "";
      }}
    />
  );

  const linkForm = (
    <form onSubmit={loadLink} className="flex w-full max-w-xl gap-2">
      <label htmlFor="track-link" className="sr-only">
        PAGASA image link
      </label>
      <Input
        id="track-link"
        type="url"
        inputMode="url"
        placeholder="Paste a PAGASA image link (https://…)"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" variant="outline" disabled={loading || !link.trim()}>
        <LinkIcon aria-hidden /> {loading ? "Loading…" : "Load"}
      </Button>
    </form>
  );

  if (!base) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="grid justify-items-center gap-4 rounded-xl border-2 border-dashed px-4 py-12 text-center"
      >
        {filePicker}
        <ImageUpIcon aria-hidden className="size-10 text-muted-foreground" />
        <div className="grid gap-1">
          <p className="font-medium">Start with PAGASA&apos;s latest track map</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Open{" "}
            <a href={PAGASA_URL} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
              panahon.gov.ph <ExternalLinkIcon aria-hidden className="inline size-3.5 align-[-2px]" />
            </a>
            , then copy the track image and paste it here (Ctrl+V), drop a saved image on this box, or paste the image&apos;s link below.
          </p>
        </div>
        <Button onClick={() => fileRef.current?.click()}>
          <ImageUpIcon aria-hidden /> Choose image
        </Button>
        {linkForm}
      </div>
    );
  }

  const textSize = textPx(width * unit);

  return (
    <div className="grid gap-3" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {filePicker}
      {/* Toolbar */}
      <div className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-30 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background/90 px-4 py-2 backdrop-blur sm:top-[calc(3.5rem+env(safe-area-inset-top))] print:hidden">
        <div role="radiogroup" aria-label="Tool" className="inline-flex rounded-[9px] bg-foreground/[0.06] p-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tool === t.id}
              title={`${t.label} (${t.key.toUpperCase()})`}
              onClick={() => setTool(t.id)}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tool === t.id && "bg-background text-foreground shadow-[0_3px_8px_rgb(0_0_0/0.12)]",
              )}
            >
              <t.icon aria-hidden className="size-4" />
              <span className="sr-only">{t.label}</span>
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Colour" className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => setColor(c.value)}
              style={{ backgroundColor: c.value }}
              className={cn(
                "size-6 rounded-full border border-black/20 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                color === c.value && "scale-110 ring-2 ring-foreground ring-offset-2",
              )}
            />
          ))}
        </div>

        <div role="radiogroup" aria-label="Line width" className="inline-flex rounded-[9px] bg-foreground/[0.06] p-0.5">
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              role="radio"
              aria-checked={width === w.value}
              title={w.label}
              onClick={() => setWidth(w.value)}
              className={cn(
                "inline-flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                width === w.value && "bg-background shadow-[0_3px_8px_rgb(0_0_0/0.12)]",
              )}
            >
              <span aria-hidden className="rounded-full bg-foreground" style={{ width: 18, height: Math.round(w.value / 2) + 1 }} />
              <span className="sr-only">{w.label}</span>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} className="size-4 accent-foreground" />
          White edge
        </label>

        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={undo} disabled={shapes.length === 0} title="Undo (Ctrl+Z)">
            <Undo2Icon aria-hidden />
            <span className="sr-only">Undo</span>
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={redo} disabled={undone.length === 0} title="Redo (Ctrl+Shift+Z)">
            <Redo2Icon aria-hidden />
            <span className="sr-only">Redo</span>
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={clear} disabled={shapes.length === 0} title="Clear drawing">
            <Trash2Icon aria-hidden />
            <span className="sr-only">Clear drawing</span>
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageUpIcon aria-hidden /> New image
          </Button>
          <Button size="sm" variant="outline" onClick={copy}>
            <ClipboardCopyIcon aria-hidden /> Copy
          </Button>
          <Button size="sm" onClick={download}>
            <DownloadIcon aria-hidden /> Download PNG
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg border bg-muted">
        <canvas
          ref={canvasRef}
          aria-label={`Track map: ${base.name}. Drag on it to draw.`}
          className={cn("block h-auto w-full touch-none select-none", tool === "text" ? "cursor-text" : "cursor-crosshair")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDraft(null)}
        />
        {textDraft && (
          <input
            autoFocus
            aria-label="Text to add"
            value={textDraft.value}
            onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") setTextDraft(null);
            }}
            onBlur={commitText}
            placeholder="Type, then Enter"
            className="absolute -translate-y-1/2 rounded border border-dashed border-foreground/40 bg-white/70 px-1 font-bold outline-none"
            style={{
              left: `${(textDraft.at.x / base.image.naturalWidth) * 100}%`,
              top: `${(textDraft.at.y / base.image.naturalHeight) * 100}%`,
              color,
              fontSize: textSize * textDraft.scale,
              minWidth: "8rem",
            }}
          />
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Source: PAGASA ·{" "}
        <a href={PAGASA_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          panahon.gov.ph
        </a>{" "}
        · Credit PAGASA when you post the map.
      </p>
    </div>
  );
}

/** Font size for text drawn at a given stroke width (image pixels). */
const textPx = (lineWidth: number) => Math.max(14, lineWidth * 4.5);

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, unit: number, outline: boolean) {
  const lw = s.width * unit;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (s.kind === "text") {
    const size = textPx(lw);
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    if (outline) {
      ctx.lineWidth = size / 5;
      ctx.strokeStyle = s.color === "#ffffff" ? "#111827" : "#ffffff";
      ctx.strokeText(s.text, s.at.x, s.at.y);
    }
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.at.x, s.at.y);
    return;
  }

  const trace = () => {
    ctx.beginPath();
    if (s.kind === "pen") {
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
      if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.01, s.points[0].y);
    } else if (s.kind === "line" || s.kind === "arrow") {
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      if (s.kind === "arrow") {
        const head = arrowHead(s.a, s.b, Math.max(lw * 4, 12 * unit));
        if (head.length) {
          ctx.moveTo(head[0].x, head[0].y);
          ctx.lineTo(s.b.x, s.b.y);
          ctx.lineTo(head[1].x, head[1].y);
        }
      }
    } else {
      const box = boxOf(s.a, s.b);
      if (s.kind === "rect") ctx.rect(box.x, box.y, box.w, box.h);
      else ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
    }
  };

  if (outline) {
    trace();
    ctx.lineWidth = lw + 4 * unit;
    ctx.strokeStyle = s.color === "#ffffff" ? "#111827" : "#ffffff";
    ctx.stroke();
  }
  trace();
  ctx.lineWidth = lw;
  ctx.strokeStyle = s.color;
  ctx.stroke();
}
