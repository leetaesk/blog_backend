import config from "../config";

const XAI_IMAGE_ENDPOINT = "https://api.x.ai/v1/images/generations";
const XAI_IMAGE_EDIT_ENDPOINT = "https://api.x.ai/v1/images/edits";
const MODEL = "grok-imagine-image-quality";

// 그록 이미지 편집(합성)에 넣을 수 있는 참고 이미지 최대 장수
export const MAX_REF_IMAGES = 3;

interface GeneratedImage {
    buffer: Buffer;
    contentType: string;
}

const requireApiKey = (): string => {
    const apiKey = config.xai.apiKey;
    if (!apiKey) {
        throw new Error("XAI_API_KEY가 설정되지 않았습니다.");
    }
    return apiKey;
};

/**
 * xAI 이미지 응답(JSON)에서 임시 URL을 꺼내 즉시 다운로드해 버퍼로 반환합니다.
 * - xAI가 돌려주는 URL은 만료되므로 바로 받아 둬야 합니다.
 *   (호출 측에서 S3 등 영구 저장소로 재업로드해야 함)
 */
const downloadResult = async (resp: Response): Promise<GeneratedImage> => {
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

    const imgResp = await fetch(url);
    if (!imgResp.ok) {
        throw new Error(`생성된 이미지 다운로드 실패 (${imgResp.status})`);
    }
    const arrayBuf = await imgResp.arrayBuffer();
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";

    return { buffer: Buffer.from(arrayBuf), contentType };
};

/**
 * 그록(xAI)으로 텍스트 프롬프트만으로 이미지를 생성합니다.
 */
export const generateImage = async (
    prompt: string
): Promise<GeneratedImage> => {
    const apiKey = requireApiKey();

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

    return downloadResult(resp);
};

/**
 * 참고 이미지(최대 3장)를 입력으로 받아 프롬프트대로 편집·합성한 이미지를 생성합니다.
 * - 디스코드 CDN URL은 만료·차단 가능성이 있어, 받아온 이미지를 base64로 인라인 전송합니다.
 * - 프롬프트에서 여러 장을 구분해 가리킬 땐 <IMAGE_0>, <IMAGE_1> … 로 참조할 수 있습니다.
 * - 참고 이미지가 하나도 없으면 일반 텍스트 생성으로 폴백합니다.
 */
export const editImage = async (
    prompt: string,
    refImageUrls: string[]
): Promise<GeneratedImage> => {
    const apiKey = requireApiKey();

    const urls = refImageUrls.slice(0, MAX_REF_IMAGES);
    if (urls.length === 0) {
        return generateImage(prompt);
    }

    // 참고 이미지를 받아 base64 data URL로 변환 (디스코드 CDN 직접 의존 X)
    const images = await Promise.all(
        urls.map(async (u) => {
            const r = await fetch(u);
            if (!r.ok) {
                throw new Error(`참고 이미지 다운로드 실패 (${r.status})`);
            }
            const buf = Buffer.from(await r.arrayBuffer());
            const ct = r.headers.get("content-type") ?? "image/png";
            return { url: `data:${ct};base64,${buf.toString("base64")}` };
        })
    );

    const resp = await fetch(XAI_IMAGE_EDIT_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: MODEL,
            prompt,
            images,
            n: 1,
            aspect_ratio: "16:9",
            resolution: "1k",
            response_format: "url",
        }),
    });

    return downloadResult(resp);
};
