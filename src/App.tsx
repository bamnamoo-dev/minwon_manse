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
      <header className="no-print sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900 transition hover:opacity-80">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            <span className="text-lg text-brand-700">민원만세</span>
          </a>
          <span className="hidden border-l border-slate-200 pl-3 text-xs font-medium text-slate-500 md:inline">
            서울시교육청 민원편람 실무 검색
          </span>
          <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="주 메뉴">
            <a
              href="#/"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                !isJudge ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <SearchIcon size={15} />
              <span>민원 검색</span>
            </a>
            <a
              href="#/judge"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                isJudge ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <CompassIcon size={15} />
              <span>발급경로 판별</span>
            </a>
          </nav>
          {data && (
            <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 lg:inline">
              {data.bundle.version}
            </span>
          )}
        </div>
      </header>

      <main>
        {error && (
          <div className="mx-auto max-w-md p-8 text-center">
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
          </div>
        )}
        {!data && !error && (
          <div className="p-16 text-center text-sm text-slate-500">민원 데이터를 불러오는 중…</div>
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
