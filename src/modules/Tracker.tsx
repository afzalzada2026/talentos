import { useMemo, useRef, useState } from "react";
import type { SeedOnboarded, SeedReq } from "../lib/demo";
import { seedOnboarded, seedReqs } from "../lib/demo";
import { useLocalStorage } from "../lib/store";
import { parseCSV, smartDownload, toCsv } from "../lib/download";
import { AnimatedNumber, Btn, Card, EmptyState, Field, FileGrabModal, Modal, inputCls, useToast, STATUSES, STATUS_META, ONBOARDED_HEX } from "../components/ui";
import type { RecStatus } from "../components/ui";
import {
  IconCalendar,
  IconDownload,
  IconInbox,
  IconPlus,
  IconSearch,
  IconSpark,
  IconTrack,
  IconTrash,
  IconUpload,
  IconUserCheck,
  IconX,
} from "../components/icons";

const SOURCES = ["External", "Internal", "Referral", "Agency", "LinkedIn"];

type Req = SeedReq;
type Ob = SeedOnboarded;

const daysBetween = (a: string, b: string) => {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / 86400000));
};

export default function Tracker() {
  const toast = useToast();
  const [rows, setRows] = useLocalStorage<Req[]>("talentos.reqs", seedReqs);
  const [done, setDone] = useLocalStorage<Ob[]>("talentos.onboarded", seedOnboarded);
  const [sheet, setSheet] = useState<"pipeline" | "onboarded">("pipeline");
  const [q, setQ] = useState("");
  const [divFilter, setDivFilter] = useState("All divisions");
  const [addOpen, setAddOpen] = useState(false);
  const [obFor, setObFor] = useState<Req | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [grab, setGrab] = useState<{ filename: string; content: string; mime: string } | null>(null);

  // onboarding modal fields
  const [obJoiner, setObJoiner] = useState("");
  const [obJoined, setObJoined] = useState(new Date().toISOString().slice(0, 10));
  const [obSalary, setObSalary] = useState("");
  const [obNotes, setObNotes] = useState("");

  // add-position modal fields
  const [aPos, setAPos] = useState("");
  const [aDiv, setADiv] = useState("");
  const [aLevel, setALevel] = useState("Associate (L2)");
  const [aVac, setAVac] = useState(1);
  const [aMgr, setAMgr] = useState("");
  const [aRec, setARec] = useState("");
  const [aTarget, setATarget] = useState("");
  const [aSource, setASource] = useState("External");

  const divisions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.division && s.add(r.division));
    done.forEach((r) => r.division && s.add(r.division));
    return [...s].sort();
  }, [rows, done]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (divFilter !== "All divisions" && r.division !== divFilter) return false;
      if (!needle) return true;
      return [r.position, r.division, r.ref, r.manager, r.recruiter, r.notes].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, divFilter]);

  const kpis = useMemo(() => {
    const active = rows.filter((r) => r.status !== "Cancelled");
    return {
      active: active.length,
      interviews: rows.filter((r) => r.status === "Interviews").length,
      offers: rows.filter((r) => r.status === "Offer").length,
      onboarded: done.length,
      avgDays: done.length ? Math.round(done.reduce((a, b) => a + b.daysToFill, 0) / done.length) : 0,
    };
  }, [rows, done]);

  const divStats = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    rows.forEach((r) => {
      const d = r.division || "Unassigned";
      if (!map.has(d)) map.set(d, {});
      const m = map.get(d)!;
      m[r.status] = (m[r.status] ?? 0) + 1;
    });
    done.forEach((r) => {
      const d = r.division || "Unassigned";
      if (!map.has(d)) map.set(d, {});
      const m = map.get(d)!;
      m["Onboarded"] = (m["Onboarded"] ?? 0) + 1;
    });
    return [...map.entries()]
      .map(([div, m]) => ({ div, m, total: Object.values(m).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [rows, done]);

  const patch = (id: string, p: Partial<Req>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  function openOnboard(r: Req) {
    setObFor(r);
    setObJoiner("");
    setObJoined(new Date().toISOString().slice(0, 10));
    setObSalary("");
    setObNotes("");
  }

  function commitOnboard() {
    if (!obFor) return;
    if (!obJoiner.trim()) {
      toast("error", "Enter the joiner's name.");
      return;
    }
    const days = daysBetween(obFor.opened, obJoined);
    const ob: Ob = {
      id: "o" + Date.now().toString(36),
      ref: obFor.ref,
      position: obFor.position,
      division: obFor.division,
      level: obFor.level,
      joiner: obJoiner.trim(),
      joined: obJoined,
      opened: obFor.opened,
      daysToFill: days,
      recruiter: obFor.recruiter,
      source: obFor.source,
      salary: obSalary.trim(),
      notes: obNotes.trim() || obFor.notes,
    };
    setRows((rs) => rs.filter((r) => r.id !== obFor.id));
    setDone((d) => [ob, ...d]);
    setObFor(null);
    toast("success", `${ob.position} moved to Onboarded — filled in ${days} days.`);
  }

  function addPosition() {
    if (!aPos.trim() || !aDiv.trim()) {
      toast("error", "Position title and division are required.");
      return;
    }
    const maxN = rows.concat([]).reduce((mx, r) => {
      const n = Number(r.ref.replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(mx, n) : mx;
    }, 0);
    const ref = `REQ-${String(maxN + 1).padStart(3, "0")}`;
    setRows((rs) => [
      {
        id: "r" + Date.now().toString(36),
        ref,
        position: aPos.trim(),
        division: aDiv.trim(),
        level: aLevel,
        vacancies: Math.max(1, aVac),
        manager: aMgr.trim(),
        recruiter: aRec.trim(),
        opened: new Date().toISOString().slice(0, 10),
        target: aTarget,
        source: aSource,
        applicants: 0,
        shortlisted: 0,
        status: "Open",
        notes: "",
      },
      ...rs,
    ]);
    setAddOpen(false);
    setAPos("");
    setADiv("");
    setAMgr("");
    setARec("");
    setATarget("");
    toast("success", `${ref} · ${aPos.trim()} added to the pipeline.`);
  }

  function exportSheet() {
    const isPipe = sheet === "pipeline";
    const filename = isPipe ? "recruitment_pipeline.csv" : "onboarded_positions.csv";
    const csv =
      "\ufeff" +
      toCsv(
        isPipe
          ? [
              ["Ref", "Position", "Division", "Level", "Vacancies", "Hiring Manager", "Recruiter", "Opened", "Target Fill", "Source", "Applicants", "Shortlisted", "Status", "Notes"],
              ...rows.map((r) => [r.ref, r.position, r.division, r.level, r.vacancies, r.manager, r.recruiter, r.opened, r.target, r.source, r.applicants, r.shortlisted, r.status, r.notes]),
            ]
          : [
              ["Ref", "Position", "Division", "Level", "Joiner", "Joined On", "Days to Fill", "Recruiter", "Source", "Salary Band", "Notes"],
              ...done.map((r) => [r.ref, r.position, r.division, r.level, r.joiner, r.joined, r.daysToFill, r.recruiter, r.source, r.salary, r.notes]),
            ]
      );
    if (smartDownload(filename, csv, "text/csv")) {
      toast("success", "CSV exported — opens in Excel.");
    } else {
      setGrab({ filename, content: csv, mime: "text/csv" });
      toast("info", "Direct save is blocked in this preview — use the dialog to grab the file.");
    }
  }

  function importCSV(file: File | null) {
    if (!file) return;
    file.text().then((text) => {
      try {
        const grid = parseCSV(text);
        if (grid.length < 2) {
          toast("error", "CSV needs a header row plus data rows.");
          return;
        }
        const head = grid[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
        const idx = (...keys: string[]) => head.findIndex((h) => keys.includes(h));
        const iPos = idx("position", "positiontitle", "title");
        const iDiv = idx("division", "department", "dept");
        if (iPos === -1 || iDiv === -1) {
          toast("error", "CSV must include Position and Division columns.");
          return;
        }
        const iLvl = idx("level", "grade");
        const iVac = idx("vacancies", "vacancy");
        const iMgr = idx("manager", "hiringmanager");
        const iRec = idx("recruiter");
        const iOpen = idx("opened", "dateopened", "openingdate");
        const iTgt = idx("target", "targetfill", "targetdate");
        const iSrc = idx("source");
        const iApp = idx("applicants", "applications");
        const iSh = idx("shortlisted", "shortlist");
        const iSt = idx("status");
        const iNo = idx("notes", "remarks");
        const maxN = rows.reduce((mx, r) => Math.max(mx, Number(r.ref.replace(/\D/g, "")) || 0), 0);
        const added: Req[] = grid.slice(1).map((g, k) => {
          const st = iSt >= 0 ? g[iSt] : "";
          return {
            id: "i" + Date.now().toString(36) + k,
            ref: `REQ-${String(maxN + 1 + k).padStart(3, "0")}`,
            position: g[iPos] ?? "",
            division: g[iDiv] ?? "",
            level: iLvl >= 0 ? g[iLvl] ?? "" : "",
            vacancies: Math.max(1, Number(iVac >= 0 ? g[iVac] : 1) || 1),
            manager: iMgr >= 0 ? g[iMgr] ?? "" : "",
            recruiter: iRec >= 0 ? g[iRec] ?? "" : "",
            opened: iOpen >= 0 && g[iOpen] ? g[iOpen] : new Date().toISOString().slice(0, 10),
            target: iTgt >= 0 ? g[iTgt] ?? "" : "",
            source: iSrc >= 0 && g[iSrc] ? g[iSrc] : "External",
            applicants: Number(iApp >= 0 ? g[iApp] : 0) || 0,
            shortlisted: Number(iSh >= 0 ? g[iSh] : 0) || 0,
            status: (STATUSES as readonly string[]).includes(st) ? st : "Open",
            notes: iNo >= 0 ? g[iNo] ?? "" : "",
          };
        });
        setRows((rs) => [...added, ...rs]);
        toast("success", `Imported ${added.length} positions into the pipeline.`);
      } catch {
        toast("error", "Could not parse that CSV file.");
      }
    });
  }

  const twoStep = (id: string, fn: () => void) => {
    if (confirmDel === id) {
      fn();
      setConfirmDel(null);
    } else {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 2600);
    }
  };

  const statusCls = (s: string) => STATUS_META[(STATUSES as readonly string[]).includes(s) ? (s as RecStatus) : "Open"].cls;

  return (
    <div className="space-y-5">
      {/* -------- KPIs -------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Active requisitions", value: kpis.active, tone: "text-pine-700", sub: "in pipeline" },
          { label: "In interviews", value: kpis.interviews, tone: "text-interview", sub: "panels running" },
          { label: "Offers out", value: kpis.offers, tone: "text-offer", sub: "awaiting acceptance" },
          { label: "Onboarded", value: kpis.onboarded, tone: "text-onboarded", sub: "joined & tracked" },
          { label: "Avg days to fill", value: kpis.avgDays, tone: "text-gold-600", sub: "across onboarded" },
        ].map((k, i) => (
          <Card key={i} className="anim-rise px-4 py-3.5" >
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink3">{k.label}</p>
            <p className={`font-display text-[26px] font-bold leading-tight ${k.tone}`}>
              <AnimatedNumber value={k.value} />
            </p>
            <p className="text-[11px] text-ink3">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* -------- division analytics -------- */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[15px] font-bold tracking-tight">Pipeline by division</h3>
            <p className="text-[12px] text-ink3">Stacked status of every requisition, per division.</p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[...STATUSES.map((s) => ({ s, hex: STATUS_META[s].hex })), { s: "Onboarded" as string, hex: ONBOARDED_HEX }].map((x) => (
              <span key={x.s} className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.hex }} />
                {x.s}
              </span>
            ))}
          </div>
        </div>
        {divStats.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-ink3">No data yet — add a position below.</p>
        ) : (
          <div className="space-y-2.5">
            {divStats.map(({ div, m, total }) => (
              <div key={div} className="grid grid-cols-[130px_1fr_44px] items-center gap-3 sm:grid-cols-[170px_1fr_44px]">
                <p className="truncate font-mono text-[11.5px] font-semibold text-ink2" title={div}>
                  {div}
                </p>
                <div className="flex h-6 w-full overflow-hidden rounded-md bg-line/50 ring-1 ring-line">
                  {[...STATUSES.map((s) => ({ s, hex: STATUS_META[s].hex })), { s: "Onboarded", hex: ONBOARDED_HEX }]
                    .filter((x) => (m[x.s] ?? 0) > 0)
                    .map((x) => (
                      <div
                        key={x.s}
                        title={`${div} · ${x.s}: ${m[x.s]}`}
                        className="h-full transition-all duration-700 ease-out hover:brightness-110"
                        style={{ width: `${((m[x.s] ?? 0) / total) * 100}%`, background: x.hex }}
                      />
                    ))}
                </div>
                <span className="rounded-md bg-pine-100 px-1.5 py-0.5 text-center font-mono text-[11px] font-bold text-pine-700">{total}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* -------- sheets -------- */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1 rounded-lg bg-pine-50 p-1">
            <button
              className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${sheet === "pipeline" ? "bg-pine-700 text-white shadow-sm" : "text-ink2 hover:text-pine-700"}`}
              onClick={() => setSheet("pipeline")}
            >
              Pipeline <span className="ml-1 font-mono text-[11px] opacity-75">{rows.length}</span>
            </button>
            <button
              className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${sheet === "onboarded" ? "bg-onboarded text-white shadow-sm" : "text-ink2 hover:text-onboarded"}`}
              onClick={() => setSheet("onboarded")}
            >
              Onboarded <span className="ml-1 font-mono text-[11px] opacity-75">{done.length}</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink3" />
              <input
                className="w-40 rounded-lg border border-line2 bg-white py-1.5 pl-8 pr-2 text-[12.5px] outline-none transition-colors focus:border-pine-500 sm:w-52"
                placeholder="Search positions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <select
              className="cursor-pointer rounded-lg border border-line2 bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-pine-500"
              value={divFilter}
              onChange={(e) => setDivFilter(e.target.value)}
            >
              <option>All divisions</option>
              {divisions.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <Btn size="sm" onClick={() => setAddOpen(true)}>
              <IconPlus className="h-3.5 w-3.5" /> Add position
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => importRef.current?.click()}>
              <IconUpload className="h-3.5 w-3.5" /> Import
            </Btn>
            <input ref={importRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { importCSV(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <Btn variant="outline" size="sm" onClick={exportSheet}>
              <IconDownload className="h-3.5 w-3.5" /> Export
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setRows(seedReqs()); setDone(seedOnboarded()); toast("info", "Sample data restored."); }}>
              <IconSpark className="h-3.5 w-3.5 text-gold-600" /> Sample
            </Btn>
            <Btn variant={confirmClear ? "danger" : "ghost"} size="sm" onClick={() => {
              if (confirmClear) { setRows([]); setDone([]); setConfirmClear(false); toast("info", "Tracker cleared."); }
              else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 2600); }
            }}>
              {confirmClear ? "Sure?" : "Clear"}
            </Btn>
          </div>
        </div>

        {sheet === "pipeline" ? (
          filtered.length === 0 ? (
            <EmptyState
              icon={<IconTrack className="h-6 w-6" />}
              title="No positions in the pipeline"
              desc="Add your first requisition, import a CSV, or restore the sample dataset to explore the tracker."
              action={
                <div className="flex gap-2">
                  <Btn size="sm" onClick={() => setAddOpen(true)}><IconPlus className="h-3.5 w-3.5" /> Add position</Btn>
                  <Btn variant="outline" size="sm" onClick={() => { setRows(seedReqs()); setDone(seedOnboarded()); }}>Load sample</Btn>
                </div>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1310px] text-left">
                <thead>
                  <tr className="border-b border-line bg-pine-50/70 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink3">
                    {["Ref", "Position", "Division", "Level", "Vac.", "Hiring manager", "Recruiter", "Opened", "Target", "Source", "Apps", "Shortlist", "Status", "Notes", ""].map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-2 py-2.5 font-semibold first:pl-4 last:pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="group border-b border-line/70 transition-colors hover:bg-pine-50/50">
                      <td className="px-2 py-1.5 pl-4 font-mono text-[11px] font-semibold text-pine-700">{r.ref}</td>
                      <td className="min-w-[190px] px-2 py-1.5"><input className="cell font-semibold" value={r.position} onChange={(e) => patch(r.id, { position: e.target.value })} /></td>
                      <td className="min-w-[130px] px-2 py-1.5">
                        <input className="cell" list="div-options" value={r.division} onChange={(e) => patch(r.id, { division: e.target.value })} />
                      </td>
                      <td className="min-w-[130px] px-2 py-1.5"><input className="cell" value={r.level} onChange={(e) => patch(r.id, { level: e.target.value })} /></td>
                      <td className="px-2 py-1.5"><input type="number" min={1} className="cell w-12 font-mono" value={r.vacancies} onChange={(e) => patch(r.id, { vacancies: Math.max(1, Number(e.target.value) || 1) })} /></td>
                      <td className="min-w-[130px] px-2 py-1.5"><input className="cell" value={r.manager} onChange={(e) => patch(r.id, { manager: e.target.value })} /></td>
                      <td className="min-w-[110px] px-2 py-1.5"><input className="cell" value={r.recruiter} onChange={(e) => patch(r.id, { recruiter: e.target.value })} /></td>
                      <td className="px-2 py-1.5"><input type="date" className="cell w-[8.4rem] font-mono text-[11.5px]" value={r.opened} onChange={(e) => patch(r.id, { opened: e.target.value })} /></td>
                      <td className="px-2 py-1.5"><input type="date" className="cell w-[8.4rem] font-mono text-[11.5px]" value={r.target} onChange={(e) => patch(r.id, { target: e.target.value })} /></td>
                      <td className="px-2 py-1.5">
                        <select className={`cell w-[6.6rem] cursor-pointer font-medium ${r.source ? "" : "text-ink3"}`} value={r.source} onChange={(e) => patch(r.id, { source: e.target.value })}>
                          {SOURCES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input type="number" min={0} className="cell w-14 font-mono" value={r.applicants} onChange={(e) => patch(r.id, { applicants: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td className="px-2 py-1.5"><input type="number" min={0} className="cell w-14 font-mono" value={r.shortlisted} onChange={(e) => patch(r.id, { shortlisted: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td className="px-2 py-1.5">
                        <select
                          className={`cell w-[7.6rem] cursor-pointer rounded-md font-semibold ring-1 ring-inset ${statusCls(r.status)}`}
                          value={r.status}
                          onChange={(e) => patch(r.id, { status: e.target.value })}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="min-w-[150px] px-2 py-1.5"><input className="cell text-ink2" placeholder="—" value={r.notes} onChange={(e) => patch(r.id, { notes: e.target.value })} /></td>
                      <td className="whitespace-nowrap px-2 py-1.5 pr-4 text-right">
                        <button
                          title="Mark onboarded — moves to the Onboarded sheet"
                          onClick={() => openOnboard(r)}
                          className="rounded-md p-1.5 text-onboarded transition-colors hover:bg-onboarded/10"
                        >
                          <IconUserCheck className="h-4 w-4" />
                        </button>
                        <button
                          title={confirmDel === r.id ? "Click again to delete" : "Delete row"}
                          onClick={() => twoStep(r.id, () => { setRows((rs) => rs.filter((x) => x.id !== r.id)); toast("info", `${r.ref} deleted.`); })}
                          className={`rounded-md p-1.5 transition-colors ${confirmDel === r.id ? "bg-cancel/10 text-cancel" : "text-ink3 hover:bg-cancel/10 hover:text-cancel"}`}
                        >
                          {confirmDel === r.id ? <IconX className="h-4 w-4" /> : <IconTrash className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="div-options">
                {divisions.map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>
          )
        ) : done.length === 0 ? (
          <EmptyState
            icon={<IconUserCheck className="h-6 w-6" />}
            title="Nothing onboarded yet"
            desc="When a position is filled, click the onboard tick on its pipeline row — capture the joiner and it lands here with days-to-fill."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left">
              <thead>
                <tr className="border-b border-line bg-onboarded/5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink3">
                  {["Ref", "Position", "Division", "Level", "Joiner", "Joined on", "Days to fill", "Recruiter", "Source", "Salary band", "Notes", ""].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-2 py-2.5 font-semibold first:pl-4 last:pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id} className="border-b border-line/70 transition-colors hover:bg-onboarded/5">
                    <td className="px-2 py-2.5 pl-4 font-mono text-[11px] font-semibold text-onboarded">{r.ref}</td>
                    <td className="px-2 py-2.5 text-[12.5px] font-semibold text-ink">{r.position}</td>
                    <td className="px-2 py-2.5 text-[12.5px] text-ink2">{r.division}</td>
                    <td className="px-2 py-2.5 text-[12.5px] text-ink2">{r.level}</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-onboarded">
                        <IconUserCheck className="h-3.5 w-3.5" /> {r.joiner}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11.5px] text-ink2">{r.joined}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-md bg-gold-100 px-2 py-0.5 font-mono text-[11px] font-bold text-gold-600">{r.daysToFill} d</span>
                    </td>
                    <td className="px-2 py-2.5 text-[12.5px] text-ink2">{r.recruiter}</td>
                    <td className="px-2 py-2.5 text-[12.5px] text-ink2">{r.source}</td>
                    <td className="px-2 py-2.5 text-[12.5px] text-ink2">{r.salary || "—"}</td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 text-[12.5px] text-ink3" title={r.notes}>{r.notes || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 pr-4 text-right">
                      <button
                        title="Send back to pipeline"
                        onClick={() => {
                          setDone((d) => d.filter((x) => x.id !== r.id));
                          setRows((rs) => [
                            { id: "rb" + Date.now().toString(36), ref: r.ref, position: r.position, division: r.division, level: r.level, vacancies: 1, manager: "", recruiter: r.recruiter, opened: r.opened, target: "", source: r.source, applicants: 0, shortlisted: 0, status: "Open", notes: r.notes },
                            ...rs,
                          ]);
                          toast("info", `${r.ref} moved back to the pipeline.`);
                        }}
                        className="rounded-md p-1.5 text-ink3 transition-colors hover:bg-pine-50 hover:text-pine-700"
                      >
                        <IconInbox className="h-4 w-4" />
                      </button>
                      <button
                        title={confirmDel === r.id ? "Click again to delete" : "Delete record"}
                        onClick={() => twoStep(r.id, () => { setDone((d) => d.filter((x) => x.id !== r.id)); toast("info", `${r.ref} record deleted.`); })}
                        className={`rounded-md p-1.5 transition-colors ${confirmDel === r.id ? "bg-cancel/10 text-cancel" : "text-ink3 hover:bg-cancel/10 hover:text-cancel"}`}
                      >
                        {confirmDel === r.id ? <IconX className="h-4 w-4" /> : <IconTrash className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="flex items-center gap-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink3">
        <IconCalendar className="h-3.5 w-3.5" /> every cell edits in place · data persists in this browser
      </p>

      {/* -------- onboard modal -------- */}
      <Modal open={!!obFor} onClose={() => setObFor(null)} title={`Onboard — ${obFor?.position ?? ""}`}>
        {obFor && (
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-pine-50/60 px-3.5 py-2.5 text-[12.5px] text-ink2">
              <span className="font-mono text-[11px] font-semibold text-pine-700">{obFor.ref}</span> · {obFor.division} · opened {obFor.opened}
            </div>
            <Field label="Joiner's full name *">
              <input className={inputCls} placeholder="e.g. Hina Shahid" value={obJoiner} onChange={(e) => setObJoiner(e.target.value)} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Joining date *">
                <input type="date" className={inputCls + " font-mono text-[12.5px]"} value={obJoined} onChange={(e) => setObJoined(e.target.value)} />
              </Field>
              <Field label="Salary band" hint="optional">
                <input className={inputCls} placeholder="e.g. Band C" value={obSalary} onChange={(e) => setObSalary(e.target.value)} />
              </Field>
            </div>
            <Field label="Notes" hint="optional">
              <input className={inputCls} placeholder="e.g. relocation agreed, probation 3 months" value={obNotes} onChange={(e) => setObNotes(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="outline" onClick={() => setObFor(null)}>Cancel</Btn>
              <Btn onClick={commitOnboard}>
                <IconUserCheck className="h-4 w-4" /> Confirm onboarding
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* -------- add position modal -------- */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add position to pipeline">
        <div className="space-y-4">
          <Field label="Position title *">
            <input className={inputCls} placeholder="e.g. Senior Frontend Engineer" value={aPos} onChange={(e) => setAPos(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Division / department *">
              <input className={inputCls} list="div-options" placeholder="e.g. Engineering" value={aDiv} onChange={(e) => setADiv(e.target.value)} />
            </Field>
            <Field label="Level">
              <input className={inputCls} placeholder="e.g. Senior (L3)" value={aLevel} onChange={(e) => setALevel(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Vacancies">
              <input type="number" min={1} className={inputCls + " font-mono"} value={aVac} onChange={(e) => setAVac(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <Field label="Hiring manager">
              <input className={inputCls} value={aMgr} onChange={(e) => setAMgr(e.target.value)} />
            </Field>
            <Field label="Recruiter">
              <input className={inputCls} value={aRec} onChange={(e) => setARec(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target fill date">
              <input type="date" className={inputCls + " font-mono text-[12.5px]"} value={aTarget} onChange={(e) => setATarget(e.target.value)} />
            </Field>
            <Field label="Source">
              <select className={inputCls + " cursor-pointer"} value={aSource} onChange={(e) => setASource(e.target.value)}>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="outline" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn onClick={addPosition}><IconPlus className="h-4 w-4" /> Add to pipeline</Btn>
          </div>
        </div>
      </Modal>

      <FileGrabModal
        open={!!grab}
        onClose={() => setGrab(null)}
        filename={grab?.filename ?? ""}
        content={grab?.content ?? ""}
        mime={grab?.mime ?? "text/plain"}
      />
    </div>
  );
}
