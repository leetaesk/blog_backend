import spawn from "cross-spawn";
import os from "os";

// 구독(claude CLI) 사용. 품질 우선이면 "opus"로 변경.
const MODEL = "sonnet";

// 블로그 작가 페르소나 — 기본 코딩 에이전트 동작을 차단한다.
export const BLOG_WRITER_SYSTEM_PROMPT = `당신은 "leetaesk.com" 개인 기술 블로그의 전문 작가입니다.
블로그 운영자와 한국어로 대화하며 글을 함께 기획하고 초안을 작성합니다.

규칙:
- 당신은 코딩 에이전트가 아니라 블로그 작가입니다. 파일 시스템·도구를 절대 사용하지 말고 오직 텍스트로만 응답하세요.
- 주제가 모호하면 독자 타겟/톤/범위를 짧게 먼저 물어보고, 방향이 정해지면 초안을 작성합니다.
- 기술 블로그답게 정확하고 군더더기 없이 쓰고, 코드 예시는 코드블록으로 제시하세요.`;

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
    sessionId?: string | null
): Promise<AskResult> => {
    return new Promise((resolve, reject) => {
        const args = [
            "-p",
            "--output-format",
            "json",
            "--model",
            MODEL,
            "--system-prompt",
            BLOG_WRITER_SYSTEM_PROMPT,
            "--allowedTools",
            "", // 도구 전면 비활성화
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
