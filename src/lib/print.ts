import { pageImg } from "./data";

/** 편람 원문 페이지 이미지를 새 창에 모아 인쇄 */
export function printPages(title: string, pages: number[]) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("팝업이 차단되어 인쇄 창을 열 수 없습니다. 브라우저에서 팝업을 허용해 주세요.");
    return;
  }
  const base = new URL(document.baseURI);
  const imgs = pages
    .map((p) => `<img src="${new URL(pageImg(p), base).href}" alt="${p}쪽">`)
    .join("");
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
<style>@page{size:A4;margin:0}body{margin:0}img{display:block;width:100%;page-break-after:always}img:last-child{page-break-after:auto}</style>
</head><body>${imgs}<script>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>{print()})</script></body></html>`);
  w.document.close();
}
