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
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from "discord.js";
import config from "../config";
import {
    askClaude,
    buildSystemPrompt,
    parseDraft,
    ParsedDraft,
} from "./claude";
import { buildDraftMessage } from "./draftView";
import { markdownToHtml } from "./markdown";
import { generateImage } from "./grok";
import { postPost, createDraft } from "../posts/posts.service";
import { getCategories, createCategory } from "../categories/categories.service";
import { uploadBuffer } from "../images/images.service";

const { botToken, ownerId, guildId, authorUserId } = config.discord;
const SITE_URL = "https://leetaesk.com";

// =======================================================
// 글쓰기 세션 상태 (메모리) — threadId → 세션
//   ※ DB 영속화는 추후. 디스코드 쓰레드 자체가 대화 기록을 보관함.
// =======================================================
interface WritingSession {
    claudeSessionId: string | null;
    categories: { id: number; name: string }[];
    draft: ParsedDraft | null;
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

// 카테고리 이름 → id (없으면 생성). 이름이 비면 첫 카테고리 또는 "기타".
const resolveCategoryId = async (
    name: string,
    session: WritingSession
): Promise<number> => {
    const trimmed = name.trim();
    if (trimmed) {
        const found = session.categories.find(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (found) return found.id;
        const created = await createCategory(trimmed);
        return created.categoryId;
    }
    if (session.categories[0]) return session.categories[0].id;
    const created = await createCategory("기타");
    return created.categoryId;
};

/**
 * 디스코드 글쓰기 봇을 시작합니다.
 * - DISCORD_BOT_TOKEN이 없으면 조용히 비활성화됩니다.
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

    client.once(Events.ClientReady, async (c) => {
        console.log(`🤖 디스코드 봇 로그인 성공: ${c.user.tag}`);
        try {
            await registerCommands(c.user.id);
        } catch (err) {
            console.error("⚠️ 슬래시 명령 등록 실패:", err);
        }
    });

    // ===================================================
    // 상호작용 라우팅 (명령 / 버튼 / 모달)
    // ===================================================
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        // 권한 가드: 운영자만
        if (
            ownerId &&
            "user" in interaction &&
            interaction.user.id !== ownerId
        ) {
            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: "⛔ 이 봇은 블로그 운영자만 사용할 수 있어요.",
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }

        try {
            if (interaction.isChatInputCommand()) {
                await handleCommand(interaction, client);
            } else if (interaction.isButton()) {
                await handleButton(interaction);
            } else if (interaction.isModalSubmit()) {
                await handleModalSubmit(interaction);
            }
        } catch (err) {
            console.error("⚠️ 상호작용 처리 오류:", err);
        }
    });

    // ===================================================
    // 쓰레드 내 대화 처리 (Claude 연결 + 초안 렌더)
    // ===================================================
    client.on(Events.MessageCreate, async (message: Message) => {
        if (message.author.bot) return;

        const session = sessions.get(message.channelId);
        if (!session) return;
        if (ownerId && message.author.id !== ownerId) return;

        const channel = message.channel;
        if (!channel.isThread()) return;

        // (1) 이미지 파일 첨부 → S3 업로드 후 썸네일로 설정
        const imageAttach = message.attachments.find(
            (a) =>
                a.contentType?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif)$/i.test(a.name ?? "")
        );
        if (imageAttach) {
            if (!session.draft) {
                await channel
                    .send(
                        "먼저 대화로 초안을 만든 뒤 썸네일을 추가해주세요."
                    )
                    .catch(() => {});
                return;
            }
            try {
                const resp = await fetch(imageAttach.url);
                const buf = Buffer.from(await resp.arrayBuffer());
                const url = await uploadBuffer(
                    buf,
                    imageAttach.name ?? "thumbnail.png",
                    imageAttach.contentType ?? "image/png"
                );
                session.draft.thumbnailUrl = url;
                await channel.send("🖼️ 썸네일을 설정했어요.");
                await channel.send(buildDraftMessage(session.draft));
            } catch (err) {
                console.error("⚠️ 썸네일 업로드 실패:", err);
                await channel
                    .send("⚠️ 이미지를 업로드하지 못했어요.")
                    .catch(() => {});
            }
            return;
        }

        // (2) .md 파일 직접 업로드 → 본문 교체
        const mdAttach = message.attachments.find((a) =>
            a.name?.toLowerCase().endsWith(".md")
        );
        if (mdAttach) {
            try {
                const res = await fetch(mdAttach.url);
                const body = (await res.text()).trim();
                if (!session.draft) {
                    session.draft = {
                        title: "제목 미정",
                        summary: "",
                        category: "",
                        tags: [],
                        bodyMarkdown: body,
                    };
                } else {
                    session.draft.bodyMarkdown = body;
                }
                await channel.send("📎 업로드한 .md로 본문을 교체했어요.");
                await channel.send(buildDraftMessage(session.draft));
            } catch (err) {
                console.error("⚠️ .md 처리 실패:", err);
                await channel.send("⚠️ .md 파일을 읽지 못했어요.").catch(() => {});
            }
            return;
        }

        const content = message.content.trim();
        if (!content) return;

        await channel.sendTyping().catch(() => {});

        try {
            const systemPrompt = buildSystemPrompt(
                session.categories.map((c) => c.name)
            );
            const { text, sessionId } = await askClaude(
                content,
                session.claudeSessionId,
                systemPrompt
            );
            session.claudeSessionId = sessionId;

            const { chat, draft } = parseDraft(text);
            await sendChunked(channel, chat);
            if (draft) {
                // 기존 썸네일은 초안 갱신 시에도 유지
                draft.thumbnailUrl = session.draft?.thumbnailUrl;
                session.draft = draft;
                await channel.send(buildDraftMessage(draft));
            }
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

// =======================================================
// 슬래시 명령 핸들러
// =======================================================
const handleCommand = async (
    interaction: ChatInputCommandInteraction,
    client: Client
): Promise<void> => {
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
        if (!channel || channel.type !== ChannelType.GuildText) {
            await interaction.reply({
                content: "일반 텍스트 채널에서 실행해주세요.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const categories = await getCategories();
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

            sessions.set(thread.id, {
                claudeSessionId: null,
                categories: categories.map((c) => ({ id: c.id, name: c.name })),
                draft: null,
            });

            await thread.send(
                "✍️ **글쓰기 세션을 시작합니다!**\n" +
                    "어떤 주제로 글을 쓰고 싶으세요? 편하게 말씀해주시면 같이 다듬어볼게요.\n" +
                    "_(초안이 만들어지면 미리보기와 버튼이 나타납니다.)_"
            );

            await interaction.editReply(
                `쓰레드를 만들었어요 → ${thread.toString()}`
            );
        } catch (err) {
            console.error("⚠️ /글쓰기 세션 시작 실패:", err);
            const e = err as any;
            const detail =
                [e?.name, e?.code, e?.message, e?.rawError?.message]
                    .filter(Boolean)
                    .join(" | ") ||
                (() => {
                    try {
                        return JSON.stringify(e)?.slice(0, 300);
                    } catch {
                        return "(직렬화 불가)";
                    }
                })() ||
                "(빈 에러)";
            await interaction.editReply(`⚠️ 세션 시작 실패: ${detail}`);
        }
    }
};

// =======================================================
// 버튼 핸들러 (발행 / 임시저장 / 직접수정 / 폐기)
// =======================================================
const handleButton = async (interaction: ButtonInteraction): Promise<void> => {
    const session = sessions.get(interaction.channelId);
    if (!session) {
        await interaction.reply({
            content: "이 쓰레드의 글쓰기 세션을 찾을 수 없어요. (봇 재시작 등)",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // 직접수정은 모달을 즉시 띄워야 하므로 defer 금지
    if (interaction.customId === "edit") {
        await openEditModal(interaction, session);
        return;
    }

    if (interaction.customId === "discard") {
        sessions.delete(interaction.channelId);
        await interaction.reply("🗑️ 초안을 폐기했어요. 이 쓰레드는 닫을게요.");
        const ch = interaction.channel;
        if (ch && ch.isThread()) {
            await ch.setArchived(true).catch(() => {});
        }
        return;
    }

    const draft = session.draft;
    if (!draft) {
        await interaction.reply({
            content: "아직 초안이 없어요. 먼저 대화로 초안을 만들어주세요.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // 썸네일 관련 (작성자 id 불필요)
    if (interaction.customId === "ai_thumb") {
        await openThumbModal(interaction);
        return;
    }
    if (interaction.customId === "remove_thumb") {
        draft.thumbnailUrl = undefined;
        await interaction.reply("🖼️ 썸네일을 제거했어요.");
        const ch = interaction.channel;
        if (ch && ch.isThread()) {
            await ch.send(buildDraftMessage(draft));
        }
        return;
    }

    if (!authorUserId || Number.isNaN(authorUserId)) {
        await interaction.reply({
            content:
                "⚠️ BLOG_AUTHOR_USER_ID(작성자 user id)가 설정되지 않아 저장할 수 없어요.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (interaction.customId === "publish") {
        await interaction.deferReply();
        try {
            const categoryId = await resolveCategoryId(draft.category, session);
            const html = markdownToHtml(draft.bodyMarkdown);
            const result = await postPost(authorUserId, {
                title: draft.title,
                content: html,
                summary: draft.summary || draft.title,
                categoryId,
                thumbnailUrl: draft.thumbnailUrl ?? "",
                tags: draft.tags,
            });
            const postId = result.result.postId;
            sessions.delete(interaction.channelId);
            await interaction.editReply(
                `✅ 발행 완료! ${SITE_URL}/posts/${postId}`
            );
        } catch (err) {
            console.error("⚠️ 발행 실패:", err);
            await interaction.editReply(
                "⚠️ 발행 중 오류가 났어요. 콘솔 로그를 확인해주세요."
            );
        }
        return;
    }

    if (interaction.customId === "save_draft") {
        await interaction.deferReply();
        try {
            const categoryId = await resolveCategoryId(draft.category, session);
            const html = markdownToHtml(draft.bodyMarkdown);
            const result = await createDraft(authorUserId, {
                title: draft.title,
                content: html,
                summary: draft.summary,
                categoryId,
                thumbnailUrl: draft.thumbnailUrl ?? "",
                tags: draft.tags,
            });
            await interaction.editReply(
                `📝 임시저장 완료 (draft #${result.id}). 블로그 에디터에서 이어서 편집·발행할 수 있어요.`
            );
        } catch (err) {
            console.error("⚠️ 임시저장 실패:", err);
            await interaction.editReply(
                "⚠️ 임시저장 중 오류가 났어요. 콘솔 로그를 확인해주세요."
            );
        }
        return;
    }
};

// =======================================================
// 직접수정 모달
// =======================================================
const openEditModal = async (
    interaction: ButtonInteraction,
    session: WritingSession
): Promise<void> => {
    const d = session.draft;
    if (!d) {
        await interaction.reply({
            content: "수정할 초안이 없어요.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId("edit_modal")
        .setTitle("초안 직접 수정");

    const titleInput = new TextInputBuilder()
        .setCustomId("title")
        .setLabel("제목")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(255)
        .setValue(d.title);

    const summaryInput = new TextInputBuilder()
        .setCustomId("summary")
        .setLabel("요약")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(255)
        .setRequired(false)
        .setValue(d.summary);

    const tagsInput = new TextInputBuilder()
        .setCustomId("tags")
        .setLabel("태그 (쉼표로 구분)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(d.tags.join(", "));

    const bodyInput = new TextInputBuilder()
        .setCustomId("body")
        .setLabel("본문 마크다운 (4000자 제한, 더 길면 .md 업로드)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(4000)
        .setValue(d.bodyMarkdown.slice(0, 4000));

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(summaryInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(tagsInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(bodyInput)
    );

    await interaction.showModal(modal);
};

// AI 썸네일 프롬프트 입력 모달
const openThumbModal = async (
    interaction: ButtonInteraction
): Promise<void> => {
    const modal = new ModalBuilder()
        .setCustomId("thumb_modal")
        .setTitle("AI 썸네일 생성 (그록)");

    const promptInput = new TextInputBuilder()
        .setCustomId("prompt")
        .setLabel("이미지 프롬프트 (영어 권장)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
            "e.g. minimal abstract tech cover, blue gradient, no text"
        )
        .setMaxLength(1000)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput)
    );
    await interaction.showModal(modal);
};

const handleModalSubmit = async (
    interaction: ModalSubmitInteraction
): Promise<void> => {
    const session = sessions.get(interaction.channelId ?? "");
    if (!session || !session.draft) {
        await interaction.reply({
            content: "세션 또는 초안을 찾을 수 없어요.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // AI 썸네일 생성 모달
    if (interaction.customId === "thumb_modal") {
        const prompt = interaction.fields.getTextInputValue("prompt");
        await interaction.deferReply();
        try {
            const { buffer, contentType } = await generateImage(prompt);
            const ext = contentType.includes("png") ? "png" : "jpg";
            const url = await uploadBuffer(buffer, `thumb.${ext}`, contentType);
            session.draft.thumbnailUrl = url;
            await interaction.editReply("🎨 AI 썸네일을 생성했어요 👇");
            const ch = interaction.channel;
            if (ch && ch.isThread()) {
                await ch.send(buildDraftMessage(session.draft));
            }
        } catch (err) {
            console.error("⚠️ AI 썸네일 생성 실패:", err);
            const msg = err instanceof Error ? err.message : String(err);
            await interaction.editReply(
                `⚠️ 썸네일 생성 실패: ${msg.slice(0, 300)}`
            );
        }
        return;
    }

    if (interaction.customId !== "edit_modal") return;

    session.draft.title = interaction.fields
        .getTextInputValue("title")
        .slice(0, 255);
    session.draft.summary = interaction.fields
        .getTextInputValue("summary")
        .slice(0, 255);
    session.draft.tags = interaction.fields
        .getTextInputValue("tags")
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);
    session.draft.bodyMarkdown = interaction.fields.getTextInputValue("body");

    await interaction.reply("✏️ 수정 내용을 반영했어요 👇");
    const ch = interaction.channel;
    if (ch && ch.isThread()) {
        await ch.send(buildDraftMessage(session.draft));
    }
};
