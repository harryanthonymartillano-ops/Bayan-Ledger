import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileCheck2,
  FolderGit2,
  HelpCircle,
  Landmark,
  Layers,
  MapPinned,
  MessageSquare,
  Receipt,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { useBlockchain } from '../../context/BlockchainContext';

export const Home = () => {
  const { projects, isLoading } = useBlockchain();

  const totalBudget = projects.reduce((acc, p) => acc + (p.totalBudget || 0), 0);
  const totalAllocated = projects.reduce((acc, p) => acc + (p.allocatedFunds || 0), 0);
  const totalDisbursed = projects.reduce((acc, p) => acc + (p.disbursedFunds || 0), 0);
  const activeCount = projects.filter((p) => ['ACTIVE', 'In Progress'].includes(p.status)).length;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);

  const isDataLoading = isLoading || projects.length === 0;

  const portalStats = [
    {
      label: 'Total AIP Budget',
      value: isDataLoading ? '0' : (totalBudget > 0 ? formatCurrency(totalBudget) : '0'),
      detail: 'Annual Investment Program allocation',
    },
    {
      label: 'SARO Obligated',
      value: isDataLoading ? '0' : (totalAllocated > 0 ? formatCurrency(totalAllocated) : '0'),
      detail: 'Committed by Municipal Budget Office',
    },
    {
      label: 'NCA Disbursed',
      value: isDataLoading ? '0' : (totalDisbursed > 0 ? formatCurrency(totalDisbursed) : '0'),
      detail: 'Paid to verified contractor accounts',
    },
    {
      label: 'Active Projects',
      value: isDataLoading ? '0' : activeCount.toString(),
      detail: 'Municipal infrastructure & public initiatives',
    },
  ];

  const projectWorkflow = [
    {
      step: '01',
      title: 'Project Proposal & Scoping',
      officer: 'MPDO Planning',
      badgeStyle: 'bg-sky-50 text-sky-800 border-sky-200',
      icon: Compass,
      description:
        'Municipal engineers encode project scope, cost estimates, site coordinates, and community impact assessments before public bidding.',
      output: 'Inception Hash',
    },
    {
      step: '02',
      title: 'SARO Budget Allocation',
      officer: 'Budget Office (MBO)',
      badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: Banknote,
      description:
        'Special Allotment Release Orders (SARO) authorize project funding. 1st multi-sig approval commits appropriations on-chain.',
      output: 'SARO Obligation',
    },
    {
      step: '03',
      title: 'Milestone Field Inspection',
      officer: 'MPDO & Citizens',
      badgeStyle: 'bg-slate-100 text-slate-800 border-slate-200',
      icon: MapPinned,
      description:
        'Engineers and citizen monitors inspect physical deliverables on-site, uploading geotagged photo proof and verified accomplishment reports.',
      output: 'Inspection Proof',
    },
    {
      step: '04',
      title: 'Disbursement & Digital Seal',
      officer: 'Treasury (MTO)',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: ShieldCheck,
      description:
        'Municipal Treasurer executes final 2nd signature releasing Notice of Cash Allocation (NCA), permanently stamping the transaction with a Digital Seal.',
      output: 'NCA Digital Seal',
    },
  ];

  const officerPillars = [
    {
      role: 'MPDO (Planning)',
      office: 'Municipal Planning & Development Office',
      icon: Compass,
      tag: 'Inception & Verification',
      badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
      accentColor: 'border-l-4 border-l-sky-600',
      description:
        'Formulates local development plans, validates project proposals, conducts field inspections, and verifies milestone accomplishment on-site.',
      receipts: ['Project Inception Hash', 'Milestone Verified Proof', 'Disbursement Inception Request'],
      filterParam: 'mpdo',
    },
    {
      role: 'Budget Office',
      office: 'Municipal Budget Office (MBO)',
      icon: Banknote,
      tag: 'SARO & Allotment Authorization',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      accentColor: 'border-l-4 border-l-amber-500',
      description:
        'Reviews budget ceilings, issues Special Allotment Release Orders (SARO), obligates funds, and executes 1st signature multi-sig approval.',
      receipts: ['SARO Allocation Ledger', 'Budget Obligation Sign-off', '1st Multi-Sig Verification'],
      filterParam: 'budget',
    },
    {
      role: 'Municipal Treasury',
      office: 'Municipal Treasury Office (MTO)',
      icon: ShieldCheck,
      tag: 'NCA Payout & Digital Seal',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      accentColor: 'border-l-4 border-l-emerald-600',
      description:
        'Manages cash custody, releases Notice of Cash Allocation (NCA) disbursements to contractors, and anchors the final Digital Seal of Truth on-chain.',
      receipts: ['NCA Disbursement Receipt', 'Digital Seal of Truth', 'Treasury Multi-Sig Execution'],
      filterParam: 'treasurer',
    },
  ];

  const getSectorCount = (keyword: string) => {
    if (isDataLoading) return '0 Projects';
    const count = projects.filter((p) =>
      (p.category || '').toLowerCase().includes(keyword.toLowerCase()) ||
      (p.name || '').toLowerCase().includes(keyword.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(keyword.toLowerCase())
    ).length;
    return `${count} Project${count === 1 ? '' : 's'}`;
  };

  const prioritySectors = [
    {
      title: 'Infrastructure & Connectivity',
      subtitle: 'Barangay farm-to-market roads, drainage networks, and bridge retrofits.',
      icon: Building2,
      count: getSectorCount('infrastructure'),
    },
    {
      title: 'Health & Social Welfare',
      subtitle: 'Rural health centers, maternal clinics, and emergency evacuation facilities.',
      icon: UsersRound,
      count: getSectorCount('health'),
    },
    {
      title: 'Disaster Resilience & Climate',
      subtitle: 'Flood mitigation pumping stations and early warning shoreline telemetry.',
      icon: ShieldAlert,
      count: getSectorCount('disaster'),
    },
    {
      title: 'Public Markets & Economic Hubs',
      subtitle: 'Public market modernization, solar lighting, and civic enterprise spaces.',
      icon: Layers,
      count: getSectorCount('market'),
    },
  ];

  return (
    <div className="bg-white text-slate-900">
      {/* Clean Naga-Inspired Civic Hero with Santa Cruz Town Hall Picture */}
      <section className="relative border-b border-slate-200 bg-[#fcfbf9] pt-12 pb-14 sm:pt-16 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Slogan, Subtitle, CTAs */}
            <div className="lg:col-span-7">
              {/* Government LGU Identifier Pill with Santa Cruz Logo */}
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                <img
                  src="/logo-bayanledger.png"
                  alt="Santa Cruz Laguna Seal"
                  className="h-4 w-4 object-contain"
                />
                <span>Municipality of Santa Cruz, Laguna &bull; BayanLedger</span>
              </div>

              {/* Impactful Civic Slogan */}
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Buwis natin. Proyekto natin. Ledger natin.
              </h1>

              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg font-normal">
                Santa Cruz's official public portal for the Annual Investment Program (AIP).
                Browse municipal programs, track project activities, and inspect tamper-evident
                officer receipts anchored on the Ethereum blockchain.
              </p>

              {/* Action Buttons */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/projects">
                  <Button
                    size="lg"
                    className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
                  >
                    <FolderGit2 className="mr-2 h-4 w-4" />
                    Browse Municipal Projects
                  </Button>
                </Link>
                <Link to="/transactions">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-lg border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 hover:text-slate-950 transition-colors"
                  >
                    <Receipt className="mr-2 h-4 w-4 text-slate-500" />
                    Inspect Officer Receipts
                  </Button>
                </Link>
              </div>

              {/* Accountability Tagline */}
              <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Open Governance &bull; 3-Officer Accountability Triad &bull; 100% Sepolia Audited</span>
              </div>
            </div>

            {/* Right Column: Clean Framed Municipal Town Hall Picture */}
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md group">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <img
                    src="/santa-cruz-town-hall.jpg"
                    alt="Santa Cruz Municipal Town Hall"
                    className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Subtle soft vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-black/10 to-transparent" />

                  {/* Top Seal Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm">
                    <img src="/logo-bayanledger.png" alt="Santa Cruz Seal" className="h-4 w-4 object-contain" />
                    <span>Pamahalaang Bayan</span>
                  </div>

                  {/* Top Right Live Dot */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    <span>Active Portal</span>
                  </div>

                  {/* Bottom Town Hall Caption */}
                  <div className="absolute bottom-3 inset-x-3 rounded-xl bg-white/95 p-3 backdrop-blur-md shadow-sm border border-white/60 text-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Santa Cruz Municipal Town Hall</p>
                        <p className="text-[11px] text-slate-500">Pedro Guevara Ave., Poblacion, Santa Cruz, Laguna</p>
                      </div>
                      <span className="font-mono text-[10px] font-semibold text-slate-400">Laguna 4009</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clean Metric Cards Cluster (Naga Style Summary Row) */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {portalStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-xs text-slate-500 leading-normal">
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Municipal Project Verification Lifecycle */}
      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Activity className="h-3.5 w-3.5 text-blue-600" />
              <span>Project Accountability Lifecycle</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              How Municipal Projects Are Tracked & Verified
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Every municipal project in Santa Cruz follows a four-step verification workflow.
              Funds are released incrementally only after physical milestone accomplishment is
              independently inspected and anchored on-chain.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {projectWorkflow.map((item) => {
              const StepIcon = item.icon;
              return (
                <div
                  key={item.step}
                  className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        Step {item.step}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${item.badgeStyle}`}>
                        {item.output}
                      </span>
                    </div>

                    <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                      <StepIcon className="h-5 w-5" />
                    </div>

                    <h3 className="mt-3 text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">{item.officer}</p>

                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-slate-400 font-medium flex items-center justify-between">
                    <span>Accountable Office</span>
                    <span className="font-semibold text-slate-700">{item.officer}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Three Pillars of Municipal Accountability */}
      <section className="border-b border-slate-200 bg-[#fafaf9] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Scale className="h-3.5 w-3.5 text-slate-700" />
              <span>Separation of Duties</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Three Officers. One Verifiable Chain of Custody.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              In accordance with COA and DBM standards, no single officer can authorize and release
              funds. Inspect cryptographic transaction receipts produced by each responsible office.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {officerPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.role}
                  className={`flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow ${pillar.accentColor}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${pillar.badgeColor}`}>
                        {pillar.tag}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900">{pillar.role}</h3>
                    <p className="text-xs font-medium text-slate-500">{pillar.office}</p>

                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      {pillar.description}
                    </p>

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Receipts Generated:
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                        {pillar.receipts.map((r) => (
                          <li key={r} className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-3">
                    <Link
                      to={`/transactions?officer=${pillar.filterParam}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 hover:text-slate-950"
                    >
                      <span>Filter {pillar.role} Receipts</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Santa Cruz Priority Sectors & Projects */}
      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Santa Cruz Strategic Priority Sectors
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Major development categories funded under the municipal Annual Investment Program.
              </p>
            </div>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-800"
            >
              <span>Explore all projects</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {prioritySectors.map((sector) => {
              const Icon = sector.icon;
              return (
                <div
                  key={sector.title}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:bg-[#fafaf9]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {sector.count}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">{sector.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    {sector.subtitle}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Participatory Governance Callout */}
      <section className="bg-[#fafaf9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                <span>Citizen Monitoring & Feedback</span>
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Participate in Citizen Project Oversight
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Public vigilance strengthens governance across Santa Cruz. Notice an ongoing infrastructure
                project or want to verify physical milestone completion in your barangay? Every project profile
                on this portal accepts community feedback and citizen monitoring submissions.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/projects">
                  <Button className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">
                    Browse Projects & Submit Feedback
                  </Button>
                </Link>
                <Link to="/transactions">
                  <Button variant="outline" className="rounded-lg border-slate-300 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    View Cryptographic Ledger
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
