"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

type Msg = { role: "pip" | "you"; text: string };

const GREETINGS = [
  "Hey. I am Pip, the unserious part of a serious rail.",
  "Psst. Money only moves when the fingerprint checks out. I just vibe.",
  "Welcome. I do not hold USDC. I hold opinions.",
];

const TIPS: { q: string; a: string }[] = [
  {
    q: "What is ClearAudit?",
    a: "A settlement rail: lock USDC on Arc, gate release on a live Arkiv fingerprint that expires in 30 days. Anyone can re-run the check.",
  },
  {
    q: "Why does evidence expire?",
    a: "Sensitive proofs should not live forever in someone else's database. Arkiv stops serving the fingerprint after thirty days. The chain still shows who got paid.",
  },
  {
    q: "Can I re-check a payout?",
    a: "Yes. Open /evidence with a deal # or a CA- ref. No wallet needed. That is the whole point.",
  },
  {
    q: "What is a CA- ref?",
    a: "A short public code cut from the Arkiv entity key, like CA-CB3C7A10-EF52. It appears once evidence is anchored.",
  },
  {
    q: "Who are you, really?",
    a: "Pip. Soft otter energy, zero custody. I cannot release escrow. I can tell you where the gate lives.",
  },
  {
    q: "Tell me something unserious.",
    a: "If your evidence is expired, even I cannot help, and I am a cartoon with a C badge.",
  },
];

/* -------------------------------------------------------------------------
   Puppet rig
   -------------------------------------------------------------------------
   The sprite layers are 512 x 512 with the character's feet on y = 496, so
   everything below is expressed as a fraction of the rendered stage and never
   has to know the pixel size. Feet rotate about their ankle, which is why the
   two origins differ: they are the top centre of each foot in canvas space.
------------------------------------------------------------------------- */

const FEET = {
  l: { origin: "37.30% 88.28%" },
  r: { origin: "64.16% 88.28%" },
} as const;

type Mode = "rest" | "walk";

type Sim = {
  x: number;
  dir: -1 | 1;
  speed: number;
  phase: number;
  target: number;
  mode: Mode;
  until: number;
  lean: number;
  leanUntil: number;
  turn: number;
  hovered: boolean;
};

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Pip, as a walking puppet.
 *
 * Three things make this read as a character rather than a picture that slides:
 * the feet are separate layers that lift on a phase shared with the travelled
 * distance, so the gait cannot skate; the body bobs and leans off the same
 * phase; and the sprite stays on one ground line instead of drifting up the
 * page. Blinks are painted in place, not a second pose, so nothing jumps.
 */
