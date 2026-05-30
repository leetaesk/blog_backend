// 본문 HTML 정화(sanitize) 공용 유틸.
// 프론트(BlockNote)가 직렬화한 HTML을 저장/조회할 때 서버에서 한 번 더 방어한다.
// DOMPurify는 브라우저 DOM이 필요하므로 Node 환경에서는 jsdom 가상 DOM을 사용한다.

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window as any);

// highlight.js가 쓰는 <span class="hljs..."> 를 보존하기 위해 span 태그와 class 속성을 허용한다.
// BlockNote 표준 태그(h1~h3, ul/ol/li, a, img, pre, code, table, blockquote 등)는 DOMPurify 기본 허용.
const SANITIZE_CONFIG = {
    ADD_TAGS: ["span"],
    ADD_ATTR: ["class"],
};

/** 임의 HTML 문자열을 정화해서 반환. null/undefined는 빈 문자열로 처리. */
export const sanitizeHtml = (html: string | null | undefined): string => {
    return DOMPurify.sanitize(html || "", SANITIZE_CONFIG);
};
