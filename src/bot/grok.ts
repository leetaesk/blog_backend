import config from "../config";

const XAI_IMAGE_ENDPOINT = "https://api.x.ai/v1/images/generations";
const MODEL = "grok-imagine-image-quality";

interface GeneratedImage {
    buffer: Buffer;
    contentType: string;
}

/**
 * 그록(xAI)으로 이미지를 생성하고, 그 결과 이미지를 버퍼로 받아 반환합니다.
 * - xAI가 돌려주는 URL은 임시(만료)라서, 즉시 다운로드해 버퍼로 반환합니다.
 *   (호출 측에서 S3 등 영구 저장소로 재업로드해야 함)
 */
export const generateImage = async (
    prompt: string
): Promise<GeneratedImage> => {
    const apiKey = config.xai.apiKey;
    if (!apiKey) {
        throw new Error("XAI_API_KEY가 설정되지 않았습니다.");
    }

    const resp = await fetch(XAI_IMAGE_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: MODEL,
            prompt,
            n: 1,
            aspect_ratio: "16:9", // 블로그 썸네일/OG 비율
            resolution: "1k",
            response_format: "url",
        }),
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(
            `그록 이미지 생성 실패 (${resp.status}): ${body.slice(0, 300)}`
        );
    }

    const json = (await resp.json()) as {
        data?: { url?: string }[];
    };
    const url = json.data?.[0]?.url;
    if (!url) {
        throw new Error("그록 응답에 이미지 URL이 없습니다.");
    }

    // 임시 URL을 즉시 다운로드
    const imgResp = await fetch(url);
    if (!imgResp.ok) {
        throw new Error(`생성된 이미지 다운로드 실패 (${imgResp.status})`);
    }
    const arrayBuf = await imgResp.arrayBuffer();
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";

    return { buffer: Buffer.from(arrayBuf), contentType };
};
