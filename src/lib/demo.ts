import type { CandidateSummary } from "./types";

export const SAMPLE_JD = `Senior Frontend Engineer — Horizon Technologies (Karachi, hybrid)

Position Summary
Horizon Technologies is looking for a Senior Frontend Engineer to own the user-facing experience of our SaaS analytics platform used by 400+ enterprise clients.

Key Responsibilities
- Architect and ship features in React 18 + TypeScript across a large-scale design system
- Drive performance budgets (LCP < 2.0s) and measurable UX improvements
- Mentor 3 mid-level engineers; lead code reviews and frontend guild sessions
- Partner with product & design from discovery to release

Requirements
- 6+ years of professional frontend experience
- Expert-level React and TypeScript; strong state-management fundamentals (Redux/Zustand/React Query)
- Experience with Next.js, SSR/ISR, and CI/CD pipelines
- Testing culture: Jest, React Testing Library, Playwright or Cypress
- Bonus: data-viz (D3/Recharts), accessibility (WCAG 2.1), design-system tooling

Qualifications
- BS Computer Science or equivalent practical experience

Compensation
- PKR 550k–750k/month, annual bonus, health cover for family`;

export const SAMPLE_CVS = `===== Adeel_Khan_CV.pdf =====
ADEEL KHAN
Senior Frontend Engineer
Karachi, Pakistan | adeel.khan.dev@gmail.com | +92 300 8214467

SUMMARY
Frontend engineer with 8 years of experience building high-traffic SaaS products. Led the React + TypeScript rewrite of a banking dashboard used by 200k monthly users.

EXPERIENCE
Senior Frontend Engineer — Arbisoft (2021 – Present)
- Own the analytics module (React 18, TypeScript, Redux Toolkit, Recharts)
- Cut LCP from 3.4s to 1.7s via code-splitting, SSR with Next.js and image pipeline
- Mentor a pod of 4 engineers; run the frontend guild and code-review standards

Frontend Engineer — Systems Limited (2017 – 2021)
- Built banking & telecom portals in React/Redux; introduced Jest + RTL (coverage 78%)

EDUCATION
BS Computer Science — FAST-NUCES, Karachi (2016)

SKILLS
React, TypeScript, Next.js, Redux, React Query, Jest, Playwright, CI/CD (GitHub Actions), D3.js, WCAG accessibility

===== Sarah_Malik_Resume.docx =====
Sarah Malik
Frontend Engineer II
Lahore | sarah.malik@outlook.com | +92 321 5567090

PROFILE
Product-minded frontend engineer, 7 years across e-commerce and fintech. Comfortable owning features end-to-end with design and QA.

EXPERIENCE
Frontend Engineer II — Careem (2020 – Present)
- Payments & checkout flows in React + TypeScript (web)
- Built a shared component library adopted by 6 squads; Storybook + Chromatic
- Accessibility lead for web checkout (WCAG 2.1 AA)

Software Engineer — NetSol Technologies (2017 – 2020)
- Leasing platform UI, React migration from AngularJS

EDUCATION
BS Software Engineering — UET Lahore (2016)

SKILLS
React, TypeScript, Redux, Zustand, Storybook, Jest, Cypress, Next.js, GraphQL

===== Bilal_Ahmed_CV.txt =====
Bilal Ahmed
Junior Web Developer
Islamabad | bilal.ahmed94@yahoo.com | +92 333 9021176

OBJECTIVE
Motivated developer with 4 years of experience seeking growth into senior frontend roles.

EXPERIENCE
Web Developer — TechAccess (2021 – Present)
- WordPress + WooCommerce builds; some React dashboards
- Landing pages in HTML/CSS/JS; jQuery plugins

Junior Developer — MediaLink (2019 – 2021)
- Static sites, basic PHP, Bootstrap

EDUCATION
BS IT — COMSATS Islamabad (2019)

SKILLS
HTML, CSS, JavaScript, jQuery, WordPress, Bootstrap, some React

===== Zainab_Raza_CV.pdf =====
Zainab Raza
UI Developer
Karachi | zainab.raza.ui@gmail.com | +92 345 2210983

SUMMARY
5 years building enterprise UIs, primarily with Angular; increasingly working with React on new projects.

EXPERIENCE
UI Developer — 10Pearls (2020 – Present)
- Angular 14+ apps for US healthcare clients; RxJS, NgRx
- Started React + TypeScript pilot for an internal tool

Associate UI Developer — Folio3 (2018 – 2020)
- AngularJS/Angular dashboards, SASS, D3 charts

EDUCATION
BS Computer Science — NED University (2018)

SKILLS
Angular, TypeScript, RxJS, React (basic), SASS, D3, Jest

===== Imran_Sheikh_CV.pdf =====
Imran Sheikh
Restaurant Manager
Multan | imran.sheikh.mgr@gmail.com | +92 301 7745521

EXPERIENCE
Restaurant Manager — Monal Group (2018 – Present)
- Team of 22, P&L ownership, vendor negotiation

Shift Supervisor — KFC Pakistan (2014 – 2018)

EDUCATION
BBA — Bahauddin Zakariya University (2013)

SKILLS
Operations, staffing, inventory, customer service

===== Nadia_Hussain_CV.docx =====
Nadia Hussain
Accounts Officer
Lahore | nadia.hussain.acc@gmail.com | +92 322 4419870

EXPERIENCE
Accounts Officer — Packages Limited (2019 – Present)
- AP/AR, bank reconciliation, SAP postings

EDUCATION
B.Com — Punjab University (2018)

SKILLS
SAP, Excel, reconciliation, tax filings`;

