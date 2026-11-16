import type { ReactNode } from "react";
import { GuideDetail } from "./components/GuideDetail";
import { CompassIcon, SearchIcon } from "./components/Icons";
import { JudgePage } from "./components/Judge";
import { MinwonDetail } from "./components/MinwonDetail";
import { SearchPage } from "./components/SearchPage";
import { useAppData, type AppData } from "./lib/data";
import { useRoute, type Route } from "./lib/router";

export default function App() {
  const { data, error } = useAppData();
  const route = useRoute();
  const isJudge = route.path[0] === "judge";

  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 whitespace-nowrap px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2 text-ink hover:opacity-80">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6" />
            <span className="text-[17px] font-bold tracking-[-0.02em]">민원만세</span>
          </a>
          <span className="hidden text-[13px] text-muted md:inline">서울시교육청 민원편람 실무 검색</span>
          <nav className="ml-auto flex h-full items-stretch gap-5 text-sm" aria-label="주 메뉴">
            <NavLink href="#/" active={!isJudge} icon={<SearchIcon size={14} />}>
              민원 검색
            </NavLink>
            <NavLink href="#/judge" active={isJudge} icon={<CompassIcon size={14} />}>
              발급경로 판별
            </NavLink>
          </nav>
          {data && <span className="hidden text-xs text-muted lg:inline">{data.bundle.version}</span>}
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
      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 transition-colors ${
        active ? "border-ink font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </a>
  );
}
