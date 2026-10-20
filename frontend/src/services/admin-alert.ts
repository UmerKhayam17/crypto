type AlertPayload = {
  title?: string;
  body?: string;
};

let audioCtx: AudioContext | null = null;
let armed = false;

function audioContext(): AudioContext | null {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function unlockAudio() {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Short two-tone beep. Browsers only allow sound after the admin has clicked the page once. */
export function playAdminBeep() {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(1175, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

export function showAdminDesktopAlert(payload: AlertPayload) {
  const title = payload.title?.trim() || "Evios admin";
  const body = payload.body?.trim() || "New activity needs your attention";
  playAdminBeep();
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const notice = new Notification(title, { body, silent: true });
    notice.onclick = () => {
      window.focus();
      notice.close();
    };
  } catch {
    // notification may be blocked by the browser
  }
}

/** Ask for desktop notification permission and unlock the beep on the first click. */
export function armAdminDesktopAlerts(): () => void {
  if (armed || typeof window === "undefined") return () => {};
  armed = true;

  const ask = () => {
    unlockAudio();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  window.addEventListener("pointerdown", ask);
  window.addEventListener("keydown", ask);
  ask();

  return () => {
    window.removeEventListener("pointerdown", ask);
    window.removeEventListener("keydown", ask);
    armed = false;
  };
}
