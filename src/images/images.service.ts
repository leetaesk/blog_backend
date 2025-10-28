import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

/**
 * 이미지를 AWS S3에 업로드하고, 해당 이미지의 URL을 반환합니다.
 */
export const uploadImage = async (
    file: Express.Multer.File
): Promise<string> => {
    const key = `images/${uuidv4()}-${file.originalname}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
    });

    try {
        await s3Client.send(command);
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
    } catch (error) {
        console.error("S3 이미지 업로드 중 에러 발생:", error);
        throw new Error("S3에 이미지를 업로드하는 데 실패했습니다.");
    }
};
