-- Users Table: 회원 정보 (실제 DB 및 개선사항 반영)
CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,

    -- (스크립트 의도 반영) 카카오 ID는 NOT NULL + UNIQUE 여야 함
    "kakao_id" VARCHAR(255) UNIQUE NOT NULL,

    "nickname" VARCHAR(50) NOT NULL,

    -- (로직 변경) 사용자 '커스텀' 프로필 (NULL 허용)
    "profile_image_url" VARCHAR(255),

    "role" VARCHAR(10) NOT NULL DEFAULT 'user' CHECK("role" IN ('admin', 'user')),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- (JSON 반영) auth.service.ts가 사용하는 카카오 토큰
    "kakao_access_token" VARCHAR(255),

    -- (JSON 반영) 실제 DB에 존재했던 'email' 컬럼
    "email" VARCHAR(255),

    -- (개선 사항) 카카오 '원본' 프로필 (덮어쓰기 문제 해결용)
    "kakao_profile_url" VARCHAR(255)
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
    "likes_count" INTEGER NOT NULL DEFAULT 0,
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
    "parent_comment_id" INTEGER, -- << (변경) 답글 기능을 위한 컬럼 (1차 댓글은 NULL)
    "likes_count" INTEGER NOT NULL DEFAULT 0, -- << (변경) 댓글 좋아요 수를 위한 컬럼
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("parent_comment_id") REFERENCES "comments" ("id") ON DELETE CASCADE -- << (변경) 답글 외래 키
);

-- Likes Table: 사용자와 '게시글'의 좋아요 관계
CREATE TABLE "likes" (
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("user_id", "post_id"),
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE
);

-- (추가) Comments_Likes Table: 사용자와 '댓글'의 좋아요 관계
CREATE TABLE "comments_likes" (
  "user_id" INTEGER NOT NULL,
  "comment_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "comment_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("comment_id") REFERENCES "comments" ("id") ON DELETE CASCADE
);
