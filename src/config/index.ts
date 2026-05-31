import dotenv from "dotenv";

// .env 파일의 환경 변수를 process.env에 로드합니다.
dotenv.config();

const config = {
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  discord: {
    // 데이터 변경(새 댓글/가입 등) 알림을 보낼 디스코드 Incoming Webhook URL
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    // 글쓰기 봇 (Gateway)
    botToken: process.env.DISCORD_BOT_TOKEN,
    ownerId: process.env.DISCORD_OWNER_ID, // 봇을 쓸 수 있는 유일한 디스코드 user id
    guildId: process.env.DISCORD_GUILD_ID, // 슬래시 명령을 즉시 등록할 서버 id
    // 봇이 발행/임시저장하는 글의 작성자(블로그 DB의 user id, 보통 admin 본인)
    authorUserId: Number(process.env.BLOG_AUTHOR_USER_ID),
  },
  xai: {
    // 그록 이미지 생성용 API 키 (썸네일 생성)
    apiKey: process.env.XAI_API_KEY,
  },
};

export default config;