/* ---------------- JD Generator: default company format ---------------- */

export const DEFAULT_JD_TEMPLATE = `# JOB DESCRIPTION

**Position Title:** [Position Title]
**Division / Department:** [Division]
**Job Level:** [Level]
**Reports To:** [Manager Title]
**Location:** [Location]
**Employment Type:** Full-Time

## 1. Position Summary
A short paragraph describing why this role exists and its core contribution.

## 2. Key Responsibilities
1. First responsibility
2. Second responsibility
3. ...

## 3. Job Requirements
### 3.1 Education
- Minimum qualification
### 3.2 Experience
- Years and type of experience
### 3.3 Technical Skills
- Tools, systems, languages
### 3.4 Competencies
- Behavioral competencies

## 4. Key Performance Indicators
- KPI 1
- KPI 2

## 5. Working Conditions
- Work arrangement, travel, timings

---
*This job description outlines the general nature of the role and is not an exhaustive list of duties. It is reviewed periodically by the HR Division.*`;

/* ---------------- Tracker seed data ---------------- */

const d = (offset: number) => {
  const t = new Date();
  t.setDate(t.getDate() + offset);
  return t.toISOString().slice(0, 10);
};

export interface SeedReq {
  id: string;
  ref: string;
  position: string;
  division: string;
  level: string;
  vacancies: number;
  manager: string;
  recruiter: string;
  opened: string;
  target: string;
  source: string;
  applicants: number;
  shortlisted: number;
  status: string;
  notes: string;
}

export interface SeedOnboarded {
  id: string;
  ref: string;
  position: string;
  division: string;
  level: string;
  joiner: string;
  joined: string;
  opened: string;
  daysToFill: number;
  recruiter: string;
  source: string;
  salary: string;
  notes: string;
}

