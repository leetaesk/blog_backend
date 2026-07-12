import cron from "node-cron";
import { query } from "../db";
import { askClaude } from "../bot/claude";
import { notifyDiscord, SITE_URL } from "../utils/discordNotify";
import config from "../config";

// 매일 아침 8시(KST) "오늘의 개발지식"을 전용 웹훅 채널로 발송하는 크론잡.
// - 발송 이력은 daily_knowledge 테이블에 기록하고, 과거 주제를 제외 목록으로
//   프롬프트에 주입해 중복을 방지한다.
// - 요일별 분야 로테이션으로 주제가 한 분야에 몰리는 것을 막는다.

const CRON_EXPR = "0 8 * * *"; // 매일 08:00 (timezone 옵션으로 KST 적용)
const KST = "Asia/Seoul";
const SENDER_NAME = "오늘의 개발지식";
const SENDER_AVATAR = `${SITE_URL}/apple-touch-icon.png`;
const EMBED_COLOR = 0xf5a623; // 아침 느낌의 주황

// 프롬프트에 넣을 과거 주제 개수 (한 줄짜리라 180개여도 수천 토큰 수준)
const EXCLUDE_LIMIT = 180;

// getUTCDay() 기준: 0=일요일
const FIELD_BY_DAY = [
    "CS 기초",
    "네트워크",
    "데이터베이스",
    "OS/시스템",
    "언어/프레임워크",
    "아키텍처/설계",
    "보안",
];

const TOPIC_SEP = "---본문---";

const SYSTEM_PROMPT_BASE = `당신은 매일 아침 개발자에게 "오늘의 개발지식" 한 편을 전하는 시니어 엔지니어입니다.
하루에 주제 하나를 골라, 출근길에 5분 안에 읽을 수 있는 밀도 높은 글을 한국어로 씁니다.

주제 선정 규칙:
- 반드시 오늘의 분야 안에서 주제를 고르세요.
- 아래 "이미 다룬 주제" 목록과 겹치면 안 됩니다. 제목이 달라도 핵심 내용이 겹치면 다른 주제를 고르세요.
- 유행어 나열이 아니라, 실무에서 두고두고 쓰이는 지식을 우선하세요.
- 필요하면 웹 검색으로 사실을 확인하되, 확실하지 않은 내용은 단정하지 마세요.

본문 작성 규칙:
- 구성: 개념 설명 → **왜 중요한가?** → 예시 코드(언어를 명시한 코드블록) → 💡 한 줄 요약
- 소제목은 마크다운 헤딩(#) 대신 **굵은 글씨**를 사용하세요. (디스코드 임베드에 들어갑니다)
- 분량: 공백 포함 2,000~3,000자. 절대 3,500자를 넘기지 마세요.

출력 형식 (정확히 이 형식만 출력, 코드펜스로 감싸지 말 것):
topic: 주제 이름 (간결하게, 60자 이내)
keywords: 핵심 키워드 3~5개를 쉼표로 구분
${TOPIC_SEP}
(여기에 본문 마크다운)`;

interface DailyPost {
    topic: string;
    keywords: string[];
    content: string;
}

// KST 기준 오늘 날짜 "YYYY-MM-DD"
const kstToday = (): string =>
    new Date().toLocaleDateString("en-CA", { timeZone: KST });

// "YYYY-MM-DD" → 그 날짜의 요일별 분야
const fieldForDate = (dateStr: string): string =>
    FIELD_BY_DAY[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];

