const schemaRef = (name: string) => ({
    $ref: `#/components/schemas/${name}`,
});

const jsonResponse = (description: string, resultSchema: object) => ({
    description,
    content: {
        "application/json": {
            schema: {
                allOf: [
                    schemaRef("CommonResponse"),
                    {
                        type: "object",
                        properties: {
                            result: resultSchema,
                        },
                    },
                ],
            },
        },
    },
});

const responseRef = (name: string) => ({
    $ref: `#/components/responses/${name}`,
});

const badRequest = responseRef("BadRequest");
const unauthorized = responseRef("Unauthorized");
const forbidden = responseRef("Forbidden");
const notFound = responseRef("NotFound");
const serverError = responseRef("ServerError");

const bearerSecurity = [{ bearerAuth: [] }];
const optionalBearerSecurity = [{}, { bearerAuth: [] }];

const idParameter = (name: string, description: string) => ({
    name,
    in: "path",
    required: true,
    description,
    schema: {
        type: "integer",
        minimum: 1,
    },
});

const archiveQueryParameters = [
    {
        name: "page",
        in: "query",
        description: "페이지 번호",
        schema: { type: "integer", minimum: 1, default: 1 },
    },
    {
        name: "limit",
        in: "query",
        description: "페이지당 게시글 수",
        schema: { type: "integer", minimum: 1, default: 12 },
    },
    {
        name: "category",
        in: "query",
        description: "카테고리 이름 필터",
        schema: { type: "string" },
    },
    {
        name: "search",
        in: "query",
        description: "제목과 요약 검색어",
        schema: { type: "string" },
    },
];

