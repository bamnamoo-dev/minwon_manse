import { GuideDetail } from "./components/GuideDetail";
import { MinwonDetail } from "./components/MinwonDetail";
import { SearchPage } from "./components/SearchPage";
import { useAppData, type AppData } from "./lib/data";
import { useRoute, type Route } from "./lib/router";

export default function App() {
  const { data, error } = useAppData();
  const route = useRoute();

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <a href="#/" className="flex items-center gap-2 font-bold text-brand-700">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            <span className="text-lg">민원만세</span>
          </a>
          <span className="hidden text-sm text-gray-500 sm:inline">담당자용 종합 민원 검색</span>
          {data && <span className="ml-auto text-xs text-gray-400">{data.bundle.version} 기준</span>}
        </div>
      </header>

      <main>
        {error && <p className="p-8 text-center text-red-600">{error}</p>}
        {!data && !error && <p className="p-8 text-center text-gray-500">불러오는 중…</p>}
        {data && <Page data={data} route={route} />}
      </main>
    </div>
  );
}

function Page({ data, route }: { data: AppData; route: Route }) {
  const [kind, id] = route.path;
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
    <div className="p-10 text-center">
      <p className="text-gray-600">찾는 페이지가 없습니다.</p>
      <a href="#/" className="mt-3 inline-block text-brand-600 underline">
        검색으로 돌아가기
      </a>
    </div>
  );
}
