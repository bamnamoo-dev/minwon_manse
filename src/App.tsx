import type { ReactNode } from "react";
import { GuideDetail } from "./components/GuideDetail";
import { FormsPage } from "./components/FormsPage";
import { CompassIcon, FileTextIcon, SearchIcon } from "./components/Icons";
import { JudgePage } from "./components/Judge";
import { MinwonDetail } from "./components/MinwonDetail";
import { SearchPage } from "./components/SearchPage";
import { useAppData, type AppData } from "./lib/data";
import { useRoute, type Route } from "./lib/router";

export default function App() {
  const { data, error } = useAppData();
  const route = useRoute();
  const section = route.path[0] ?? "";
  const isJudge = section === "judge";
  const isForms = section === "forms";

  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 whitespace-nowrap px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2 text-white hover:opacity-90">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[13px] font-bold text-navy">민</span>
            <span className="text-[17px] font-bold tracking-[-0.02em]">민원만세</span>
          </a>
          <span className="hidden text-[13px] text-white/60 md:inline">서울시교육청 민원편람 실무 검색</span>
          <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="주 메뉴">
            <NavLink href="#/" active={!isJudge && !isForms} icon={<SearchIcon size={14} />}>
              민원 검색
            </NavLink>
            <NavLink href="#/judge" active={isJudge} icon={<CompassIcon size={14} />}>
              발급경로 판별
            </NavLink>
            <NavLink href="#/forms" active={isForms} icon={<FileTextIcon size={14} />}>
              서식함
            </NavLink>
          </nav>
          {data && <span className="ml-2 hidden text-xs text-white/50 lg:inline">{data.bundle.version}</span>}
        </div>
      </header>

      <main>
        {error && (
          <div className="mx-auto max-w-md p-8 text-center">
            <p className="border-l-2 border-rose-600 pl-3 text-left text-sm text-rose-800">{error}</p>
          </div>
        )}
        {!data && !error && (
          <div className="p-16 text-center text-sm text-muted">민원 데이터를 불러오는 중…</div>
        )}
        {data && <Page data={data} route={route} />}
      </main>
    </div>
  );
}

function Page({ data, route }: { data: AppData; route: Route }) {
  const [kind, id] = route.path;
  if (kind === "judge") return <JudgePage data={data} />;
  if (kind === "forms") return <FormsPage data={data} />;
  if (kind === "m") {
    const m = data.minwonById.get(id);
    return m ? <MinwonDetail data={data} m={m} /> : <NotFound />;
  }
  if (kind === "g") {
    const g = data.guideById.get(id);
    return g ? <GuideDetail g={g} /> : <NotFound />;
  }
  return <SearchPage key="search" data={data} q={route.params.get("q") ?? ""} cat={route.params.get("c") ?? ""} />;
}

function NotFound() {
  return (
    <div className="p-12 text-center">
      <p className="text-slate-600">찾는 페이지가 없습니다.</p>
      <a href="#/" className="mt-3 inline-block text-sm font-medium text-brand-600 underline">
        검색으로 돌아가기
      </a>
    </div>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
        active ? "bg-white/12 font-semibold text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
      }`}
    >
      {icon}
      {children}
    </a>
  );
}