export const swaggerDocument = {
    openapi: "3.0.3",
    info: {
        title: "Leetaesk Blog API",
        version: "1.0.0",
        description:
            "Leetaesk 블로그 백엔드 API 문서입니다. 자물쇠 표시가 있는 API는 우측 상단 Authorize에서 Bearer JWT를 입력한 뒤 호출할 수 있습니다.",
    },
    servers: [
        {
            url: "https://api.leetaesk.com",
            description: "운영 서버",
        },
        {
            url: "http://localhost:3000",
            description: "로컬 개발 서버",
        },
    ],
    tags: [
        { name: "System", description: "서버 상태" },
        { name: "Auth", description: "카카오 로그인과 토큰 관리" },
        { name: "Posts", description: "게시글과 임시글" },
        { name: "Categories", description: "게시글 카테고리" },
        { name: "Comments", description: "댓글과 답글" },
        { name: "Likes", description: "게시글과 댓글 좋아요" },
        { name: "Images", description: "본문 이미지 업로드" },
        { name: "Users", description: "사용자 프로필" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "카카오 로그인 응답으로 받은 accessToken",
            },
            refreshTokenCookie: {
                type: "apiKey",
                in: "cookie",
                name: "refreshToken",
                description: "로그인 시 설정되는 HttpOnly refresh token 쿠키",
            },
        },
        responses: {
            BadRequest: {
                description: "요청 형식 또는 입력값이 올바르지 않음",
                content: {
                    "application/json": { schema: schemaRef("ErrorResponse") },
                },
            },
            Unauthorized: {
                description: "인증 토큰이 없거나 유효하지 않음",
                content: {
                    "application/json": { schema: schemaRef("ErrorResponse") },
                },
            },
            Forbidden: {
                description: "리소스에 접근할 권한이 없음",
                content: {
                    "application/json": { schema: schemaRef("ErrorResponse") },
                },
            },
            NotFound: {
                description: "요청한 리소스를 찾을 수 없음",
                content: {
                    "application/json": { schema: schemaRef("ErrorResponse") },
                },
            },
            ServerError: {
                description: "서버 내부 오류",
                content: {
                    "application/json": { schema: schemaRef("ErrorResponse") },
                },
            },
        },
        schemas: {
            CommonResponse: {
                type: "object",
                required: ["isSuccess", "code", "message", "result"],
                properties: {
                    isSuccess: { type: "boolean", example: true },
                    code: { type: "string", example: "SUCCESS" },
                    message: { type: "string" },
                    result: {},
                },
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    isSuccess: { type: "boolean", example: false },
                    code: { type: "string", example: "BAD_REQUEST" },
                    message: { type: "string" },
                    errors: {
                        type: "object",
                        additionalProperties: {
                            type: "array",
                            items: { type: "string" },
                        },
                    },
                },
            },
            Health: {
                type: "object",
                required: ["message", "deployedAt", "env"],
                properties: {
                    message: { type: "string" },
                    deployedAt: { type: "string" },
                    env: { type: "string" },
                },
            },
            Category: {
                type: "object",
                required: ["id", "name"],
                properties: {
                    id: { type: "integer" },
                    name: { type: "string" },
                },
            },
            CategoryWithPostCount: {
                allOf: [
                    schemaRef("Category"),
                    {
                        type: "object",
                        required: ["postCount"],
                        properties: { postCount: { type: "integer" } },
                    },
                ],
            },
            Author: {
                type: "object",
                required: ["id", "nickname", "profileImageUrl"],
                properties: {
                    id: { type: "integer" },
                    nickname: { type: "string" },
                    profileImageUrl: { type: "string", nullable: true },
                },
            },
            Tag: {
                type: "object",
                required: ["id", "name"],
                properties: {
                    id: { type: "integer" },
                    name: { type: "string" },
                },
            },
            ArchivePost: {
                type: "object",
                required: [
                    "id",
                    "title",
                    "summary",
                    "createdAt",
                    "category",
                    "thumbnailUrl",
                    "commentCount",
                    "likesCount",
                ],
                properties: {
                    id: { type: "integer" },
                    title: { type: "string" },
                    summary: { type: "string" },
                    createdAt: { type: "string" },
                    category: schemaRef("Category"),
                    thumbnailUrl: {
                        type: "string",
                        format: "uri",
                        nullable: true,
                    },
                    commentCount: { type: "integer" },
                    likesCount: { type: "integer" },
                },
            },
            Pagination: {
                type: "object",
                required: [
                    "totalPostCount",
                    "totalPage",
                    "currentPage",
                    "isFirstPage",
                    "isLastPage",
                ],
                properties: {
                    totalPostCount: { type: "integer" },
                    totalPage: { type: "integer" },
                    currentPage: { type: "integer" },
                    isFirstPage: { type: "boolean" },
                    isLastPage: { type: "boolean" },
                },
            },
            ArchiveResult: {
                type: "object",
                required: ["posts", "pagination"],
                properties: {
                    posts: {
                        type: "array",
                        items: schemaRef("ArchivePost"),
                    },
                    pagination: schemaRef("Pagination"),
                },
            },
            PostDetail: {
                type: "object",
                required: [
                    "id",
                    "title",
                    "content",
                    "thumbnailUrl",
                    "views",
                    "createdAt",
                    "updatedAt",
                    "author",
                    "category",
                    "tags",
                    "commentCount",
                    "likesCount",
                    "isLikedByUser",
                ],
                properties: {
                    id: { type: "integer" },
                    title: { type: "string" },
                    content: { type: "string", description: "정제된 HTML 본문" },
                    thumbnailUrl: {
                        type: "string",
                        format: "uri",
                        nullable: true,
                    },
                    views: { type: "integer" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                    author: schemaRef("Author"),
                    category: {
                        allOf: [schemaRef("Category")],
                        nullable: true,
                    },
                    tags: { type: "array", items: schemaRef("Tag") },
                    commentCount: { type: "integer" },
                    likesCount: { type: "integer" },
                    isLikedByUser: { type: "boolean" },
                },
            },
            PostWriteRequest: {
                type: "object",
                required: [
                    "title",
                    "content",
                    "categoryId",
                    "summary",
                    "thumbnailUrl",
                ],
                properties: {
                    title: { type: "string", minLength: 1 },
                    content: {
                        type: "string",
                        minLength: 1,
                        description: "HTML 본문",
                    },
                    categoryId: { type: "integer" },
                    summary: { type: "string", minLength: 1 },
                    thumbnailUrl: { type: "string", format: "uri" },
                    tags: { type: "array", items: { type: "string" } },
                },
            },
            PostUpdateRequest: {
                type: "object",
                properties: {
                    title: { type: "string", minLength: 1 },
                    content: { type: "string", minLength: 1 },
                    categoryId: { type: "integer" },
                    summary: { type: "string", minLength: 1 },
                    thumbnailUrl: { type: "string", format: "uri" },
                    tags: { type: "array", items: { type: "string" } },
                },
            },
            PostMutationResult: {
                type: "object",
                required: ["postId"],
                properties: { postId: { type: "integer" } },
            },
            PostEditData: {
                type: "object",
                required: [
                    "title",
                    "content",
                    "summary",
                    "thumbnailUrl",
                    "categoryId",
                    "tags",
                ],
                properties: {
                    title: { type: "string" },
                    content: { type: "string", description: "저장된 HTML 원본" },
                    summary: { type: "string", nullable: true },
                    thumbnailUrl: {
                        type: "string",
                        format: "uri",
                        nullable: true,
                    },
                    categoryId: { type: "integer", nullable: true },
                    tags: { type: "array", items: { type: "string" } },
                },
            },
            DraftPayload: {
                type: "object",
                properties: {
                    title: { type: "string", default: "" },
                    content: {
                        type: "string",
                        default: "",
                        description: "작성 중인 HTML 본문",
                    },
                    categoryId: { type: "integer", nullable: true, default: null },
                    summary: { type: "string", default: "" },
                    thumbnailUrl: { type: "string", default: "" },
                    tags: {
                        type: "array",
                        items: { type: "string" },
                        default: [],
                    },
                },
            },
            DraftDetail: {
                allOf: [
                    schemaRef("DraftPayload"),
                    {
                        type: "object",
                        required: ["id", "updatedAt"],
                        properties: {
                            id: { type: "integer" },
                            updatedAt: { type: "string" },
                        },
                    },
                ],
            },
            DraftCreateResult: {
                type: "object",
                required: ["id", "updatedAt"],
                properties: {
                    id: { type: "integer" },
                    updatedAt: { type: "string" },
                },
            },
            DraftUpdateResult: {
                type: "object",
                required: ["updatedAt"],
                properties: { updatedAt: { type: "string" } },
            },
            KakaoLoginRequest: {
                type: "object",
                required: ["code", "redirectURI"],
                properties: {
                    code: { type: "string", description: "카카오 인가 코드" },
                    redirectURI: { type: "string", format: "uri" },
                },
            },
            KakaoLoginResult: {
                type: "object",
                required: [
                    "accessToken",
                    "userId",
                    "userRole",
                    "userNickname",
                    "userProfileImageUrl",
                    "userKakaoProfileImageUrl",
                ],
                properties: {
                    accessToken: { type: "string" },
                    userId: { type: "integer" },
                    userRole: { type: "string", enum: ["user", "admin"] },
                    userNickname: { type: "string" },
                    userProfileImageUrl: { type: "string", nullable: true },
                    userKakaoProfileImageUrl: { type: "string", nullable: true },
                },
            },
            AccessTokenResult: {
                type: "object",
                required: ["accessToken"],
                properties: { accessToken: { type: "string" } },
            },
            LogoutResult: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string" } },
            },
            Comment: {
                type: "object",
                required: [
                    "id",
                    "content",
                    "userId",
                    "createdAt",
                    "updatedAt",
                    "likesCount",
                    "author",
                    "isOwner",
                    "isLiked",
                    "replies",
                    "repliesCount",
                ],
                properties: {
                    id: { type: "integer" },
                    content: { type: "string" },
                    userId: { type: "integer" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                    likesCount: { type: "integer" },
                    author: schemaRef("Author"),
                    isOwner: { type: "boolean" },
                    isLiked: { type: "boolean" },
                    replies: {
                        type: "array",
                        items: schemaRef("Comment"),
                    },
                    repliesCount: { type: "integer" },
                },
            },
            CommentsResult: {
                type: "object",
                required: ["comments", "commentCount"],
                properties: {
                    comments: { type: "array", items: schemaRef("Comment") },
                    commentCount: { type: "integer" },
                },
            },
            MyComment: {
                type: "object",
                required: [
                    "id",
                    "content",
                    "createdAt",
                    "updatedAt",
                    "likesCount",
                    "isLiked",
                    "parentCommentId",
                    "post",
                ],
                properties: {
                    id: { type: "integer" },
                    content: { type: "string" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                    likesCount: { type: "integer" },
                    isLiked: { type: "boolean" },
                    parentCommentId: { type: "integer", nullable: true },
                    post: {
                        type: "object",
                        required: ["id", "title", "thumbnailUrl"],
                        properties: {
                            id: { type: "integer" },
                            title: { type: "string" },
                            thumbnailUrl: {
                                type: "string",
                                format: "uri",
                                nullable: true,
                            },
                        },
                    },
                },
            },
            MyCommentsResult: {
                type: "object",
                required: ["comments", "commentCount"],
                properties: {
                    comments: { type: "array", items: schemaRef("MyComment") },
                    commentCount: { type: "integer" },
                },
            },
            CreateCommentRequest: {
                type: "object",
                required: ["postId", "content"],
                properties: {
                    postId: { type: "integer", minimum: 1 },
                    content: { type: "string", minLength: 1 },
                    parentCommentId: {
                        type: "integer",
                        minimum: 1,
                        description: "답글일 때 상위 댓글 ID",
                    },
                },
            },
            CommentMutationResult: {
                type: "object",
                required: [
                    "id",
                    "content",
                    "userId",
                    "createdAt",
                    "parentCommentId",
                ],
                properties: {
                    id: { type: "integer" },
                    content: { type: "string" },
                    userId: { type: "integer" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                    parentCommentId: { type: "integer", nullable: true },
                },
            },
            PostLikeResult: {
                type: "object",
                required: ["postId", "liked", "newLikesCount"],
                properties: {
                    postId: { type: "integer" },
                    liked: { type: "boolean" },
                    newLikesCount: { type: "integer" },
                },
            },
            CommentLikeResult: {
                type: "object",
                required: ["commentId", "liked", "newLikesCount"],
                properties: {
                    commentId: { type: "integer" },
                    liked: { type: "boolean" },
                    newLikesCount: { type: "integer" },
                },
            },
            ImageUploadResponse: {
                type: "object",
                required: ["message", "data"],
                properties: {
                    message: { type: "string" },
                    data: {
                        type: "object",
                        required: ["imageUrl"],
                        properties: {
                            imageUrl: { type: "string", format: "uri" },
                        },
                    },
                },
            },
            UserProfile: {
                type: "object",
                required: ["id", "nickname", "profileImageUrl", "role"],
                properties: {
                    id: { type: "integer" },
                    nickname: { type: "string" },
                    profileImageUrl: {
                        type: "string",
                        format: "uri",
                        nullable: true,
                    },
                    role: { type: "string" },
                },
            },
        },
    },
    paths: {
        "/": {
            get: {
                tags: ["System"],
                summary: "서버 상태 조회",
                operationId: "getServerStatus",
                responses: {
                    200: {
                        description: "서버가 정상 동작 중임",
                        content: {
                            "application/json": { schema: schemaRef("Health") },
                        },
                    },
                },
            },
        },
        "/api/auth/kakao/login": {
            post: {
                tags: ["Auth"],
                summary: "카카오 로그인",
                operationId: "loginWithKakao",
                description:
                    "카카오 인가 코드를 교환해 access token을 반환하고 HttpOnly refreshToken 쿠키를 설정합니다.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: schemaRef("KakaoLoginRequest"),
                        },
                    },
                },
                responses: {
                    200: jsonResponse("로그인 성공", schemaRef("KakaoLoginResult")),
                    400: badRequest,
                    500: serverError,
                },
            },
        },
        "/api/auth/kakao/logout": {
            post: {
                tags: ["Auth"],
                summary: "카카오 로그아웃",
                operationId: "logoutFromKakao",
                security: bearerSecurity,
                responses: {
                    200: jsonResponse("로그아웃 성공", schemaRef("LogoutResult")),
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/auth/reissue": {
            post: {
                tags: ["Auth"],
                summary: "Access token 재발급",
                operationId: "reissueAccessToken",
                security: [{ refreshTokenCookie: [] }],
                responses: {
                    200: jsonResponse(
                        "Access token 재발급 성공",
                        schemaRef("AccessTokenResult"),
                    ),
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/posts": {
            get: {
                tags: ["Posts"],
                summary: "게시글 목록 조회",
                operationId: "getPosts",
                parameters: archiveQueryParameters,
                responses: {
                    200: jsonResponse("게시글 목록 조회 성공", schemaRef("ArchiveResult")),
                    400: badRequest,
                    500: serverError,
                },
            },
            post: {
                tags: ["Posts"],
                summary: "게시글 작성",
                operationId: "createPost",
                security: bearerSecurity,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: schemaRef("PostWriteRequest"),
                        },
                    },
                },
                responses: {
                    201: jsonResponse("게시글 작성 성공", schemaRef("PostMutationResult")),
                    400: badRequest,
                    401: unauthorized,
                    500: serverError,
                },
            },
        },
        "/api/posts/liked-by/me": {
            get: {
                tags: ["Posts"],
                summary: "내가 좋아요한 게시글 조회",
                operationId: "getPostsLikedByMe",
                security: bearerSecurity,
                parameters: archiveQueryParameters,
                responses: {
                    200: jsonResponse(
                        "좋아요한 게시글 목록 조회 성공",
                        schemaRef("ArchiveResult"),
                    ),
                    400: badRequest,
                    401: unauthorized,
                    500: serverError,
                },
            },
        },
        "/api/posts/drafts": {
            get: {
                tags: ["Posts"],
                summary: "내 임시글 목록 조회",
                operationId: "getDrafts",
                security: bearerSecurity,
                responses: {
                    200: jsonResponse("임시글 목록 조회 성공", {
                        type: "array",
                        items: schemaRef("DraftDetail"),
                    }),
                    401: unauthorized,
                    500: serverError,
                },
            },
            post: {
                tags: ["Posts"],
                summary: "임시글 생성",
                operationId: "createDraft",
                security: bearerSecurity,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": { schema: schemaRef("DraftPayload") },
                    },
                },
                responses: {
                    201: jsonResponse("임시글 생성 성공", schemaRef("DraftCreateResult")),
                    400: badRequest,
                    401: unauthorized,
                    500: serverError,
                },
            },
        },
        "/api/posts/drafts/{draftId}": {
            put: {
                tags: ["Posts"],
                summary: "임시글 수정",
                operationId: "updateDraft",
                security: bearerSecurity,
                parameters: [idParameter("draftId", "임시글 ID")],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": { schema: schemaRef("DraftPayload") },
                    },
                },
                responses: {
                    200: jsonResponse("임시글 수정 성공", schemaRef("DraftUpdateResult")),
                    400: badRequest,
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
            delete: {
                tags: ["Posts"],
                summary: "임시글 삭제",
                operationId: "deleteDraft",
                security: bearerSecurity,
                parameters: [idParameter("draftId", "임시글 ID")],
                responses: {
                    200: jsonResponse("임시글 삭제 성공", {
                        type: "object",
                        required: ["draftId"],
                        properties: { draftId: { type: "integer" } },
                    }),
                    400: badRequest,
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/posts/{postId}": {
            get: {
                tags: ["Posts"],
                summary: "게시글 상세 조회",
                operationId: "getPost",
                description:
                    "비로그인 호출도 가능하며 Bearer JWT가 있으면 사용자별 좋아요 여부를 함께 반환합니다.",
                security: optionalBearerSecurity,
                parameters: [idParameter("postId", "게시글 ID")],
                responses: {
                    200: jsonResponse("게시글 상세 조회 성공", schemaRef("PostDetail")),
                    400: badRequest,
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
            patch: {
                tags: ["Posts"],
                summary: "게시글 수정",
                operationId: "updatePost",
                description: "게시글 소유자 또는 관리자만 수정할 수 있습니다.",
                security: bearerSecurity,
                parameters: [idParameter("postId", "게시글 ID")],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: schemaRef("PostUpdateRequest"),
                        },
                    },
                },
                responses: {
                    200: jsonResponse("게시글 수정 성공", schemaRef("PostMutationResult")),
                    400: badRequest,
                    401: unauthorized,
                    403: forbidden,
                    404: notFound,
                    500: serverError,
                },
            },
            delete: {
                tags: ["Posts"],
                summary: "게시글 삭제",
                operationId: "deletePost",
                description: "게시글 소유자 또는 관리자만 삭제할 수 있습니다.",
                security: bearerSecurity,
                parameters: [idParameter("postId", "게시글 ID")],
                responses: {
                    200: jsonResponse("게시글 삭제 성공", schemaRef("PostMutationResult")),
                    400: badRequest,
                    401: unauthorized,
                    403: forbidden,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/posts/edit-data/{postId}": {
            get: {
                tags: ["Posts"],
                summary: "게시글 수정용 원본 조회",
                operationId: "getPostEditData",
                description: "게시글 소유자 또는 관리자에게 HTML 원본을 반환합니다.",
                security: bearerSecurity,
                parameters: [idParameter("postId", "게시글 ID")],
                responses: {
                    200: jsonResponse(
                        "게시글 수정용 데이터 조회 성공",
                        schemaRef("PostEditData"),
                    ),
                    400: badRequest,
                    401: unauthorized,
                    403: forbidden,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/categories": {
            get: {
                tags: ["Categories"],
                summary: "카테고리 목록 조회",
                operationId: "getCategories",
                responses: {
                    200: jsonResponse("카테고리 목록 조회 성공", {
                        type: "object",
                        required: ["categories"],
                        properties: {
                            categories: {
                                type: "array",
                                items: schemaRef("CategoryWithPostCount"),
                            },
                        },
                    }),
                    500: serverError,
                },
            },
            post: {
                tags: ["Categories"],
                summary: "카테고리 생성",
                operationId: "createCategory",
                description: "관리자만 생성할 수 있습니다. 기존 이름이면 해당 ID를 반환합니다.",
                security: bearerSecurity,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["category"],
                                properties: {
                                    category: { type: "string", minLength: 1 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: jsonResponse("기존 카테고리 반환", {
                        type: "object",
                        required: ["categoryId"],
                        properties: { categoryId: { type: "integer" } },
                    }),
                    201: jsonResponse("새 카테고리 생성", {
                        type: "object",
                        required: ["categoryId"],
                        properties: { categoryId: { type: "integer" } },
                    }),
                    400: badRequest,
                    401: unauthorized,
                    403: forbidden,
                    500: serverError,
                },
            },
        },
        "/api/comments/me": {
            get: {
                tags: ["Comments"],
                summary: "내가 작성한 댓글 조회",
                operationId: "getMyComments",
                security: bearerSecurity,
                responses: {
                    200: jsonResponse("내 댓글 목록 조회 성공", schemaRef("MyCommentsResult")),
                    401: unauthorized,
                    500: serverError,
                },
            },
        },
        "/api/comments/{id}": {
            get: {
                tags: ["Comments"],
                summary: "게시글 댓글 조회",
                operationId: "getComments",
                description:
                    "비로그인 호출도 가능하며 Bearer JWT가 있으면 소유권과 좋아요 여부를 함께 반환합니다.",
                security: optionalBearerSecurity,
                parameters: [idParameter("id", "게시글 ID")],
                responses: {
                    200: jsonResponse("댓글 목록 조회 성공", schemaRef("CommentsResult")),
                    400: badRequest,
                    401: unauthorized,
                    500: serverError,
                },
            },
            patch: {
                tags: ["Comments"],
                summary: "댓글 수정",
                operationId: "updateComment",
                description: "댓글 소유자 또는 관리자만 수정할 수 있습니다.",
                security: bearerSecurity,
                parameters: [idParameter("id", "댓글 ID")],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["content"],
                                properties: {
                                    content: { type: "string", minLength: 1 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: jsonResponse("댓글 수정 성공", schemaRef("CommentMutationResult")),
                    400: badRequest,
                    401: unauthorized,
                    403: forbidden,
                    404: notFound,
                    500: serverError,
                },
            },
            delete: {
                tags: ["Comments"],
                summary: "댓글 삭제",
                operationId: "deleteComment",
                description: "댓글 소유자 또는 관리자만 삭제할 수 있습니다.",
                security: bearerSecurity,
                parameters: [idParameter("id", "댓글 ID")],
                responses: {
                    200: jsonResponse("댓글 삭제 성공", {
                        type: "object",
                        required: ["id"],
                        properties: { id: { type: "integer" } },
                    }),
                    400: badRequest,
                    401: unauthorized,
                    403: forbidden,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/comments": {
            post: {
                tags: ["Comments"],
                summary: "댓글 또는 답글 작성",
                operationId: "createComment",
                security: bearerSecurity,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: schemaRef("CreateCommentRequest"),
                        },
                    },
                },
                responses: {
                    201: jsonResponse(
                        "댓글 작성 성공",
                        schemaRef("CommentMutationResult"),
                    ),
                    400: badRequest,
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/likes/post/{postId}": {
            post: {
                tags: ["Likes"],
                summary: "게시글 좋아요 토글",
                operationId: "togglePostLike",
                security: bearerSecurity,
                parameters: [idParameter("postId", "게시글 ID")],
                responses: {
                    200: jsonResponse("게시글 좋아요 상태 변경 성공", schemaRef("PostLikeResult")),
                    400: badRequest,
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/likes/comment/{commentId}": {
            post: {
                tags: ["Likes"],
                summary: "댓글 좋아요 토글",
                operationId: "toggleCommentLike",
                security: bearerSecurity,
                parameters: [idParameter("commentId", "댓글 ID")],
                responses: {
                    200: jsonResponse("댓글 좋아요 상태 변경 성공", schemaRef("CommentLikeResult")),
                    400: badRequest,
                    401: unauthorized,
                    404: notFound,
                    500: serverError,
                },
            },
        },
        "/api/images": {
            post: {
                tags: ["Images"],
                summary: "본문 이미지 업로드",
                operationId: "uploadImage",
                description: "최대 10MB의 이미지 파일을 업로드합니다.",
                security: bearerSecurity,
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["image"],
                                properties: {
                                    image: { type: "string", format: "binary" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: "이미지 업로드 성공",
                        content: {
                            "application/json": {
                                schema: schemaRef("ImageUploadResponse"),
                            },
                        },
                    },
                    400: badRequest,
                    401: unauthorized,
                    500: serverError,
                },
            },
        },
        "/api/users/me": {
            patch: {
                tags: ["Users"],
                summary: "내 프로필 수정",
                operationId: "updateMyProfile",
                description:
                    "닉네임, 새 프로필 이미지, 이미지 삭제 또는 카카오 프로필 사용 중 필요한 값을 전송합니다.",
                security: bearerSecurity,
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: {
                                    nickname: {
                                        type: "string",
                                        minLength: 2,
                                        maxLength: 20,
                                    },
                                    profileAction: {
                                        type: "string",
                                        enum: ["delete", "use_kakao"],
                                    },
                                    image: {
                                        type: "string",
                                        format: "binary",
                                        description: "최대 10MB 이미지",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: jsonResponse("프로필 수정 성공", schemaRef("UserProfile")),
                    400: badRequest,
                    401: unauthorized,
                    500: serverError,
                },
            },
        },
    },
};
