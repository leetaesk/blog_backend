import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

// 코드블록을 highlight.js 클래스로 변환해 블로그 렌더링과 일관성을 맞춘다.
const marked = new Marked(
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            return hljs.highlight(code, { language }).value;
        },
    })
);

/** 마크다운 문자열을 게시글 저장용 HTML로 변환합니다. (저장 시 서버에서 sanitize됨) */
export const markdownToHtml = (md: string): string => {
    return marked.parse(md, { async: false }) as string;
};
