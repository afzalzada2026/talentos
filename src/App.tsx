import { useState } from "react";
import type { ReactNode } from "react";
import type { Settings } from "./lib/types";
import { DEFAULT_SETTINGS } from "./lib/groq";
import { useLocalStorage } from "./lib/store";
import { ToastProvider, useToast } from "./components/ui";
import SettingsDrawer from "./components/SettingsDrawer";
import Shortlist from "./modules/Shortlist";
import JDGenerator from "./modules/JDGenerator";
import Tracker from "./modules/Tracker";
import { IconDoc, IconGear, IconScan, IconTrack, LogoMark } from "./components/icons";

type ModuleId = "shortlist" | "jd" | "tracker";

const MODULES: {
  id: ModuleId;
  num: string;
  title: string;
  desc: string;
  kicker: string;
  sub: string;
  icon: (p: { className?: string }) => ReactNode;
}[] = [
  {
    id: "shortlist",
    num: "01",
    title: "CV Shortlisting",
    desc: "Screen & rank merged CVs",
    kicker: "Module 01 · Screening",
    sub: "Drop the merged CV file plus the JD — Groq Llama screens every CV and returns a ranked top-N table.",
    icon: (p) => <IconScan {...p} />,
  },
  {
    id: "jd",
    num: "02",
    title: "JD Generator",
    desc: "Company-format job descriptions",
    kicker: "Module 02 · Documentation",
    sub: "Generate comprehensive JDs that mirror your company format exactly — export to Word, PDF, Markdown or text.",
    icon: (p) => <IconDoc {...p} />,
  },
  {
    id: "tracker",
    num: "03",
    title: "Recruitment Tracker",
    desc: "Pipeline, divisions & onboarding",
    kicker: "Module 03 · Tracking",
    sub: "Track every requisition by status and division; onboarded roles move automatically to the Onboarded sheet.",
    icon: (p) => <IconTrack {...p} />,
  },
];

function Shell() {
  const toast = useToast();
  const [active, setActive] = useLocalStorage<ModuleId>("talentos.module", "shortlist");
  const [settings, setSettings] = useLocalStorage<Settings>("talentos.settings", DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const meta = MODULES.find((m) => m.id === active) ?? MODULES[0];
  const hasKey = !!settings.apiKey.trim();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* -------- sidebar -------- */}
      <aside className="relative hidden w-[264px] shrink-0 flex-col overflow-hidden bg-pine-900 text-pine-100 md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% -5%, #3f8f6e 0%, transparent 45%), radial-gradient(circle at 95% 105%, #dca44f 0%, transparent 38%)",
          }}
        />
        <div className="relative flex items-center gap-3 px-5 pb-5 pt-6">
          <LogoMark className="h-10 w-10 shrink-0" />
          <div>
            <p className="font-display text-[17px] font-bold leading-tight tracking-tight text-white">TalentOS</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-pine-200">AI HR Suite</p>
          </div>
        </div>

        <p className="relative px-5 pb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-pine-400">Modules</p>
        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3">
          {MODULES.map((m) => {
            const on = m.id === active;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 ${
                  on ? "bg-white/10 text-white" : "text-pine-200 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-gold-400 transition-all duration-200 ${
                    on ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                  }`}
                />
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${on ? "border-gold-400/40 bg-gold-400/10 text-gold-400" : "border-white/10 bg-white/5 text-pine-200 group-hover:text-white"}`}>
                  {m.icon({ className: "h-[18px] w-[18px]" })}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-semibold tracking-[0.16em] text-pine-400">{m.num}</span>
                    <span className="truncate font-display text-[13.5px] font-semibold">{m.title}</span>
                  </span>
                  <span className="block truncate text-[11px] text-pine-200/80">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="relative space-y-2 border-t border-white/10 px-3 py-4">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-pine-200 transition-colors hover:bg-white/5 hover:text-white"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
              <IconGear className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[13.5px] font-semibold">Settings</span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className={`pulse-dot h-1.5 w-1.5 rounded-full ${hasKey ? "bg-onboarded" : "bg-gold-400"}`} />
                {hasKey ? "Groq connected" : "No API key yet"}
              </span>
            </span>
          </button>
          <p className="px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-pine-400">local-first · v1.0</p>
        </div>
      </aside>

      {/* -------- main -------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 border-b border-line bg-paper/85 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <LogoMark className="h-8 w-8 shrink-0 md:hidden" />
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-600">{meta.kicker}</p>
                <h1 className="truncate font-display text-[19px] font-bold leading-tight tracking-tight sm:text-[22px]">{meta.title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors sm:flex ${
                  hasKey
                    ? "border-onboarded/30 bg-onboarded/10 text-onboarded hover:bg-onboarded/15"
                    : "border-gold-500/40 bg-gold-100/70 text-gold-600 hover:bg-gold-100"
                }`}
              >
                <span className={`pulse-dot h-1.5 w-1.5 rounded-full ${hasKey ? "bg-onboarded" : "bg-gold-500"}`} />
                {hasKey ? "Groq · Llama ready" : "Add free API key"}
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg border border-line2 bg-white p-2 text-ink2 transition-colors hover:border-pine-400 hover:text-pine-700 sm:hidden"
                aria-label="Settings"
              >
                <IconGear className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* mobile module tabs */}
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2.5 md:hidden">
            {MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  m.id === active ? "bg-pine-700 text-white" : "bg-white text-ink2 ring-1 ring-line2"
                }`}
              >
                {m.icon({ className: "h-3.5 w-3.5" })}
                {m.title}
              </button>
            ))}
          </nav>
        </header>

        <main className="bg-grid relative flex-1 overflow-y-auto">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-64"
            style={{ background: "radial-gradient(60% 100% at 20% 0%, rgba(34,113,81,0.08) 0%, transparent 70%), radial-gradient(50% 90% at 90% 0%, rgba(201,138,45,0.07) 0%, transparent 70%)" }}
          />
          <div key={active} className="anim-rise relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
            <p className="mb-5 hidden max-w-2xl text-[13px] leading-relaxed text-ink2 lg:block">{meta.sub}</p>
            {active === "shortlist" && <Shortlist settings={settings} onOpenSettings={() => setSettingsOpen(true)} />}
            {active === "jd" && <JDGenerator settings={settings} onOpenSettings={() => setSettingsOpen(true)} />}
            {active === "tracker" && <Tracker />}
            <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink3">
              <span>TalentOS · runs 100% on free tools — Groq Llama API + your browser</span>
              <span>CVs & records never leave this device except AI prompts</span>
            </footer>
          </div>
        </main>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={(s) => {
          setSettings(s);
          if (s.apiKey.trim()) toast("success", "Groq engine configured.");
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
