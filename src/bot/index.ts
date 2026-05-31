import {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    MessageFlags,
    Interaction,
} from "discord.js";
import config from "../config";

const { botToken, ownerId, guildId } = config.discord;

// =======================================================
// 슬래시 명령 정의 (Phase 1: /ping 만)
// =======================================================
const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("봇이 살아있는지 확인합니다")
        .toJSON(),
];

/**
 * 슬래시 명령을 "특정 서버(guild)"에 등록합니다.
 * - guild 등록은 즉시 반영됩니다. (전역 등록은 최대 1시간 소요)
 */
const registerCommands = async (clientId: string): Promise<void> => {
    if (!botToken || !guildId) {
        console.log(
            "ℹ️ DISCORD_GUILD_ID 없음 — 슬래시 명령 등록 건너뜀"
        );
        return;
    }
    const rest = new REST({ version: "10" }).setToken(botToken);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
    });
    console.log(`✅ 슬래시 명령 등록 완료 (${commands.length}개, guild)`);
};

/**
 * 디스코드 글쓰기 봇을 시작합니다.
 * - DISCORD_BOT_TOKEN이 없으면 조용히 비활성화됩니다. (로컬/개발 환경 대비)
 * - 본 서버(Express) 프로세스와 함께 EC2에서 상시 실행됩니다.
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
            GatewayIntentBits.MessageContent, // 추후 쓰레드 대화 읽기용
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

    // 상호작용(슬래시 명령) 처리
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;

        // ⭐️ 권한 가드: 운영자(ownerId)만 사용 가능
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
        }
    });

    client.login(botToken).catch((err) => {
        console.error("🔥 디스코드 봇 로그인 실패:", err);
    });
};
