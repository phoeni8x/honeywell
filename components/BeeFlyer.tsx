"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FLAP = -8;
const GRAVITY = 0.5;
const MAX_FALL = 12;
const BEE_X = 110;
const BEE_R = 14;
const OB_W = 60;
const SPAWN_EVERY = 90;

function scrollSpeed(score: number): number {
  const base = 3 + Math.floor(score / 10) * 0.3;
  return Math.min(base, 6);
}

function gapForScore(score: number): number {
  const g = 160 - Math.floor(score / 15) * 5;
  return Math.max(120, g);
}

type Obstacle = { x: number; gapY: number; passed: boolean };

type GameState = "idle" | "playing" | "dead";

type BeeFlyerProps = {
  etaMinutes: number;
  onCheckMap: () => void;
  isPaused: boolean;
};

export default function BeeFlyer({ etaMinutes: _etaMinutes, onCheckMap, isPaused }: BeeFlyerProps) {
  void _etaMinutes;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef({
    state: "idle" as GameState,
    beeY: 0,
    beeVY: 0,
    score: 0,
    highScore: 0,
    obstacles: [] as Obstacle[],
    clouds: [] as { x: number; y: number; w: number; h: number }[],
    flowers: [] as { x: number; y: number }[],
    stars: [] as { x: number; y: number; r: number }[],
    frame: 0,
    speed: 3,
    gapSize: 160,
    idlePhase: 0,
    flash: 0,
    width: 400,
    height: 600,
    dpr: 1,
  });
  const prevPausedRef = useRef(isPaused);
  const [countdown, setCountdown] = useState<number | "fly" | null>(null);
  const [highScoreDisplay, setHighScoreDisplay] = useState(0);

  const isPausedRef = useRef(isPaused);
  const countdownRef = useRef<number | "fly" | null>(null);
  isPausedRef.current = isPaused;
  countdownRef.current = countdown;

  useEffect(() => {
    const h = parseInt(typeof window !== "undefined" ? localStorage.getItem("beeflyer_highscore") || "0" : "0", 10);
    gameStateRef.current.highScore = h;
    setHighScoreDisplay(h);
  }, []);

  useEffect(() => {
    if (prevPausedRef.current && !isPaused) {
      setCountdown(3);
    }
    prevPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === "fly") {
      const t = window.setTimeout(() => setCountdown(null), 500);
      return () => clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setCountdown((c) => {
        if (c === null || c === "fly") return c;
        if (c <= 1) return "fly";
        return c - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = containerRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const gs = gameStateRef.current;
    gs.width = w;
    gs.height = h;
    gs.dpr = dpr;
    if (gs.state === "idle" && gs.beeY === 0) {
      gs.beeY = h * 0.45;
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  function initBackground(w: number, h: number) {
    const gs = gameStateRef.current;
    if (gs.stars.length === 0) {
      for (let i = 0; i < 48; i++) {
        gs.stars.push({ x: Math.random() * w, y: Math.random() * h * 0.55, r: Math.random() * 1.2 + 0.3 });
      }
    }
    while (gs.clouds.length < 6) {
      gs.clouds.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.45,
        w: 40 + Math.random() * 60,
        h: 14 + Math.random() * 10,
      });
    }
    while (gs.flowers.length < 10) {
      gs.flowers.push({
        x: Math.random() * w,
        y: h * 0.35 + Math.random() * h * 0.5,
      });
    }
  }

  const resetGame = useCallback(() => {
    const gs = gameStateRef.current;
    const { width, height } = gs;
    gs.state = "playing";
    gs.beeY = height * 0.42;
    gs.beeVY = 0;
    gs.score = 0;
    gs.obstacles = [];
    gs.frame = 0;
    gs.speed = scrollSpeed(0);
    gs.gapSize = gapForScore(0);
    gs.flash = 0;
  }, []);

  const handleInput = useCallback(() => {
    if (isPausedRef.current || countdownRef.current !== null) return;
    const gs = gameStateRef.current;
    if (gs.state === "idle") {
      resetGame();
      return;
    }
    if (gs.state === "playing") {
      gs.beeVY = FLAP;
    }
  }, [resetGame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleInput]);

  useEffect(() => {
    let stopped = false;

    const drawHoneyWall = (ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) => {
      ctx.fillStyle = "#f5a800";
      ctx.fillRect(x, y0, OB_W, y1 - y0);
      ctx.strokeStyle = "#0d0d00";
      ctx.lineWidth = 1;
      for (let yy = y0; yy < y1; yy += 12) {
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + OB_W, yy);
        ctx.stroke();
      }
      for (let xx = 0; xx <= OB_W; xx += 10) {
        ctx.beginPath();
        ctx.moveTo(x + xx, y0);
        ctx.lineTo(x + xx, y1);
        ctx.stroke();
      }
    };

    const drawBee = (ctx: CanvasRenderingContext2D, x: number, y: number, vy: number, sad: boolean) => {
      const tilt = Math.max(-0.5, Math.min(0.6, vy * 0.04));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = "#0d0d00";
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f5a800";
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-22, -14);
      ctx.lineTo(-8, -12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.lineTo(22, -14);
      ctx.lineTo(8, -12);
      ctx.closePath();
      ctx.fill();
      if (sad) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, -4);
        ctx.lineTo(10, 2);
        ctx.moveTo(10, -4);
        ctx.lineTo(4, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, -4);
        ctx.lineTo(18, 2);
        ctx.moveTo(18, -4);
        ctx.lineTo(12, 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#0d0d00";
        ctx.beginPath();
        ctx.arc(6, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, -2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBackground = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0d0d00");
      g.addColorStop(1, "#1a1400");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const gs = gameStateRef.current;
      gs.stars.forEach((s) => {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      gs.clouds.forEach((c) => {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.w, c.h, 8);
        ctx.fill();
      });

      gs.flowers.forEach((f) => {
        ctx.fillStyle = "rgba(255, 120, 180, 0.55)";
        ctx.beginPath();
        ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const loop = () => {
      if (stopped) return;
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) {
        if (!stopped) requestAnimationFrame(loop);
        return;
      }

      const gs = gameStateRef.current;
      const dpr = gs.dpr;
      const w = gs.width;
      const h = gs.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initBackground(w, h);

      const paused = isPausedRef.current || countdownRef.current !== null;
      if (!paused && countdownRef.current === null) {
        gs.speed = scrollSpeed(gs.score);
        gs.gapSize = gapForScore(gs.score);

        if (gs.state === "idle") {
          gs.idlePhase += 0.04;
          gs.beeY = h * 0.45 + Math.sin(gs.idlePhase) * 14;
        }

        if (gs.state === "playing") {
          gs.frame += 1;
          gs.beeVY = Math.min(MAX_FALL, gs.beeVY + GRAVITY);
          gs.beeY += gs.beeVY;

          gs.clouds.forEach((cl) => {
            cl.x -= 0.5;
            if (cl.x + cl.w < 0) cl.x = w + Math.random() * 80;
          });
          gs.flowers.forEach((f) => {
            f.x -= 1;
            if (f.x < -10) f.x = w + Math.random() * 100;
          });

          if (gs.frame % SPAWN_EVERY === 0) {
            const margin = 80;
            const gapY = margin + Math.random() * (h - margin * 2);
            gs.obstacles.push({ x: w + OB_W, gapY, passed: false });
          }

          gs.obstacles.forEach((o) => {
            o.x -= gs.speed;
          });
          gs.obstacles = gs.obstacles.filter((o) => o.x > -OB_W - 20);

          gs.obstacles.forEach((o) => {
            if (!o.passed && BEE_X > o.x + OB_W) {
              o.passed = true;
              gs.score += 1;
            }
          });

          const hitFloor = gs.beeY + BEE_R > h - 4;
          const hitCeil = gs.beeY - BEE_R < 4;
          let hitObs = false;
          const gap = gs.gapSize;
          gs.obstacles.forEach((o) => {
            const overlapX = BEE_X + BEE_R > o.x && BEE_X - BEE_R < o.x + OB_W;
            if (!overlapX) return;
            const topH = o.gapY - gap / 2;
            const botY = o.gapY + gap / 2;
            if (gs.beeY - BEE_R < topH || gs.beeY + BEE_R > botY) hitObs = true;
          });

          if (hitFloor || hitCeil || hitObs) {
            gs.state = "dead";
            gs.flash = 18;
            if (gs.score > gs.highScore) {
              gs.highScore = gs.score;
              try {
                localStorage.setItem("beeflyer_highscore", String(gs.highScore));
              } catch {
                /* ignore */
              }
              setHighScoreDisplay(gs.highScore);
            }
          }
        }

        if (gs.flash > 0) gs.flash -= 1;
      }

      if (gs.flash > 0 && gs.state === "dead") {
        ctx.fillStyle = `rgba(255, 0, 0, ${gs.flash * 0.04})`;
        ctx.fillRect(0, 0, w, h);
      }

      drawBackground(ctx, w, h);

      gs.obstacles.forEach((o) => {
        const gap = gs.gapSize;
        const mid = o.gapY;
        drawHoneyWall(ctx, o.x, 0, mid - gap / 2);
        drawHoneyWall(ctx, o.x, mid + gap / 2, h);
      });

      const sad = gs.state === "dead";
      drawBee(ctx, BEE_X, gs.beeY, gs.beeVY, sad);

      ctx.font = "600 22px Cinzel, Georgia, serif";
      ctx.fillStyle = "#f5a800";
      ctx.textAlign = "left";
      ctx.fillText(`Score ${gs.score}`, 16, 36);
      ctx.font = "500 16px Cinzel, Georgia, serif";
      ctx.fillText(`Best: ${gs.highScore}`, 16, 58);

      if (gs.state === "idle") {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = "600 26px Cinzel, Georgia, serif";
        ctx.fillStyle = "#f5a800";
        ctx.textAlign = "center";
        ctx.fillText("Tap to fly!", w / 2, h * 0.38);
        ctx.font = "16px DM Sans, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,248,220,0.9)";
        ctx.fillText("Your order is on the way. Keep yourself busy!", w / 2, h * 0.46);
      }

      if (gs.state === "dead") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = "600 28px Cinzel, Georgia, serif";
        ctx.fillStyle = "#f5a800";
        ctx.textAlign = "center";
        ctx.fillText("Buzzed out!", w / 2, h * 0.36);
        ctx.font = "18px DM Sans, system-ui, sans-serif";
        ctx.fillStyle = "#fff8dc";
        ctx.fillText(`Score ${gs.score} · Best ${gs.highScore}`, w / 2, h * 0.44);

        const bw = 130;
        const bh = 44;
        const y0 = h * 0.52;
        ctx.fillStyle = "#f5a800";
        ctx.strokeStyle = "#c47f00";
        ctx.lineWidth = 2;
        ctx.fillRect(w / 2 - bw - 16, y0, bw, bh);
        ctx.strokeRect(w / 2 - bw - 16, y0, bw, bh);
        ctx.fillStyle = "#0d0d00";
        ctx.font = "600 14px DM Sans, system-ui, sans-serif";
        ctx.fillText("Try Again", w / 2 - 16 - bw / 2, y0 + 28);

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.strokeStyle = "#f5a800";
        ctx.fillRect(w / 2 + 16, y0, bw, bh);
        ctx.strokeRect(w / 2 + 16, y0, bw, bh);
        ctx.fillStyle = "#f5a800";
        ctx.fillText("Check Map", w / 2 + 16 + bw / 2, y0 + 28);
      }

      const cd = countdownRef.current;
      if (cd !== null) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = "700 56px Cinzel, Georgia, serif";
        ctx.fillStyle = "#f5a800";
        ctx.textAlign = "center";
        const label = cd === "fly" ? "Fly!" : String(cd);
        ctx.fillText(label, w / 2, h / 2);
      }

      if (!stopped) requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => {
      stopped = true;
    };
  }, []);

  const onPointer = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gs = gameStateRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = ("touches" in e ? e.touches[0]?.clientX : e.clientX) ?? 0;
    const cy = ("touches" in e ? e.touches[0]?.clientY : e.clientY) ?? 0;
    const x = cx - rect.left;
    const y = cy - rect.top;

    if (gs.state === "dead") {
      const bw = 130;
      const bh = 44;
      const y0 = gs.height * 0.52;
      const mid = gs.width / 2;
      if (y >= y0 && y <= y0 + bh) {
        if (x >= mid - bw - 16 && x <= mid - 16) {
          resetGame();
          return;
        }
        if (x >= mid + 16 && x <= mid + 16 + bw) {
          onCheckMap();
          return;
        }
      }
      return;
    }
    handleInput();
  };

  return (
    <div ref={containerRef} className="relative h-full min-h-[200px] w-full flex-1 touch-none">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onClick={onPointer}
        onTouchStart={(e) => {
          e.preventDefault();
          onPointer(e);
        }}
        role="presentation"
      />
      <span className="sr-only">Bee Flyer mini-game. Best score {highScoreDisplay}.</span>
    </div>
  );
}
