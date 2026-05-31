import spawn from "cross-spawn";
import os from "os";

// 구독(claude CLI) 사용. 품질 우선이면 "opus"로 변경.
const MODEL = "sonnet";

// 초안 블록 구분자
export const DRAFT_START = "[[[DRAFT]]]";
export const DRAFT_END = "[[[/DRAFT]]]";
const BODY_SEP = "---본문---";

// 블로그 작가 페르소나 — 자료조사는 허용하되 코드/파일 수정은 차단한다.
const BASE_PROMPT = `당신은 "leetaesk.com" 개인 기술 블로그의 전문 작가입니다.
블로그 운영자와 한국어로 대화하며 글을 함께 기획하고 초안을 작성합니다.

역할과 권한:
- 당신은 블로그 작가입니다. 코딩 에이전트가 아닙니다.
- 자료 조사가 필요하면 웹 검색(WebSearch, WebFetch)으로 최신 정보를 확인해도 됩니다.
- 운영자가 붙여넣거나 첨부한 파일·텍스트를 읽고 참고해 글을 쓸 수 있습니다.
- 절대 금지: 블로그 코드·리포지토리·파일을 생성/수정/삭제하지 마세요. 파일 쓰기·편집, 셸 명령 실행은 하지 않습니다. 당신의 결과물은 오직 "대화 + 글 초안 텍스트"뿐입니다.

작성 원칙:
- 주제가 모호하면 독자 타겟/톤/범위를 짧게 먼저 물어보고, 방향이 정해지면 초안을 작성합니다.
- 기술 블로그답게 정확하고 군더더기 없이 쓰고, 코드 예시는 코드블록으로 제시하세요.
- 웹 검색으로 얻은 사실은 정확히 반영하되, 확실하지 않으면 단정하지 마세요.`;

const DRAFT_FORMAT_RULES = (categoryList: string) => `
[초안 출력 규칙]
글 초안을 처음 만들거나 수정할 때는, 대화 답변(1~3문장) 뒤에 아래 형식의 초안 블록을 정확히 그대로 덧붙이세요.
초안을 보여줄 필요가 없는 순수 질문/대화 턴에서는 블록을 생략합니다.

${DRAFT_START}
title: 글 제목
summary: 한 줄 요약 (100자 이내)
category: 아래 목록 중 정확히 하나
tags: 태그1, 태그2, 태그3
${BODY_SEP}
(여기에 마크다운 본문)
${DRAFT_END}

- 초안 블록을 코드펜스(\`\`\`)로 감싸지 마세요.
- category는 반드시 다음 중 하나여야 합니다: ${categoryList || "(카테고리 없음 — 새 이름 자유)"}. 마땅한 게 없으면 가장 가까운 것을 고르세요.
- 본문은 완전한 마크다운으로, 소제목과 코드블록을 적절히 사용하세요.`;

/** 카테고리 목록을 반영한 시스템 프롬프트를 만든다. */
export const buildSystemPrompt = (categoryNames: string[]): string => {
    return BASE_PROMPT + "\n" + DRAFT_FORMAT_RULES(categoryNames.join(", "));
};

export interface ParsedDraft {
    title: string;
    summary: string;
    category: string;
    tags: string[];
    bodyMarkdown: string;
    thumbnailUrl?: string; // 썸네일 이미지 URL (수동 업로드 또는 그록 생성)
}

export interface ParseResult {
    chat: string;
    draft: ParsedDraft | null;
}

/** Claude 응답에서 대화 텍스트와 초안 블록을 분리해 파싱한다. */
export const parseDraft = (text: string): ParseResult => {
    const start = text.indexOf(DRAFT_START);
    const end = text.lastIndexOf(DRAFT_END);
    if (start === -1 || end === -1 || end < start) {
        return { chat: text.trim(), draft: null };
    }

    const chat = text.slice(0, start).trim();
    const block = text.slice(start + DRAFT_START.length, end);

    const sepIdx = block.indexOf(BODY_SEP);
    const metaPart = sepIdx === -1 ? block : block.slice(0, sepIdx);
    const bodyMarkdown =
        sepIdx === -1 ? "" : block.slice(sepIdx + BODY_SEP.length).trim();

    const meta: Record<string, string> = {};
    for (const line of metaPart.split("\n")) {
        const m = line.match(/^\s*(title|summary|category|tags)\s*:\s*(.*)$/i);
        if (m) meta[m[1].toLowerCase()] = m[2].trim();
    }

    const tags = (meta.tags ?? "")
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);

    const draft: ParsedDraft = {
        title: (meta.title ?? "제목 없음").slice(0, 255),
        summary: (meta.summary ?? "").slice(0, 255),
        category: meta.category ?? "",
        tags,
        bodyMarkdown,
    };

    return { chat: chat || "초안을 업데이트했어요 👇", draft };
};

interface AskResult {
    text: string;
    sessionId: string | null;
}

/**
 * Claude를 헤드리스(`claude -p`)로 호출해 한 번의 응답을 받습니다.
 * - 구독 인증(CLAUDE_CODE_OAUTH_TOKEN 또는 로컬 로그인)을 그대로 사용합니다.
 * - sessionId를 넘기면 이전 대화를 이어갑니다(멀티턴).
 * - 중립 cwd(임시폴더)에서 실행해 블로그 repo 컨텍스트가 새지 않게 합니다.
 */
export const askClaude = (
    userMessage: string,
    sessionId: string | null,
    systemPrompt: string
): Promise<AskResult> => {
    return new Promise((resolve, reject) => {
        const args = [
            "-p",
            "--output-format",
            "json",
            "--model",
            MODEL,
            "--system-prompt",
            systemPrompt,
            "--allowedTools",
            "WebSearch,WebFetch", // 자료조사용 검색만 허용 (파일 쓰기·셸은 불허)
            "--setting-sources",
            "", // CLAUDE.md/설정 자동 로딩 차단
        ];
        if (sessionId) {
            args.push("--resume", sessionId);
        }

        const child = spawn("claude", args, {
            cwd: os.tmpdir(),
            env: process.env, // CLAUDE_CODE_OAUTH_TOKEN 포함
        });

        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d) => (stdout += d.toString()));
        child.stderr?.on("data", (d) => (stderr += d.toString()));

        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
            if (code !== 0) {
                return reject(
                    new Error(
                        `claude 종료 코드 ${code}: ${stderr.slice(0, 500)}`
                    )
                );
            }
            try {
                const json = JSON.parse(stdout);
                if (json.is_error) {
                    return reject(
                        new Error(`claude 오류: ${json.result ?? json.subtype}`)
                    );
                }
                resolve({
                    text: typeof json.result === "string" ? json.result : "",
                    sessionId: json.session_id ?? null,
                });
            } catch {
                reject(
                    new Error(`claude 출력 파싱 실패: ${stdout.slice(0, 300)}`)
                );
            }
        });

        child.stdin?.write(userMessage, "utf8");
        child.stdin?.end();
    });
};
