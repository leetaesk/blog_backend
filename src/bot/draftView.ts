import {
    EmbedBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    BaseMessageOptions,
} from "discord.js";
import { ParsedDraft } from "./claude";

/** 초안을 임베드(미리보기) + draft.md 첨부 + 액션 버튼으로 구성한다. */
export const buildDraftMessage = (draft: ParsedDraft): BaseMessageOptions => {
    const body = draft.bodyMarkdown || "(본문 없음)";
    const bodyPreview =
        body.length > 600
            ? body.slice(0, 600) + "\n\n… (전체 본문은 첨부된 draft.md 참고)"
            : body;

    const embed = new EmbedBuilder()
        .setTitle(draft.title || "제목 없음")
        .setColor(0x5865f2)
        .setDescription(
            (draft.summary ? `*${draft.summary}*\n\n` : "") + bodyPreview
        )
        .addFields(
            {
                name: "카테고리",
                value: draft.category || "(미정)",
                inline: true,
            },
            {
                name: "태그",
                value: draft.tags.length
                    ? draft.tags.map((t) => `#${t}`).join(" ")
                    : "(없음)",
                inline: true,
            },
            {
                name: "썸네일",
                value: draft.thumbnailUrl ? "있음 ✅" : "없음",
                inline: true,
            }
        )
        .setFooter({ text: "초안 미리보기 · 아래 버튼으로 진행하세요" });

    if (draft.thumbnailUrl) {
        embed.setImage(draft.thumbnailUrl);
    }

    const file = new AttachmentBuilder(
        Buffer.from(draft.bodyMarkdown || "", "utf8"),
        { name: "draft.md" }
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("publish")
            .setLabel("발행")
            .setEmoji("🚀")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("save_draft")
            .setLabel("임시저장")
            .setEmoji("📝")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("edit")
            .setLabel("직접수정")
            .setEmoji("✏️")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("discard")
            .setLabel("폐기")
            .setEmoji("🗑️")
            .setStyle(ButtonStyle.Danger)
    );

    const thumbRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("ai_thumb")
            .setLabel("AI 썸네일")
            .setEmoji("🎨")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("remove_thumb")
            .setLabel("썸네일 제거")
            .setEmoji("🖼️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!draft.thumbnailUrl)
    );

    return {
        embeds: [embed],
        files: [file],
        components: [actionRow, thumbRow],
    };
};
