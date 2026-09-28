import { useEffect, useState } from "react";
import PublicLayout from "../layouts/PublicLayout";
import HomeColumns from "../components/home/HomeColumns";
import { useWeather, getScene, weatherIcon, WeatherFx } from "../components/home/HeroWeather";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAuth } from "../context/AuthContext";

// Greeting for 24/7 shift operation
function getGreeting(h) {
  // กะเช้า: 08:00 - 20:00 (h >= 8 && h < 20)
  if (h >= 8 && h < 20) {
    if (h < 12) return { th: 'สวัสดีตอนเช้า',  sub: 'Good morning',   shift: 'กะเช้า',  icon: 'sun', iconClass: 'text-amber-300' }
    if (h < 13) return { th: 'สวัสดีตอนเที่ยง', sub: 'Good noon',      shift: 'กะเช้า',  icon: 'sun', iconClass: 'text-yellow-300' }
    if (h < 17) return { th: 'สวัสดีตอนบ่าย',   sub: 'Good afternoon', shift: 'กะเช้า',  icon: 'cloud-sun', iconClass: 'text-amber-200' }
    return             { th: 'สวัสดีตอนเย็น',   sub: 'Good evening',   shift: 'กะเช้า',  icon: 'cloud-moon', iconClass: 'text-orange-300' }
  }
  // กะดึก: 20:00 - 08:00 (h >= 20 || h < 8)
  if (h >= 20 && h < 24) {
    return             { th: 'สวัสดีตอนค่ำ',    sub: 'Good night',     shift: 'กะดึก',   icon: 'moon', iconClass: 'text-sky-200' }
  }
  if (h >= 5 && h < 8) {
    return             { th: 'สวัสดีตอนเช้าตรู่', sub: 'Early morning',   shift: 'กะดึก',   icon: 'mug-hot', iconClass: 'text-amber-200' }
  }
  return               { th: 'สวัสดีตอนดึก',    sub: 'Late night shift', shift: 'กะดึก',   icon: 'star', iconClass: 'text-sky-200' }
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
  const weather = useWeather();
  const scene = getScene(weather, now.getHours());
  const [heroIcon, heroIconClass] = weatherIcon(weather) || [g.icon, g.iconClass];
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());

  return (
    <PublicLayout>
      <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-fade-in">
        {/* ───── Welcome + Live Clock (compact bar) ───── */}
        {/* Background follows the live weather (see HeroWeather.jsx); time of day when unavailable */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${scene.bg} text-white shadow-lg mb-5`}>
          {scene.glows.map((cls, i) => (
            <div key={i} className={`pointer-events-none absolute rounded-full blur-3xl ${cls}`} />
          ))}
          <WeatherFx fx={scene.fx} />

          <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 px-5 lg:px-7 py-4">
            {/* Left — Greeting */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                <FontAwesomeIcon icon={['fas', heroIcon]} className={heroIconClass} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-white font-bold leading-tight text-2xl lg:text-3xl truncate">
                  {g.th}
                  {greetingName && <span className="text-accent-300">, {greetingName}</span>}
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-white/70 truncate">
                  {g.sub} — เลือกหมวดงานด้านล่าง หรือใช้ช่องค้นหาด้านบน
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-400/20 border border-accent-400/40 text-accent-200 text-[11px] sm:text-xs font-medium">
                    <FontAwesomeIcon icon={['fas', 'bolt']} className="w-3" />
                    ช่วงเวลา: <span className="font-display font-semibold">{g.shift}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] sm:text-xs">
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                    </span>
                    ระบบทำงานปกติ
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-sky-200/80 text-[10px] sm:text-[11px] font-mono">
                    Centralized Information Access
                  </span>
                </div>
              </div>
            </div>

            {/* Right — Clock */}
            <div className="flex-shrink-0 flex items-center gap-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/15 px-7 py-5 lg:py-7 self-stretch lg:self-auto justify-center">
              <div className="font-display font-bold tabular-nums text-white tracking-tight leading-none">
                <span className="text-6xl lg:text-8xl">{hh}</span>
                <span className="text-6xl lg:text-8xl text-accent-400 animate-pulse-slow">:</span>
                <span className="text-6xl lg:text-8xl">{mm}</span>
                <span className="ml-2 text-3xl lg:text-4xl text-white/50">{ss}</span>
              </div>
              <div className="border-l border-white/15 pl-6 text-left">
                <div className="text-xs lg:text-sm uppercase tracking-[0.25em] text-accent-300 font-mono">ICT · UTC+7</div>
                <div className="mt-2 text-base lg:text-xl text-white/90 font-medium whitespace-nowrap">{formatThaiDate(now)}</div>
                {weather && (
                  <div className="mt-1.5 flex items-center gap-2 text-sm lg:text-lg text-white/80 whitespace-nowrap">
                    <FontAwesomeIcon icon={['fas', heroIcon]} className={heroIconClass} />
                    {weather.temperature != null && <span className="font-semibold text-white">{weather.temperature}°C</span>}
                    <span>· {weather.label}</span>
                  </div>
                )}
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
