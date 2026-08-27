import { useEffect, useState } from "react";
import PublicLayout from "../layouts/PublicLayout";
import HomeColumns from "../components/home/HomeColumns";
import { useAuth } from "../context/AuthContext";

// Greeting for 24/7 shift operation
function getGreeting(h) {
  // กะเช้า: 08:00 - 20:00 (h >= 8 && h < 20)
  if (h >= 8 && h < 20) {
    if (h < 12) return { th: 'สวัสดีตอนเช้า',  sub: 'Good morning',   shift: 'กะเช้า',  icon: '🌅' }
    if (h < 13) return { th: 'สวัสดีตอนเที่ยง', sub: 'Good noon',      shift: 'กะเช้า',  icon: '☀️' }
    if (h < 17) return { th: 'สวัสดีตอนบ่าย',   sub: 'Good afternoon', shift: 'กะเช้า',  icon: '🌤️' }
    return             { th: 'สวัสดีตอนเย็น',   sub: 'Good evening',   shift: 'กะเช้า',  icon: '🌆' }
  }
  // กะดึก: 20:00 - 08:00 (h >= 20 || h < 8)
  if (h >= 20 && h < 24) {
    return             { th: 'สวัสดีตอนค่ำ',    sub: 'Good night',     shift: 'กะดึก',   icon: '🌙' }
  }
  if (h >= 5 && h < 8) {
    return             { th: 'สวัสดีตอนเช้าตรู่', sub: 'Early morning',   shift: 'กะดึก',   icon: '🌅' }
  }
  return               { th: 'สวัสดีตอนดึก',    sub: 'Late night shift', shift: 'กะดึก',   icon: '🌃' }
}

const THAI_DAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatThaiDate(d) {
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} / ${d.getFullYear()}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export default function HomePage() {
  const { user } = useAuth();
  const greetingName = ""; // user?.displayName || user?.username || ''

  // Live clock — updates every second
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const g = getGreeting(now.getHours());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 animate-fade-in">
        {/* ───── Welcome + Live Clock ───── */}
        <div className="mb-5">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-navy-700 text-white shadow-xl min-h-[200px] flex items-center">
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full bg-accent-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-sky-400/10 blur-3xl" />

            {/* Subtle grid pattern */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-5 px-5 sm:px-6 lg:px-8 py-5 w-full items-center">
              {/* Left — Greeting */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                {/* Top badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-accent-300 text-[10px] sm:text-xs font-mono mb-3 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse-slow" />
                  Centralized Information Access
                </div>

                {/* Title */}
                <h1 className="font-display text-white font-bold leading-tight flex flex-wrap items-center gap-x-3">
                  <span className="text-2xl sm:text-3xl lg:text-4xl">
                    {g.th}
                  </span>

                  <span className="text-2xl sm:text-3xl lg:text-4xl">
                    {g.icon}
                  </span>

                  {greetingName && (
                    <span className="text-accent-300 text-xl sm:text-2xl lg:text-3xl">
                      , {greetingName}
                    </span>
                  )}
                </h1>

                {/* Subtitle */}
                <p className="mt-2 text-xs sm:text-sm lg:text-base text-white/70 max-w-2xl">
                  {g.sub} — เลือกหมวดงานด้านล่าง หรือใช้ช่องค้นหาด้านบน
                </p>

                {/* Status badges */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {/* Shift */}
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-400/20 border border-accent-400/40 text-accent-200 text-[11px] sm:text-xs font-medium">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    ช่วงเวลา:
                    <span className="font-display font-semibold">
                      {g.shift}
                    </span>
                  </span>

                  {/* System status */}
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] sm:text-xs">
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                    </span>
                    ระบบทำงานปกติ
                  </span>
                </div>
              </div>

              {/* Right — Clock */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end items-center">
                <div className="w-full max-w-[320px]">
                  <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/15 px-4 sm:px-5 py-4 shadow-lg">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-accent-300 font-mono">
                        Local Time
                      </span>

                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 font-mono">
                        ICT · UTC+7
                      </span>
                    </div>

                    {/* Time */}
                    <div className="font-display font-bold tabular-nums text-center text-white tracking-tight leading-none">
                      <span className="text-4xl sm:text-5xl lg:text-6xl">
                        {hh}
                      </span>

                      <span className="text-4xl sm:text-5xl lg:text-6xl text-accent-400 animate-pulse-slow">
                        :
                      </span>

                      <span className="text-4xl sm:text-5xl lg:text-6xl">
                        {mm}
                      </span>

                      <span className="ml-1 text-xl sm:text-2xl text-white/50 tabular-nums">
                        {ss}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="mt-3 pt-3 border-t border-white/10 text-center">
                      <div className="text-[11px] sm:text-sm text-white/85 font-medium">
                        {formatThaiDate(now)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Big touch-friendly quick access */}
        <HomeColumns />
      </div>
    </PublicLayout>
  );
}
