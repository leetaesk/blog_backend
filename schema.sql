-- Users Table: 회원 정보
CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "kakao_id" VARCHAR(255) UNIQUE NOT NULL,
    "nickname" VARCHAR(50) NOT NULL,
    "profile_image_url" VARCHAR(255), -- << 추가 완료!
    "role" VARCHAR(10) NOT NULL DEFAULT 'user' CHECK("role" IN ('admin', 'user')),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table: 카테고리 정보
CREATE TABLE "categories" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(50) UNIQUE NOT NULL
);

-- Posts Table: 게시글 정보
CREATE TABLE "posts" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "content" TEXT,
  "summary" VARCHAR(255),
  "thumbnail_url" VARCHAR(255),
  "views" INTEGER NOT NULL DEFAULT 0,
  "user_id" INTEGER NOT NULL,
  "category_id" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE SET NULL
);

-- Tags Table: 태그 정보
CREATE TABLE "tags" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(50) UNIQUE NOT NULL
);

-- Post_Tags Junction Table: 게시글과 태그의 다대다 관계
CREATE TABLE "post_tags" (
  "post_id" INTEGER NOT NULL,
  "tag_id" INTEGER NOT NULL,
  PRIMARY KEY ("post_id", "tag_id"),
  FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE
);

-- Comments Table: 댓글 정보
CREATE TABLE "comments" (
  "id" SERIAL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "post_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE
);