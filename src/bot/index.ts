import {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    MessageFlags,
    ChannelType,
    Interaction,
    Message,
    TextChannel,
    ThreadChannel,
} from "discord.js";
import config from "../config";
import { askClaude } from "./claude";

const { botToken, ownerId, guildId } = config.discord;

// =======================================================
// 글쓰기 세션 상태 (메모리) — threadId → 세션
//   claudeSessionId: claude -p 의 세션 id (멀티턴 이어가기용)
//   ※ DB 영속화는 추후. 디스코드 쓰레드 자체가 대화 기록을 보관함.
// =======================================================
interface WritingSession {
    claudeSessionId: string | null;
}
const sessions = new Map<string, WritingSession>();

// =======================================================
// 슬래시 명령 정의
// =======================================================
const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("봇이 살아있는지 확인합니다")
        .toJSON(),
    new SlashCommandBuilder()
        .setName("글쓰기")
        .setDescription("AI와 대화하며 블로그 글을 작성하는 세션을 시작합니다")
        .toJSON(),
];

const registerCommands = async (clientId: string): Promise<void> => {
    if (!botToken || !guildId) {
        console.log("ℹ️ DISCORD_GUILD_ID 없음 — 슬래시 명령 등록 건너뜀");
        return;
    }
    const rest = new REST({ version: "10" }).setToken(botToken);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
    });
    console.log(`✅ 슬래시 명령 등록 완료 (${commands.length}개, guild)`);
};

// 디스코드 메시지 길이 한계(2000자)에 맞춰 나눠 전송
const sendChunked = async (
    channel: TextChannel | ThreadChannel,
    text: string
): Promise<void> => {
    const MAX = 1900;
    const content = text.length > 0 ? text : "(빈 응답)";
    for (let i = 0; i < content.length; i += MAX) {
        await channel.send(content.slice(i, i + MAX));
    }
};

/**
 * 디스코드 글쓰기 봇을 시작합니다.
 * - DISCORD_BOT_TOKEN이 없으면 조용히 비활성화됩니다. (로컬/개발 환경 대비)
 */
export const startBot = (): void => {
    if (!botToken) {
        console.log("ℹ️ DISCORD_BOT_TOKEN 없음 — 글쓰기 봇 비활성화");
        return;
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    // 로그인 완료
    client.once(Events.ClientReady, async (c) => {
        console.log(`🤖 디스코드 봇 로그인 성공: ${c.user.tag}`);
        try {
            await registerCommands(c.user.id);
        } catch (err) {
            console.error("⚠️ 슬래시 명령 등록 실패:", err);
        }
    });

    // ===================================================
    // 슬래시 명령 처리
    // ===================================================
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;

        // ⭐️ 권한 가드: 운영자(ownerId)만
        if (ownerId && interaction.user.id !== ownerId) {
            await interaction.reply({
                content: "⛔ 이 봇은 블로그 운영자만 사용할 수 있어요.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.commandName === "ping") {
            const latency = Math.round(client.ws.ping);
            await interaction.reply({
                content: `🏓 퐁! 봇 정상 작동 중 (게이트웨이 지연 ${latency}ms)`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.commandName === "글쓰기") {
            const channel = interaction.channel;
            // 쓰레드를 만들 수 있는 일반 텍스트 채널에서만 허용
            if (!channel || channel.type !== ChannelType.GuildText) {
                await interaction.reply({
                    content: "일반 텍스트 채널에서 실행해주세요.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const thread = await channel.threads.create({
                    name: `✍️ 글쓰기 ${new Date().toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                    })}`,
                    autoArchiveDuration: 60,
                    type: ChannelType.PublicThread,
                });

                sessions.set(thread.id, { claudeSessionId: null });

                await thread.send(
                    "✍️ **글쓰기 세션을 시작합니다!**\n" +
                        "어떤 주제로 글을 쓰고 싶으세요? 편하게 말씀해주시면 같이 다듬어볼게요.\n" +
                        "_(이 쓰레드 안에서 자유롭게 대화하면 됩니다.)_"
                );

                await interaction.editReply(
                    `쓰레드를 만들었어요 → ${thread.toString()}`
                );
            } catch (err) {
                console.error("⚠️ 쓰레드 생성 실패:", err);
                await interaction.editReply(
                    "⚠️ 쓰레드를 만들지 못했어요. 봇 권한(쓰레드 생성)을 확인해주세요."
                );
            }
            return;
        }
    });

    // ===================================================
    // 쓰레드 내 대화 처리 (Claude 연결)
    // ===================================================
    client.on(Events.MessageCreate, async (message: Message) => {
        if (message.author.bot) return; // 봇(자기 포함) 메시지 무시

        const session = sessions.get(message.channelId);
        if (!session) return; // 글쓰기 세션 쓰레드가 아니면 무시

        // ⭐️ 권한 가드: 운영자만
        if (ownerId && message.author.id !== ownerId) return;

        const content = message.content.trim();
        if (!content) return;

        const channel = message.channel;
        if (!channel.isThread()) return;

        // 입력 중 표시
        await channel.sendTyping().catch(() => {});

        try {
            const { text, sessionId } = await askClaude(
                content,
                session.claudeSessionId
            );
            session.claudeSessionId = sessionId;
            await sendChunked(channel, text);
        } catch (err) {
            console.error("⚠️ Claude 호출 실패:", err);
            await channel
                .send("⚠️ 글 생성 중 오류가 났어요. 잠시 후 다시 시도해주세요.")
                .catch(() => {});
        }
    });

    client.login(botToken).catch((err) => {
        console.error("🔥 디스코드 봇 로그인 실패:", err);
    });
};