export function seedReqs(): SeedReq[] {
  return [
    { id: "r1", ref: "REQ-014", position: "Senior Frontend Engineer", division: "Engineering", level: "Senior (L3)", vacancies: 1, manager: "S. Bakhtiar", recruiter: "M. Tariq", opened: d(-34), target: d(16), source: "External", applicants: 212, shortlisted: 14, status: "Interviews", notes: "Panel round this week" },
    { id: "r2", ref: "REQ-015", position: "Backend Engineer — Payments", division: "Engineering", level: "Senior (L3)", vacancies: 2, manager: "S. Bakhtiar", recruiter: "M. Tariq", opened: d(-21), target: d(24), source: "External", applicants: 158, shortlisted: 9, status: "Shortlisting", notes: "Groq shortlist in progress" },
    { id: "r3", ref: "REQ-025", position: "QA Automation Engineer", division: "Engineering", level: "Associate (L2)", vacancies: 1, manager: "A. Qureshi", recruiter: "H. Jamal", opened: d(-12), target: d(30), source: "Referral", applicants: 74, shortlisted: 5, status: "Shortlisting", notes: "" },
    { id: "r4", ref: "REQ-021", position: "Financial Analyst", division: "Finance", level: "Associate (L2)", vacancies: 1, manager: "R. Dar", recruiter: "H. Jamal", opened: d(-9), target: d(33), source: "External", applicants: 46, shortlisted: 0, status: "Open", notes: "JD published on Rozee & LinkedIn" },
    { id: "r5", ref: "REQ-009", position: "Sales Executive — North", division: "Sales", level: "Associate (L2)", vacancies: 3, manager: "K. Anwar", recruiter: "M. Tariq", opened: d(-40), target: d(2), source: "Agency", applicants: 121, shortlisted: 18, status: "Offer", notes: "2 offers out, 1 verbal yes" },
    { id: "r6", ref: "REQ-006", position: "Territory Manager", division: "Sales", level: "Manager (M2)", vacancies: 1, manager: "K. Anwar", recruiter: "H. Jamal", opened: d(-55), target: d(-5), source: "Internal", applicants: 38, shortlisted: 6, status: "Offer", notes: "Final negotiation" },
    { id: "r7", ref: "REQ-018", position: "HR Generalist", division: "People Ops", level: "Senior (L3)", vacancies: 1, manager: "F. Mirza", recruiter: "F. Mirza", opened: d(-27), target: d(12), source: "External", applicants: 96, shortlisted: 8, status: "Interviews", notes: "HR round done, line manager pending" },
    { id: "r8", ref: "REQ-023", position: "Operations Coordinator", division: "Operations", level: "Entry Level (L1)", vacancies: 2, manager: "T. Shaikh", recruiter: "H. Jamal", opened: d(-6), target: d(36), source: "External", applicants: 31, shortlisted: 0, status: "Open", notes: "" },
    { id: "r9", ref: "REQ-011", position: "Content Lead", division: "Marketing", level: "Lead (L4)", vacancies: 1, manager: "N. Chaudhry", recruiter: "M. Tariq", opened: d(-48), target: d(-10), source: "Referral", applicants: 59, shortlisted: 7, status: "On Hold", notes: "Budget review next quarter" },
  ];
}

export function seedOnboarded(): SeedOnboarded[] {
  return [
    { id: "o1", ref: "REQ-002", position: "Product Designer", division: "Engineering", level: "Senior (L3)", joiner: "Hina Shahid", joined: d(-12), opened: d(-58), daysToFill: 46, recruiter: "M. Tariq", source: "Referral", salary: "Band C", notes: "Design-system hire" },
    { id: "o2", ref: "REQ-004", position: "Accounts Payable Officer", division: "Finance", level: "Entry Level (L1)", joiner: "Daniyal Akram", joined: d(-30), opened: d(-61), daysToFill: 31, recruiter: "H. Jamal", source: "External", salary: "Band A", notes: "" },
    { id: "o3", ref: "REQ-001", position: "Support Associate", division: "Operations", level: "Entry Level (L1)", joiner: "Fatima Noor", joined: d(-49), opened: d(-75), daysToFill: 26, recruiter: "H. Jamal", source: "Agency", salary: "Band A", notes: "Night-shift roster" },
  ];
}

export type { CandidateSummary };
