import axios from "axios";
import config from "../config";

// 블로그 기본 정보 (알림 footer/링크에 공통으로 사용)
const SITE_URL = "https://leetaesk.com";
const SITE_NAME = "leetaesk.com";
const SITE_LOGO_URL = `${SITE_URL}/apple-touch-icon.png`;

interface DiscordField {
    name: string;
    value: string;
    inline?: boolean;
}

interface DiscordAuthor {
    name: string;
    iconUrl?: string; // 이름 왼쪽 작은 원형 아이콘 (예: 작성자 프로필 사진)
    url?: string;
}

interface DiscordFooter {
    text: string;
    iconUrl?: string;
}

interface NotifyOptions {
    title: string;
    description?: string;
    color?: number; // 임베드 좌측 색상 막대 (기본: 디스코드 블루)
    fields?: DiscordField[];
    url?: string; // 제목 클릭 시 이동할 링크
    author?: DiscordAuthor; // 상단 작성자 영역
    thumbnailUrl?: string; // 우상단 작은 이미지
    footer?: DiscordFooter; // 미지정 시 블로그 기본 footer 자동 적용
    webhookUrl?: string; // 미지정 시 기본 알림 웹훅(DISCORD_WEBHOOK_URL) 사용
    username?: string; // 웹훅 발신자 이름 오버라이드 (별도 봇처럼 보이게)
    avatarUrl?: string; // 웹훅 발신자 아바타 오버라이드
}

/**
 * 디스코드 채널에 알림을 보냅니다. (Incoming Webhook)
 *
 * - 설정(DISCORD_WEBHOOK_URL)이 없으면 조용히 무시합니다. (로컬/개발 환경 대비)
 * - 절대 throw하지 않고, await 없이 fire-and-forget으로 호출하도록 설계되어
 *   알림 전송 실패가 본래의 요청(댓글 작성·좋아요·로그인 등)을 깨지 않습니다.
 * - 전송 성공 여부가 필요한 곳(예: 데일리 크론잡)은 await하면 boolean을 받습니다.
 */
export const notifyDiscord = (options: NotifyOptions): Promise<boolean> => {
    const webhookUrl = options.webhookUrl ?? config.discord.webhookUrl;
    if (!webhookUrl) return Promise.resolve(false);

    // footer 미지정 시 블로그 기본 footer 적용
    const footer = options.footer ?? {
        text: SITE_NAME,
        iconUrl: SITE_LOGO_URL,
    };

    const embed = {
        title: options.title,
        description: options.description,
        color: options.color ?? 0x5865f2,
        url: options.url,
        fields: options.fields,
        author: options.author && {
            name: options.author.name,
            icon_url: options.author.iconUrl,
            url: options.author.url,
        },
        thumbnail: options.thumbnailUrl
            ? { url: options.thumbnailUrl }
            : undefined,
        footer: { text: footer.text, icon_url: footer.iconUrl },
        timestamp: new Date().toISOString(),
    };

    return axios
        .post(webhookUrl, {
            username: options.username,
            avatar_url: options.avatarUrl,
            embeds: [embed],
        })
        .then(() => true)
        .catch((err) => {
            console.error(
                "⚠️ Discord 알림 전송 실패:",
                err?.response?.data ?? err?.message ?? err
            );
            return false;
        });
};

export { SITE_URL };