// "YYYY-MM-DD" → "7/12 (토)" 형태의 표시용 날짜
const displayDate = (dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${weekday})`;
};

const ensureTable = async (): Promise<void> => {
    await query(`
        CREATE TABLE IF NOT EXISTS daily_knowledge (
            id SERIAL PRIMARY KEY,
            topic VARCHAR(255) NOT NULL UNIQUE,
            field VARCHAR(50) NOT NULL,
            keywords TEXT[] NOT NULL DEFAULT '{}',
            content TEXT NOT NULL,
            sent_on DATE NOT NULL UNIQUE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

/** Claude 응답에서 topic/keywords/본문을 파싱한다. */
export const parseDailyPost = (text: string): DailyPost | null => {
    const sepIdx = text.indexOf(TOPIC_SEP);
    if (sepIdx === -1) return null;

    const metaPart = text.slice(0, sepIdx);
    const content = text.slice(sepIdx + TOPIC_SEP.length).trim();

    const meta: Record<string, string> = {};
    for (const line of metaPart.split("\n")) {
        const m = line.match(/^\s*(topic|keywords)\s*:\s*(.*)$/i);
        if (m) meta[m[1].toLowerCase()] = m[2].trim();
    }

    if (!meta.topic || !content) return null;

    const keywords = (meta.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

    return { topic: meta.topic.slice(0, 255), keywords, content };
};

const generatePost = async (
    field: string,
    today: string,
    excludeTopics: string[],
    extraExclude: string[] = []
): Promise<DailyPost> => {
    const excludeList = [...extraExclude, ...excludeTopics];
    const excludeText =
        excludeList.length > 0
            ? excludeList.map((t) => `- ${t}`).join("\n")
            : "(아직 없음)";

    const systemPrompt = `${SYSTEM_PROMPT_BASE}

[이미 다룬 주제 — 절대 겹치지 말 것]
${excludeText}`;

    const userMessage = `오늘의 개발지식을 작성해주세요. 오늘 날짜: ${today}, 오늘의 분야: ${field}`;

    const { text } = await askClaude(userMessage, null, systemPrompt);
    const post = parseDailyPost(text);
    if (!post) {
        throw new Error(`응답 파싱 실패: ${text.slice(0, 200)}`);
    }
    return post;
};

// 크론과 캐치업이 동시에 도는 것을 방지
let running = false;

/**
 * 오늘의 개발지식 1회 실행: 미발송이면 생성 → 디스코드 발송 → DB 기록.
 * 이미 오늘 자 발송 기록이 있으면 아무것도 하지 않는다.
 */
export const runDailyKnowledge = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
        const today = kstToday();

        const sent = await query(
            "SELECT 1 FROM daily_knowledge WHERE sent_on = $1",
            [today]
        );
        if ((sent.rowCount ?? 0) > 0) {
            console.log(`📚 오늘의 개발지식: ${today} 자 발송 완료 — 스킵`);
            return;
        }

        const recent = await query(
            "SELECT topic, keywords FROM daily_knowledge ORDER BY sent_on DESC LIMIT $1",
            [EXCLUDE_LIMIT]
        );
        const excludeTopics = recent.rows.map((r: any) => {
            const kw = (r.keywords ?? []).join(", ");
            return kw ? `${r.topic} (${kw})` : r.topic;
        });

        const field = fieldForDate(today);
        console.log(`📚 오늘의 개발지식 생성 시작 — ${today} / ${field}`);

        let post = await generatePost(field, today, excludeTopics);

        // 제외 목록(최근 180개) 밖의 옛 주제와 정확히 겹치면 1회 재생성
        const dup = await query(
            "SELECT 1 FROM daily_knowledge WHERE topic = $1",
            [post.topic]
        );
        if ((dup.rowCount ?? 0) > 0) {
            console.warn(`⚠️ 주제 중복(${post.topic}) — 재생성 시도`);
            post = await generatePost(field, today, excludeTopics, [
                post.topic,
            ]);
        }

        const ok = await notifyDiscord({
            webhookUrl: config.discord.dailyWebhookUrl,
            username: SENDER_NAME,
            avatarUrl: SENDER_AVATAR,
            title: `📚 ${post.topic}`,
            description: post.content.slice(0, 4000),
            color: EMBED_COLOR,
            fields: [
                { name: "분야", value: field, inline: true },
                { name: "날짜", value: displayDate(today), inline: true },
            ],
        });
        if (!ok) {
            throw new Error("디스코드 웹훅 발송 실패");
        }

        try {
            await query(
                `INSERT INTO daily_knowledge (topic, field, keywords, content, sent_on)
                 VALUES ($1, $2, $3, $4, $5)`,
                [post.topic, field, post.keywords, post.content, today]
            );
        } catch (err) {
            // topic UNIQUE 충돌 등으로 기록이 실패해도 발송일은 반드시 남긴다
            // (기록이 없으면 재시작 시 캐치업이 같은 날 다시 발송하게 됨)
            console.error("⚠️ 발송 기록 저장 실패 — 주제에 날짜를 붙여 재시도:", err);
            await query(
                `INSERT INTO daily_knowledge (topic, field, keywords, content, sent_on)
                 VALUES ($1, $2, $3, $4, $5)`,
                [`${post.topic} (${today})`, field, post.keywords, post.content, today]
            );
        }

        console.log(`✅ 오늘의 개발지식 발송 완료 — ${post.topic}`);
    } catch (err) {
        console.error("🔥 오늘의 개발지식 실행 실패:", err);
    } finally {
        running = false;
    }
};

/**
 * 데일리 크론잡을 시작합니다.
 * - DISCORD_DAILY_WEBHOOK_URL이 없으면 조용히 비활성화됩니다.
 * - 서버 시작 시점이 이미 오늘 8시(KST)를 지났고 미발송이면 30초 뒤 캐치업 발송.
 */
export const startDailyKnowledge = (): void => {
    if (!config.discord.dailyWebhookUrl) {
        console.log("ℹ️ DISCORD_DAILY_WEBHOOK_URL 없음 — 오늘의 개발지식 비활성화");
        return;
    }

    ensureTable()
        .then(() => {
            cron.schedule(CRON_EXPR, runDailyKnowledge, { timezone: KST });
            console.log(`⏰ 오늘의 개발지식 크론 등록 완료 (매일 08:00 KST)`);

            const kstHour = Number(
                new Intl.DateTimeFormat("en-GB", {
                    timeZone: KST,
                    hour: "2-digit",
                    hour12: false,
                }).format(new Date())
            );
            if (kstHour >= 8) {
                // 8시에 재배포/재시작 중이었어도 그날 치를 놓치지 않도록 캐치업
                setTimeout(() => void runDailyKnowledge(), 30_000);
            }
        })
        .catch((err) => {
            console.error("🔥 daily_knowledge 테이블 준비 실패:", err);
        });
};