export default function MascotCompanion() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hidden, setHidden] = useState(false);
  const reduced = useReducedMotion();
  const [blinking, setBlinking] = useState(false);
  const [walking, setWalking] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footLRef = useRef<HTMLDivElement>(null);
  const footRRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const sim = useRef<Sim>({
    x: 0,
    dir: -1,
    speed: 0,
    phase: 0,
    target: 0,
    mode: "rest",
    until: 0,
    lean: 0,
    leanUntil: 0,
    turn: 0,
    hovered: false,
  });
  const size = useRef(104);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  /* Ground line -------------------------------------------------------- */

  const track = useCallback(() => {
    const width = window.innerWidth - size.current;
    return Math.max(0, width - 16);
  }, []);

  const rest = useCallback((now: number, min = 2400, max = 5200) => {
    const s = sim.current;
    s.mode = "rest";
    s.until = now + rand(min, max);
  }, []);

  const walk = useCallback(() => {
      const s = sim.current;
      const max = track();
      // Aim at least a third of the track away so a step sequence is visible.
      const reach = Math.max(90, max * 0.32);
      let next = s.x + (Math.random() < 0.5 ? -1 : 1) * rand(reach, max);
      if (next < 0 || next > max) next = s.x < max / 2 ? max - rand(0, max * 0.15) : rand(0, max * 0.15);
      s.target = clamp(next, 0, max);
      s.mode = "walk";
      s.until = 0;
    },
    [track],
  );

  /* Animation loop ----------------------------------------------------- */

  useEffect(() => {
    if (reduced || hidden) return;

    const measure = () => {
      const el = stageRef.current;
      if (el) size.current = el.offsetWidth || size.current;
      const max = track();
      if (sim.current.x > max) sim.current.x = max;
    };
    measure();

    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", measure);

    const s = sim.current;
    s.x = Math.max(0, track() - 8);
    s.target = s.x;
    rest(performance.now(), 1200, 2200);

    let raf = 0;
    let last = performance.now();
    let wasWalking = false;

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const sizeNow = size.current;
      const speedFor = sizeNow * 0.44; // px per second, a stroll
      const stepLength = sizeNow * 0.3; // px travelled per step
      // Small vertical travel on purpose: the foot pivots at its ankle, so most
      // of the visible lift comes from rotation and the leg never detaches.
      const lift = sizeNow * 0.03;

      // Pip stands still while the chat is open and while it is being hovered.
      if (openRef.current || s.hovered) {
        if (s.mode === "walk") rest(now, 800, 800);
        else s.until = now + 800;
      }
      if (s.mode === "rest" && now > s.until) walk();

      if (s.mode === "walk") {
        const remain = s.target - s.x;
        if (Math.abs(remain) < 1.5) {
          s.speed = 0;
          rest(now);
        } else {
          if (Math.sign(remain) !== s.dir) {
            s.dir = Math.sign(remain) as -1 | 1;
            s.turn = 1;
          }
          s.speed += (speedFor - s.speed) * Math.min(1, dt / 380);
          const dx = s.dir * s.speed * (dt / 1000);
          s.x = clamp(s.x + dx, 0, track());
          s.phase += Math.abs(dx) / stepLength;
        }
      } else {
        s.speed *= Math.pow(0.0015, dt / 1000);
        if (s.speed < 0.4) s.speed = 0;
      }

      // Occasional weight shift while standing: the smallest sign of life.
      if (s.mode === "rest" && now > s.leanUntil) {
        s.lean = Math.random() < 0.55 ? 0 : rand(-2.2, 2.2);
        s.leanUntil = now + rand(900, 2600);
      }
      s.turn = Math.max(0, s.turn - dt / 260);

      const moving = s.speed > 2;
      if (moving !== wasWalking) {
        wasWalking = moving;
        setWalking(moving);
      }

      // One full phase is a stride: one foot swings over the first half, the
      // other over the second. Only the swinging foot is ever off the ground.
      const p = s.phase % 1;
      const liftL = moving ? Math.max(0, Math.sin(2 * Math.PI * p)) : 0;
      const liftR = moving ? Math.max(0, Math.sin(2 * Math.PI * ((p + 0.5) % 1))) : 0;
      const swing = clamp(s.speed / speedFor, 0, 1);

      const bob = moving ? -Math.abs(Math.cos(Math.PI * p)) * sizeNow * 0.012 : 0;
      const breath = moving ? 0 : Math.sin(now / 1050) * 0.014;
      const lean = moving
        ? Math.sin(Math.PI * p) * 0.9 + s.dir * 0.5
        : s.lean * 0.5;

      if (rootRef.current) {
        rootRef.current.style.setProperty("--pip-x", `${s.x}px`);
      }
      if (figRef.current) {
        const face = s.dir === 1 ? -1 : 1;
        const squash = 1 - s.turn * 0.16;
        figRef.current.style.transform = `scaleX(${face * squash}) scaleY(${1 + s.turn * 0.08})`;
      }
      if (bodyRef.current) {
        bodyRef.current.style.transform = `translate3d(0, ${bob}px, 0) rotate(${lean}deg) scaleY(${1 + breath})`;
      }
      if (footLRef.current) {
        footLRef.current.style.transform = `translate3d(${-liftL * lift * 1.6}px, ${-liftL * lift}px, 0) rotate(${liftL * 16 * swing}deg)`;
      }
      if (footRRef.current) {
        footRRef.current.style.transform = `translate3d(${-liftR * lift * 1.6}px, ${-liftR * lift}px, 0) rotate(${liftR * 16 * swing}deg)`;
      }
      if (shadowRef.current) {
        const spread = 1 - (liftL + liftR) * 0.05;
        shadowRef.current.style.transform = `translateX(-50%) scaleX(${spread})`;
        shadowRef.current.style.opacity = `${0.42 - Math.abs(bob) * 0.03}`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [reduced, hidden, rest, walk, track]);

  /* Blink -------------------------------------------------------------- */

  useEffect(() => {
    if (hidden) return;
    let alive = true;
    let timer: number;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!alive) return;
        const double = Math.random() < 0.18;
        setBlinking(true);
        window.setTimeout(() => {
          setBlinking(false);
          if (double) {
            window.setTimeout(() => {
              setBlinking(true);
              window.setTimeout(() => setBlinking(false), 120);
            }, 180);
          }
        }, 130);
        schedule();
      }, rand(2600, 5600));
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [hidden]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [messages, reduced]);

  const openChat = useCallback(() => {
    const s = sim.current;
    s.mode = "rest";
    s.until = performance.now() + 9000;
    s.hovered = false;
    s.lean = 0;
    setOpen(true);
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [{ role: "pip", text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] }];
    });
  }, []);

  function ask(tip: (typeof TIPS)[number]) {
    setMessages((m) => [...m, { role: "you", text: tip.q }, { role: "pip", text: tip.a }]);
  }

  if (hidden) {
    return (
      <button
        type="button"
        className="mascot-restore"
        onClick={() => setHidden(false)}
        aria-label="Show Pip the mascot"
      >
        Pip
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`mascot-root ${open ? "is-open" : ""} ${walking ? "is-walking" : ""}`}
      onMouseEnter={() => {
        sim.current.hovered = true;
      }}
      onMouseLeave={() => {
        sim.current.hovered = false;
      }}
    >
      {open && (
        <div id={panelId} className="mascot-panel notice-enter" role="dialog" aria-label="Chat with Pip">
          <div className="mascot-panel-head">
            <div>
              <div className="mascot-eyebrow">Companion</div>
              <div className="mascot-name">Pip</div>
            </div>
            <div className="mascot-panel-actions">
              <button
                type="button"
                className="mascot-icon-btn"
                onClick={() => setHidden(true)}
                aria-label="Hide Pip"
                title="Hide"
              >
                −
              </button>
              <button
                type="button"
                className="mascot-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          <div className="mascot-transcript">
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`mascot-bubble ${m.role === "you" ? "is-you" : "is-pip"}`}>
                {m.text}
              </div>
            ))}
            <div ref={chatEnd} />
          </div>

          <div className="mascot-prompts">
            {TIPS.map((tip) => (
              <button key={tip.q} type="button" className="mascot-chip" onClick={() => ask(tip)}>
                {tip.q}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`mascot-avatar ${open ? "is-listening" : ""}`}
        onClick={() => (open ? setOpen(false) : openChat())}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close Pip" : "Chat with Pip"}
      >
        <span ref={stageRef} className="mascot-stage">
          <span ref={shadowRef} className="mascot-shadow" aria-hidden />
          <span ref={figRef} className="mascot-figure">
            <span ref={bodyRef} className="mascot-layer is-body">
              <Image src="/mascot/pip-body.png" alt="" fill sizes="112px" className="mascot-img" priority />
            </span>
            <span
              ref={footLRef}
              className="mascot-layer is-foot"
              style={{ transformOrigin: FEET.l.origin }}
            >
              <Image src="/mascot/pip-foot-l.png" alt="" fill sizes="112px" className="mascot-img" priority />
            </span>
            <span
              ref={footRRef}
              className="mascot-layer is-foot"
              style={{ transformOrigin: FEET.r.origin }}
            >
              <Image src="/mascot/pip-foot-r.png" alt="" fill sizes="112px" className="mascot-img" priority />
            </span>
            <span className={`mascot-layer is-blink ${blinking ? "is-on" : ""}`} aria-hidden>
              <Image src="/mascot/pip-blink.png" alt="" fill sizes="112px" className="mascot-img" />
            </span>
          </span>
          {!open && <span className="mascot-pulse" aria-hidden />}
        </span>
      </button>
    </div>
  );
}
