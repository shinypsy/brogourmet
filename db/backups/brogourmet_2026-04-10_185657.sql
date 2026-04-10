--
-- PostgreSQL database dump
--

\restrict eA12wd9lZxCtD651DVrbMXHVatHK0fzWQMtIqkZq9f7fAKdNUtcRlGGLrplfe2t

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.districts (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    active boolean NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: districts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.districts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: districts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.districts_id_seq OWNED BY public.districts.id;


--
-- Name: free_share_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.free_share_posts (
    id integer NOT NULL,
    author_id integer NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    district character varying(50),
    image_url character varying(500),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: free_share_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.free_share_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: free_share_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.free_share_posts_id_seq OWNED BY public.free_share_posts.id;


--
-- Name: known_restaurant_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.known_restaurant_posts (
    id integer NOT NULL,
    author_id integer NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    restaurant_name character varying(200) NOT NULL,
    district character varying(50) NOT NULL,
    main_menu_name character varying(200) NOT NULL,
    main_menu_price integer NOT NULL,
    image_url character varying(500),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    city character varying(100) DEFAULT '서울특별시'::character varying,
    district_id integer,
    category character varying(80),
    summary text,
    latitude double precision,
    longitude double precision,
    image_urls json,
    menu_lines text
);


--
-- Name: known_restaurant_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.known_restaurant_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: known_restaurant_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.known_restaurant_posts_id_seq OWNED BY public.known_restaurant_posts.id;


--
-- Name: payment_intents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_intents (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount_krw integer NOT NULL,
    description character varying(500),
    status character varying(32) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: payment_intents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_intents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_intents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_intents_id_seq OWNED BY public.payment_intents.id;


--
-- Name: restaurant_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_comments (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    user_id integer NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: restaurant_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_comments_id_seq OWNED BY public.restaurant_comments.id;


--
-- Name: restaurant_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_likes (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: restaurant_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_likes_id_seq OWNED BY public.restaurant_likes.id;


--
-- Name: restaurant_menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_menu_items (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    name character varying(200) NOT NULL,
    price_krw integer NOT NULL,
    is_main_menu boolean NOT NULL,
    card_slot integer
);


--
-- Name: restaurant_menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_menu_items_id_seq OWNED BY public.restaurant_menu_items.id;


--
-- Name: restaurants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurants (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    city character varying(100) NOT NULL,
    district_id integer NOT NULL,
    category character varying(80) NOT NULL,
    summary text NOT NULL,
    image_url character varying(500),
    latitude double precision,
    longitude double precision,
    status character varying(32) NOT NULL,
    is_deleted boolean NOT NULL,
    deleted_at timestamp with time zone,
    submitted_by_user_id integer,
    approved_by_user_id integer,
    approved_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    image_urls text,
    points_eligible boolean DEFAULT true,
    bro_list_pin integer,
    franchise_pin boolean
);


--
-- Name: restaurants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurants_id_seq OWNED BY public.restaurants.id;


--
-- Name: site_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_events (
    id integer NOT NULL,
    author_id integer,
    body text NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    restaurant_id integer
);


--
-- Name: COLUMN site_events.restaurant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.site_events.restaurant_id IS 'NULL=상단 티커 전역 이벤트, 값 있음=해당 BroG 상세·썸네일 이벤트 배지';


--
-- Name: site_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_events_id_seq OWNED BY public.site_events.id;


--
-- Name: site_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_notices (
    slot integer NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: site_notices_slot_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_notices_slot_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_notices_slot_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_notices_slot_seq OWNED BY public.site_notices.slot;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    nickname character varying(100) NOT NULL,
    role character varying(50) NOT NULL,
    managed_district_id integer,
    email_verified_at timestamp with time zone,
    email_verification_token_hash character varying(128),
    email_verification_expires_at timestamp with time zone,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    password_change_code_hash character varying(128),
    password_change_expires_at timestamp with time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: districts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts ALTER COLUMN id SET DEFAULT nextval('public.districts_id_seq'::regclass);


--
-- Name: free_share_posts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_share_posts ALTER COLUMN id SET DEFAULT nextval('public.free_share_posts_id_seq'::regclass);


--
-- Name: known_restaurant_posts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.known_restaurant_posts ALTER COLUMN id SET DEFAULT nextval('public.known_restaurant_posts_id_seq'::regclass);


--
-- Name: payment_intents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents ALTER COLUMN id SET DEFAULT nextval('public.payment_intents_id_seq'::regclass);


--
-- Name: restaurant_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_comments ALTER COLUMN id SET DEFAULT nextval('public.restaurant_comments_id_seq'::regclass);


--
-- Name: restaurant_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_likes ALTER COLUMN id SET DEFAULT nextval('public.restaurant_likes_id_seq'::regclass);


--
-- Name: restaurant_menu_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_menu_items ALTER COLUMN id SET DEFAULT nextval('public.restaurant_menu_items_id_seq'::regclass);


--
-- Name: restaurants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants ALTER COLUMN id SET DEFAULT nextval('public.restaurants_id_seq'::regclass);


--
-- Name: site_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_events ALTER COLUMN id SET DEFAULT nextval('public.site_events_id_seq'::regclass);


--
-- Name: site_notices slot; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_notices ALTER COLUMN slot SET DEFAULT nextval('public.site_notices_slot_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: districts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.districts (id, name, active, sort_order) FROM stdin;
1	마포구	t	1
2	용산구	t	2
3	서대문구	t	3
4	영등포구	t	4
5	종로구	t	5
6	중구	t	6
7	강남구	t	20
8	송파구	t	21
9	성동구	t	22
\.


--
-- Data for Name: free_share_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.free_share_posts (id, author_id, title, body, district, image_url, created_at, updated_at) FROM stdin;
1	1	골프채 드려요	제가 몇 개 더 있어서 나눔 합니다.	마포구	/uploads/d755ae3a72db4b3ca12062c98ceb0ca7.jpg	2026-04-07 19:36:00.252123+09	2026-04-07 19:36:00.252126+09
\.


--
-- Data for Name: known_restaurant_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.known_restaurant_posts (id, author_id, title, body, restaurant_name, district, main_menu_name, main_menu_price, image_url, created_at, updated_at, city, district_id, category, summary, latitude, longitude, image_urls, menu_lines) FROM stdin;
4	2	TEST	dddd	TEST	마포구	냉명	5000	/uploads/brog/1bccc4ca878149b6983d4aa812399bf0.png	2026-04-09 17:48:37.609319+09	2026-04-09 17:48:37.609321+09	서울특별시	1	분식	dddd	37.550891	126.945808	["/uploads/brog/1bccc4ca878149b6983d4aa812399bf0.png", "[", "\\"", "/", "u"]	냉명 : 5000원
5	2	쇼텐 남영점	돈까스	쇼텐 남영점	마포구	돈까스	9000	/uploads/myg/82a5aa254caf484498fae0d2880c9990.png	2026-04-09 17:50:02.406974+09	2026-04-09 17:50:02.406977+09	서울특별시	1	한식	돈까스	37.545367	126.969739	["/uploads/myg/82a5aa254caf484498fae0d2880c9990.png", "/uploads/myg/704956125ecb4b0da0194bbdc15bd3d7.png", "/uploads/myg/c6bb3c57da7945c29db540d9a945c2d1.png", "/uploads/myg/7aebeba903b64a61bd27207ef29dc25a.png"]	돈까스 : 9000
9	1	상수동 쌀국수 길	향신료를 줄인 국물과 쌀면으로 가볍게 먹기 좋은 동남아 스타일 쌀국수 전문입니다.	상수동 쌀국수 길	마포구	얼큰 쌀국수	9500	https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&w=480&q=80	2026-04-10 10:55:17.97225+09	2026-04-10 10:55:17.972253+09	서울특별시	1	분식	향신료를 줄인 국물과 쌀면으로 가볍게 먹기 좋은 동남아 스타일 쌀국수 전문입니다.	37.547	126.922	["https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&w=480&q=80"]	얼큰 쌀국수 : 9500원\n짜조 반채 : 6000원
11	4	서일순대국	순대국	서일순대국	영등포구	순대국	10000	/uploads/myg/62367a3bbfaa4b2e942644790f855865.jpg	2026-04-10 11:44:23.623836+09	2026-04-10 11:44:23.623838+09	서울특별시	4	한식	순대국	37.497858	126.921115	["/uploads/myg/62367a3bbfaa4b2e942644790f855865.jpg"]	순대국 :10000
12	4	서일순대국	순대국	서일순대국	영등포구	순대국	10000	/uploads/myg/ef790dcfeda8471c9ddfeb918cf002c3.jpg	2026-04-10 11:51:21.01462+09	2026-04-10 11:51:21.014624+09	서울특별시	4	한식	순대국	37.497858	126.921115	["/uploads/myg/ef790dcfeda8471c9ddfeb918cf002c3.jpg", "/"]	순대국 : 10000원
13	4	망원 수제버거 키친	기본 버거는 부담 없이 즐기고, 추가 토핑 메뉴는 부메뉴로 확장되는 구조입니다.	망원 수제버거 키친	마포구	클래식 버거	8000	https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&w=480&q=80	2026-04-10 11:55:24.147592+09	2026-04-10 11:55:24.147594+09	서울특별시	1	패스트푸드	기본 버거는 부담 없이 즐기고, 추가 토핑 메뉴는 부메뉴로 확장되는 구조입니다.	37.556	126.91	["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&w=480&q=80"]	클래식 버거 : 8000원\n더블치즈 버거 : 12500원
14	2	브로고메	어떤가요?	브로고메	마포구	떡볶이	200	/uploads/myg/6c7994ec5fcb4fdf9f9f98c8f45e5337.png	2026-04-10 11:56:49.381442+09	2026-04-10 11:56:49.38145+09	서울특별시	1	양식	어떤가요?	37.548498	126.929746	["/uploads/myg/6c7994ec5fcb4fdf9f9f98c8f45e5337.png", "/"]	떡볶이 : 200원
15	2	합정 돈가스 살롱	바삭한 튀김옷과 진한 소스, 점심 특선으로 부담 없는 가격대를 유지합니다.	합정 돈가스 살롱	마포구	등심돈까스 정식	9000	/uploads/myg/17b709b327124a15adde44df4c32ae1c.jpg	2026-04-10 11:57:32.755231+09	2026-04-10 11:57:32.755235+09	서울특별시	1	일식	바삭한 튀김옷과 진한 소스, 점심 특선으로 부담 없는 가격대를 유지합니다.	37.549248	126.91517	["/uploads/myg/17b709b327124a15adde44df4c32ae1c.jpg", "/"]	등심돈까스 정식 : 9000원\n치즈 돈까스 : 11000원
17	2	신촌부페	엄청 싸요~	신촌부페	마포구	인당	10000	/uploads/myg/aae4ca88caa94060b0d78dc6b11ba3f2.jpg	2026-04-10 12:44:45.997606+09	2026-04-10 12:44:45.997611+09	서울특별시	1	한식	엄청 싸요~	37.556086	126.937556	["/uploads/myg/aae4ca88caa94060b0d78dc6b11ba3f2.jpg", "/"]	인당 : 10000원
19	1	합정 돈가스 살롱	바삭한 튀김옷과 진한 소스, 점심 특선으로 부담 없는 가격대를 유지합니다.	합정 돈가스 살롱	마포구	등심돈까스 정식	9000	/uploads/myg/078d9eb7ef6f4209b97175050eb08660.jpg	2026-04-10 14:34:00.077645+09	2026-04-10 14:34:00.07765+09	서울특별시	1	일식	바삭한 튀김옷과 진한 소스, 점심 특선으로 부담 없는 가격대를 유지합니다.	37.549248	126.91517	["/uploads/myg/078d9eb7ef6f4209b97175050eb08660.jpg", "/"]	등심돈까스 정식 : 9000원\n치즈 돈까스 : 11000원
3	1	홍어집	홍어	홍어집	영등포구	홍어	10000	/uploads/myg/98e52117dbf141d1b90ef7a26e1b6e37.png	2026-04-09 17:25:13.121617+09	2026-04-10 14:39:06.263609+09	서울특별시	4	한식	홍어	37.526152	126.9223	["/uploads/myg/98e52117dbf141d1b90ef7a26e1b6e37.png", "/uploads/myg/e341514ce5614b38abbabbcde8408190.jpg", "/uploads/myg/a37484029f644222a679f75510c304c9.jpg", "/uploads/myg/370c895b36a74cf88c469ea29c2ef44c.jpg"]	홍어 :10000
23	1	복성각 마포본점	서울 마포구 마포대로 63-8 삼창주택 지하 1층 복성각, 삼창 프라자 지하상가 - 복성각 -공덕역 1번 출구 뚜레주르 끼고 돌아서 오시면동서식품 뒷편 삼창프라자 지하상	복성각 마포본점	마포구	짜장면	8000	https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjAyMTVfMjUz%2FMDAxNzcxMTM4NjY4MjQy.AAuBNpF4J9-SzqotRU1W_Lwe0eVbIzRhYFJAIiweG9Eg.yNHrrzKngE5ICEY2OQq8vKMUXnEBQsm26jwAisYNookg.JPEG%2FIMG%25A3%25DF2035.jpg	2026-04-10 15:58:28.873853+09	2026-04-10 15:58:28.873857+09	서울특별시	1	중식	서울 마포구 마포대로 63-8 삼창주택 지하 1층 복성각, 삼창 프라자 지하상가 - 복성각 -공덕역 1번 출구 뚜레주르 끼고 돌아서 오시면동서식품 뒷편 삼창프라자 지하상	37.542249	126.947886	["https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjAyMTVfMjUz%2FMDAxNzcxMTM4NjY4MjQy.AAuBNpF4J9-SzqotRU1W_Lwe0eVbIzRhYFJAIiweG9Eg.yNHrrzKngE5ICEY2OQq8vKMUXnEBQsm26jwAisYNookg.JPEG%2FIMG%25A3%25DF2035.jpg", "https://search.pstatic.net/common/?src=https%3A%2F%2Fldb-phinf.pstatic.net%2F20150831_249%2F14409882498681pfeY_JPEG%2FSUBMIT_1358385046558_31238198.jpg"]	짜장면 : 8000원\n짬뽕 : 9000원\n볶음밥 : 9000원
25	1	호남식당	이 정도면 혜자죠~!	호남식당	마포구	백반	8000	https://search.pstatic.net/common/?src=https%3A%2F%2Fpup-review-phinf.pstatic.net%2FMjAyNTA4MDRfMTIy%2FMDAxNzU0Mjc4MTc2Mjgy.LKqHjn29VMF0yy_8G4L3c3usUZ8JU0DXiw-OYNcHmD8g.ByndQ71GQmvQv7v1AkKU9Cs0M-8jx-EMHohgezln0BUg.JPEG%2F25735968-271F-420C-82A0-2F231559F1DA.jpeg%3Ftype%3Dw1500_60_sharpen	2026-04-10 16:05:27.429093+09	2026-04-10 16:05:27.429095+09	서울특별시	1	한식	이 정도면 혜자죠~!	37.54947	126.937727	["https://search.pstatic.net/common/?src=https%3A%2F%2Fpup-review-phinf.pstatic.net%2FMjAyNTA4MDRfMTIy%2FMDAxNzU0Mjc4MTc2Mjgy.LKqHjn29VMF0yy_8G4L3c3usUZ8JU0DXiw-OYNcHmD8g.ByndQ71GQmvQv7v1AkKU9Cs0M-8jx-EMHohgezln0BUg.JPEG%2F25735968-271F-420C-82A0-2F231559F1DA.jpeg%3Ftype%3Dw1500_60_sharpen", "https://search.pstatic.net/common/?src=https%3A%2F%2Fpup-review-phinf.pstatic.net%2FMjAyNjAxMDFfMjAx%2FMDAxNzY3MjcyMjU5Njk4.JcSpQWlDoZF3J-qlYtJ8tV2tnshZODjMwGejseSchGQg.NFmESOBzFmbI07BPOXMKWwjTnEV4l4eSeRbgrUUh_UYg.JPEG%2F2550938B-E0C5-4C8B-92F2-8794C403CA99.jpeg%3Ftype%3Dw1500_60_sharpen", "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA1MTVfMjEx%2FMDAxNzQ3Mjk4ODYzOTcz.qBCXvv62aIkD_nBIEkToX10rwJKBZgDFqdJNOfEVknMg.jBteLEA7y2HaFwScblPAnfr6GGvPWou8szEQOY8_aoEg.JPEG%2FIMG%25A3%25DF4780.jpg"]	백반 : 8000원
24	1	신촌한식부페	엄청 싸요~	신촌한식부페	서대문구	인당	10000	/uploads/myg/35bd643613f44b32b7c9eaa59b4561f9.jpg	2026-04-10 15:59:15.883139+09	2026-04-10 18:01:50.022245+09	서울특별시	3	한식	엄청 싸요~	37.556261	126.93759	["/uploads/myg/35bd643613f44b32b7c9eaa59b4561f9.jpg", "/uploads/myg/aeb50d174bdb41879852682b4e736ab1.jpg"]	인당 : 10000원
26	1	DMC역 김치찌개 백반	직장인 단골이 많은 백반집으로, 김치찌개와 반찬이 안정적인 편입니다.	DMC역 김치찌개 백반	마포구	김치찌개 백반	9000	https://picsum.photos/seed/brogourmet10/480/360	2026-04-10 18:05:16.656291+09	2026-04-10 18:05:16.656294+09	서울특별시	1	한식	직장인 단골이 많은 백반집으로, 김치찌개와 반찬이 안정적인 편입니다.	37.577	126.897	["https://picsum.photos/seed/brogourmet10/480/360"]	김치찌개 백반 : 9000원\n제육볶음 추가 : 8000원
27	1	연남동 파스타 하우스	대표 주 메뉴는 1만원 이하, 프리미엄 파스타는 부메뉴로 선택할 수 있는 매장입니다.	연남동 파스타 하우스	마포구	런치 토마토 파스타	10000	https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&w=480&q=80	2026-04-10 18:05:22.039291+09	2026-04-10 18:05:22.039294+09	서울특별시	1	양식	대표 주 메뉴는 1만원 이하, 프리미엄 파스타는 부메뉴로 선택할 수 있는 매장입니다.	37.56	126.925	["https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&w=480&q=80", "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&w=480&q=80", "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&w=480&q=80"]	런치 토마토 파스타 : 10000원\n트러플 크림 파스타 : 16000원
31	1	ㅅㄷㄴㅅ	ㅅㄷㅅㄴ	ㅅㄷㄴㅅ	마포구	test	10000	\N	2026-04-10 18:42:24.23302+09	2026-04-10 18:42:24.233023+09	서울특별시	1	한식	ㅅㄷㅅㄴ	37.555763	126.956949	null	test :10000
\.


--
-- Data for Name: payment_intents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_intents (id, user_id, amount_krw, description, status, created_at) FROM stdin;
\.


--
-- Data for Name: restaurant_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurant_comments (id, restaurant_id, user_id, body, created_at) FROM stdin;
1	4	1	맛있어요`	2026-04-07 19:10:22.892972+09
2	3	1	저는 밀가루는 싫어요~	2026-04-07 19:18:23.915294+09
3	16	1	가가가	2026-04-09 10:57:06.301926+09
4	10	1	야호~~~!	2026-04-09 11:19:30.711247+09
5	17	1	거짓말~~	2026-04-09 11:41:02.597423+09
6	17	1	안 믿어	2026-04-09 11:41:15.754669+09
7	4	4	ㅎㅎㅎㅎㅎ	2026-04-10 11:55:17.723089+09
\.


--
-- Data for Name: restaurant_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurant_likes (id, restaurant_id, user_id, created_at) FROM stdin;
1	4	1	2026-04-07 19:10:27.294829+09
2	3	1	2026-04-07 19:18:13.174219+09
\.


--
-- Data for Name: restaurant_menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurant_menu_items (id, restaurant_id, name, price_krw, is_main_menu, card_slot) FROM stdin;
1	1	수육국밥	9000	t	1
2	1	수육 추가	12000	f	\N
3	2	연어덮밥	10000	t	1
4	2	사이드 사시미	14000	f	\N
5	3	런치 토마토 파스타	10000	t	1
6	3	트러플 크림 파스타	16000	f	\N
7	4	클래식 버거	8000	t	1
8	4	더블치즈 버거	12500	f	\N
9	5	런치 초밥 8pcs	10000	t	1
10	5	특선 초밥 12pcs	18000	f	\N
11	6	평양냉면	9500	t	1
12	6	수육 반접시	15000	f	\N
13	7	제육정식	9000	t	1
14	7	한옥 수육전골	17000	f	\N
15	8	조각 피자 세트	7000	t	1
16	8	마르게리타 피자 한 판	17000	f	\N
23	12	베이컨 에그토스트	5000	t	1
24	12	아메리카노	3000	f	\N
27	9	등심돈까스 정식	9000	t	1
28	9	치즈 돈까스	11000	f	2
29	15	떡볶이	200	t	1
33	16	짜장면	8000	t	1
34	16	짬뽕	9000	f	2
35	16	볶음밥	9000	f	3
36	10	얼큰 쌀국수	9500	t	1
37	10	짜조 반채	6000	f	2
39	18	김치찌개 백반	9000	t	1
40	18	제육볶음 추가	8000	f	\N
44	17	냉명	5000	t	1
45	20	스시	5000	t	1
46	19	순대국	10000	t	1
47	21	홍어	10000	t	1
51	25	백반	8000	t	1
52	24	돈까스	9000	t	1
54	27	얼큰 쌀국수	9500	t	1
55	27	짜조 반채	6000	f	2
56	28	얼큰 쌀국수	9500	t	1
57	28	짜조 반채	6000	f	\N
58	29	홍어	10000	t	1
59	26	순대국	10000	t	1
60	14	인당	10000	t	1
\.


--
-- Data for Name: restaurants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurants (id, name, city, district_id, category, summary, image_url, latitude, longitude, status, is_deleted, deleted_at, submitted_by_user_id, approved_by_user_id, approved_at, created_at, updated_at, image_urls, points_eligible, bro_list_pin, franchise_pin) FROM stdin;
1	강남 국밥 연구소	서울특별시	7	한식	든든한 국밥과 깔끔한 반찬 구성이 강점인 직장인 점심 맛집입니다.	https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&w=480&q=80	37.498	127.028	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.728202+09	2026-04-07 15:25:18.728205+09	\N	t	\N	\N
2	강남 덮밥 연구소	서울특별시	7	일식	대표 메뉴는 1만원 이하로 즐기고, 추가 메뉴는 선택적으로 주문할 수 있습니다.	https://images.unsplash.com/photo-1579584421335-c3e9bc87fad0?auto=format&w=480&q=80	37.5	127.036	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.730827+09	2026-04-07 15:25:18.730829+09	\N	t	\N	\N
5	송리단길 스시 바	서울특별시	8	일식	런치 대표 메뉴로 가볍게 입문할 수 있고, 추가 세트는 별도 선택이 가능합니다.	https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&w=480&q=80	37.514	127.105	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.735954+09	2026-04-07 15:25:18.735955+09	\N	t	\N	\N
6	잠실 냉면정	서울특별시	8	한식	맑은 육수와 부드러운 면발로 여름철 방문이 많은 냉면집입니다.	https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&w=480&q=80	37.513	127.1	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.737123+09	2026-04-07 15:25:18.737125+09	\N	t	\N	\N
7	광화문 한옥밥상	서울특별시	5	한식	관광객과 직장인 모두가 부담 없이 먹을 수 있는 정식 메뉴가 강점입니다.	https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&w=480&q=80	37.576	126.977	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.738155+09	2026-04-07 15:25:18.738156+09	\N	t	\N	\N
8	성수 화덕피자 공방	서울특별시	9	양식	조각 세트로 가볍게 즐길 수 있고, 화덕피자 한 판은 부메뉴로 제공됩니다.	https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&w=480&q=80	37.544	127.055	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.739103+09	2026-04-07 15:25:18.739104+09	\N	t	\N	\N
4	망원 수제버거 키친	서울특별시	1	패스트푸드	기본 버거는 부담 없이 즐기고, 추가 토핑 메뉴는 부메뉴로 확장되는 구조입니다.	https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&w=480&q=80	37.556	126.91	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.734931+09	2026-04-10 10:17:21.268305+09	\N	t	1	\N
10	상수동 쌀국수 길(원조!!!)	서울특별시	1	분식	향신료를 줄인 국물과 쌀면으로 가볍게 먹기 좋은 동남아 스타일 쌀국수 전문입니다.	https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&w=480&q=80	37.547	126.922	published	f	\N	\N	\N	\N	2026-04-08 10:52:53.766383+09	2026-04-10 14:30:16.615786+09	["https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&w=480&q=80", "/uploads/brog/d311f5f6cb6b41c8b60995f3c0285e81.jpg", "/uploads/brog/1c841514dea74d32b0e43970627d9374.jpg", "/uploads/brog/cda19dab4c0b4912a02f5954ce3240ff.jpg"]	t	\N	\N
14	신촌한식부페	서울특별시	3	한식	엄청 싸요~	/uploads/brog/dd18ebda30064f35b7e226cc97b27872.jpg	37.556086	126.937556	published	f	\N	2	2	2026-04-09 10:35:32.842984+09	2026-04-09 10:35:32.844396+09	2026-04-10 18:06:25.072403+09	["/uploads/brog/dd18ebda30064f35b7e226cc97b27872.jpg", "/uploads/brog/8ac9018d31e14d60ad87a8ef744e90a8.jpg"]	t	\N	\N
18	DMC역 김치찌개 백반	서울특별시	1	한식	직장인 단골이 많은 백반집으로, 김치찌개와 반찬이 안정적인 편입니다.	https://picsum.photos/seed/brogourmet10/480/360	37.577	126.897	published	f	\N	\N	\N	\N	2026-04-09 11:24:27.736576+09	2026-04-10 10:38:52.09735+09	null	t	3	\N
17	TEST	서울특별시	2	분식	dddd	/uploads/brog/1bccc4ca878149b6983d4aa812399bf0.png	37.542399	126.965033	published	f	\N	1	1	2026-04-09 11:04:17.479482+09	2026-04-09 11:04:17.479824+09	2026-04-09 18:02:09.811535+09	["/uploads/brog/1bccc4ca878149b6983d4aa812399bf0.png", "/uploads/brog/6c6c7843e6774d45aabd916dd1dcf2f4.jpg", "/uploads/brog/7f5fc636919d4267a566a139fcb3166d.png", "/uploads/brog/e3472744e86649739bd7061a03b5ceac.png"]	t	\N	\N
3	연남동 파스타 하우스	서울특별시	1	양식	대표 주 메뉴는 1만원 이하, 프리미엄 파스타는 부메뉴로 선택할 수 있는 매장입니다.	https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&w=480&q=80	37.56	126.925	published	f	\N	\N	\N	\N	2026-04-07 15:25:18.733814+09	2026-04-10 13:06:09.797985+09	["https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&w=480&q=80", "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&w=480&q=80", "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&w=480&q=80"]	t	\N	\N
15	브로고메	서울특별시	1	양식	어떤가요?	/uploads/brog/323d9dd4de8e4c31b637d40beaece7ca.png	37.548498	126.929746	published	f	\N	1	1	2026-04-09 10:46:24.583584+09	2026-04-09 10:46:24.583928+09	2026-04-10 10:09:05.272648+09	["/uploads/brog/323d9dd4de8e4c31b637d40beaece7ca.png", "/uploads/brog/7f330b5c3e3544a08d8f5e795388c7af.jpg", "/uploads/brog/1cbf89469ea845938839980ef0ce1ea2.jpg", "/uploads/brog/bf16531c777a4c36b12cef2dd5b407a5.png", "/uploads/brog/6f759de05c174d9398c3d19bc5b60398.png"]	t	\N	\N
21	홍어집(원조!!!)	서울특별시	4	한식	홍어	/uploads/myg/98e52117dbf141d1b90ef7a26e1b6e37.png	37.526152	126.922369	published	f	\N	1	1	2026-04-09 18:04:41.189256+09	2026-04-09 18:04:41.189552+09	2026-04-10 14:39:16.259262+09	["/uploads/myg/98e52117dbf141d1b90ef7a26e1b6e37.png"]	t	\N	\N
20	TEST2	서울특별시	2	일식	오마카세~	/uploads/brog/448b6b627d684d6fbb0cfb0e713bd91f.jpg	37.545072	126.967059	published	f	\N	2	2	2026-04-09 17:55:50.12629+09	2026-04-09 17:55:50.128306+09	2026-04-10 14:27:59.091687+09	["/uploads/brog/448b6b627d684d6fbb0cfb0e713bd91f.jpg", "/uploads/brog/d0b54f5baca94066af4ba47bfb106d0b.jpg", "/uploads/brog/ddce0100b09c4e20b17e24adc1507b2e.jpg"]	t	1	\N
19	일삼통뼈감자탕뼈구이	서울특별시	2	한식	ㅇㅇ	/uploads/brog/fe436ffd4eb54b22b22eadab17112cab.jpg	37.546235	126.972253	published	f	\N	1	1	2026-04-09 17:07:20.642003+09	2026-04-09 17:07:20.642919+09	2026-04-10 15:55:45.014946+09	["/uploads/brog/fe436ffd4eb54b22b22eadab17112cab.jpg", "/uploads/brog/dd4447cb966f40f2be23162058c161e0.jpg", "/uploads/brog/3672de9e07f6418eb50001250033407a.jpg"]	t	\N	t
12	홍대 입구 에그토스트	서울특별시	1	패스트푸드	이동 중에도 먹기 좋은 에그토스트와 음료 조합이 인기입니다.	https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&w=480&q=80	37.556	126.923	published	f	\N	\N	\N	\N	2026-04-08 10:52:53.770434+09	2026-04-10 09:59:35.030911+09	null	t	\N	\N
9	합정 돈가스 살롱	서울특별시	1	일식	바삭한 튀김옷과 진한 소스, 점심 특선으로 부담 없는 가격대를 유지합니다.	/uploads/brog/de324c67e7374f5195e5ab9e21647502.jpg	37.549248	126.91517	published	f	\N	\N	\N	\N	2026-04-08 10:52:53.762018+09	2026-04-10 14:51:48.42271+09	["/uploads/brog/de324c67e7374f5195e5ab9e21647502.jpg", "/uploads/brog/91768975ff5248dabd7b124c34a3d772.png", "/uploads/brog/98bebd73bcb54d84a81bb3a7c193ddc3.png"]	t	4	t
24	쇼텐 남영점	서울특별시	2	한식	돈까스	/uploads/myg/82a5aa254caf484498fae0d2880c9990.png	37.545367	126.969739	published	f	\N	2	2	2026-04-10 11:00:49.074154+09	2026-04-10 11:00:49.075588+09	2026-04-10 11:12:32.710191+09	["/uploads/myg/82a5aa254caf484498fae0d2880c9990.png", "/uploads/myg/704956125ecb4b0da0194bbdc15bd3d7.png", "/uploads/myg/c6bb3c57da7945c29db540d9a945c2d1.png", "/uploads/myg/7aebeba903b64a61bd27207ef29dc25a.png"]	t	\N	\N
16	복성각 마포본점	서울특별시	1	중식	서울 마포구 마포대로 63-8 삼창주택 지하 1층 복성각, 삼창 프라자 지하상가 - 복성각 -공덕역 1번 출구 뚜레주르 끼고 돌아서 오시면동서식품 뒷편 삼창프라자 지하상	https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjAyMTVfMjUz%2FMDAxNzcxMTM4NjY4MjQy.AAuBNpF4J9-SzqotRU1W_Lwe0eVbIzRhYFJAIiweG9Eg.yNHrrzKngE5ICEY2OQq8vKMUXnEBQsm26jwAisYNookg.JPEG%2FIMG%25A3%25DF2035.jpg	37.542249	126.947886	published	f	\N	1	1	2026-04-09 10:54:09.992664+09	2026-04-09 10:54:09.993232+09	2026-04-10 10:39:04.949802+09	["https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjAyMTVfMjUz%2FMDAxNzcxMTM4NjY4MjQy.AAuBNpF4J9-SzqotRU1W_Lwe0eVbIzRhYFJAIiweG9Eg.yNHrrzKngE5ICEY2OQq8vKMUXnEBQsm26jwAisYNookg.JPEG%2FIMG%25A3%25DF2035.jpg", "https://search.pstatic.net/common/?src=https%3A%2F%2Fldb-phinf.pstatic.net%2F20150831_249%2F14409882498681pfeY_JPEG%2FSUBMIT_1358385046558_31238198.jpg"]	t	\N	\N
25	호남식당	서울특별시	1	한식	이 정도면 혜자죠~!	https://search.pstatic.net/common/?src=https%3A%2F%2Fpup-review-phinf.pstatic.net%2FMjAyNTA4MDRfMTIy%2FMDAxNzU0Mjc4MTc2Mjgy.LKqHjn29VMF0yy_8G4L3c3usUZ8JU0DXiw-OYNcHmD8g.ByndQ71GQmvQv7v1AkKU9Cs0M-8jx-EMHohgezln0BUg.JPEG%2F25735968-271F-420C-82A0-2F231559F1DA.jpeg%3Ftype%3Dw1500_60_sharpen	37.54947	126.937727	published	f	\N	2	2	2026-04-10 11:06:13.121871+09	2026-04-10 11:06:13.122426+09	2026-04-10 14:51:47.073909+09	["https://search.pstatic.net/common/?src=https%3A%2F%2Fpup-review-phinf.pstatic.net%2FMjAyNTA4MDRfMTIy%2FMDAxNzU0Mjc4MTc2Mjgy.LKqHjn29VMF0yy_8G4L3c3usUZ8JU0DXiw-OYNcHmD8g.ByndQ71GQmvQv7v1AkKU9Cs0M-8jx-EMHohgezln0BUg.JPEG%2F25735968-271F-420C-82A0-2F231559F1DA.jpeg%3Ftype%3Dw1500_60_sharpen", "https://search.pstatic.net/common/?src=https%3A%2F%2Fpup-review-phinf.pstatic.net%2FMjAyNjAxMDFfMjAx%2FMDAxNzY3MjcyMjU5Njk4.JcSpQWlDoZF3J-qlYtJ8tV2tnshZODjMwGejseSchGQg.NFmESOBzFmbI07BPOXMKWwjTnEV4l4eSeRbgrUUh_UYg.JPEG%2F2550938B-E0C5-4C8B-92F2-8794C403CA99.jpeg%3Ftype%3Dw1500_60_sharpen", "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA1MTVfMjEx%2FMDAxNzQ3Mjk4ODYzOTcz.qBCXvv62aIkD_nBIEkToX10rwJKBZgDFqdJNOfEVknMg.jBteLEA7y2HaFwScblPAnfr6GGvPWou8szEQOY8_aoEg.JPEG%2FIMG%25A3%25DF4780.jpg"]	t	\N	t
27	상수동 쌀국수 길_1	서울특별시	1	분식	향신료를 줄인 국물과 쌀면으로 가볍게 먹기 좋은 동남아 스타일 쌀국수 전문입니다.	https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&w=480&q=80	37.547	126.922	published	f	\N	1	1	2026-04-10 14:30:16.609281+09	2026-04-10 14:30:16.611383+09	2026-04-10 14:30:16.616255+09	["https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&w=480&q=80"]	f	\N	\N
28	상수동 쌀국수 길	서울특별시	1	분식	향신료를 줄인 국물과 쌀면으로 가볍게 먹기 좋은 동남아 스타일 쌀국수 전문입니다.	https://picsum.photos/seed/brogourmet8/480/360	37.547	126.922	published	f	\N	\N	\N	\N	2026-04-10 14:36:17.485394+09	2026-04-10 14:36:17.485397+09	null	t	\N	\N
29	홍어집_1	서울특별시	4	한식	홍어	/uploads/myg/98e52117dbf141d1b90ef7a26e1b6e37.png	37.526152	126.9223	published	f	\N	1	1	2026-04-10 14:39:16.248432+09	2026-04-10 14:39:16.250154+09	2026-04-10 14:39:16.259718+09	["/uploads/myg/98e52117dbf141d1b90ef7a26e1b6e37.png", "/uploads/myg/e341514ce5614b38abbabbcde8408190.jpg", "/uploads/myg/a37484029f644222a679f75510c304c9.jpg", "/uploads/myg/370c895b36a74cf88c469ea29c2ef44c.jpg"]	f	\N	\N
26	서일순대국	서울특별시	4	한식	순대국	/uploads/myg/62367a3bbfaa4b2e942644790f855865.jpg	37.497858	126.921115	published	f	\N	4	4	2026-04-10 11:51:04.424247+09	2026-04-10 11:51:04.426365+09	2026-04-10 14:41:03.623749+09	["/uploads/myg/62367a3bbfaa4b2e942644790f855865.jpg"]	t	1	\N
\.


--
-- Data for Name: site_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_events (id, author_id, body, is_active, created_at, restaurant_id) FROM stdin;
2	1	4인이상 모든 손님에게 음료수 공짜 제공!~~~ \n\n기간 : 4월 10일부터 ~ 4월 말일까지	t	2026-04-09 18:08:36.710418+09	\N
3	1	저녁 5시 이전 손님은 10% 할인 적용	t	2026-04-10 09:56:59.948966+09	9
\.


--
-- Data for Name: site_notices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_notices (slot, title, body, updated_at) FROM stdin;
1		'Broke Gourmet(고단한 미식가)는 서울 기준 대표 주 메뉴 1만 원 이하 맛집을 소개합니다. \n \n비싸면서 맛있는 집은 당연한 겁니다. 싸면서 맛있어야 진짜 맛집이라고 생각합니다. -- 주인장 --	2026-04-10 17:24:39.788691+09
2		'현재 빌드는 1단계 테스트 버전입니다. 지역 선택은 마포·용산·서대문·영등포·종로·중구 6개 구로 한정됩니다. 각 구 안 BroG는 가격 조건에 맞게 노출됩니다. 정식 오픈·서울 전 구 확장 시 빌드 옵션(VITE_BROG_FULL_MAP)과 공지로 안내합니다.'	2026-04-10 17:24:39.789248+09
3			2026-04-10 17:24:39.789557+09
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, nickname, role, managed_district_id, email_verified_at, email_verification_token_hash, email_verification_expires_at, is_active, created_at, updated_at, password_change_code_hash, password_change_expires_at) FROM stdin;
1	2corea@gmail.com	$2b$12$Ca/qX4o9RvAVfJGZtKKXZepeLHNHJH6tEUjk8pDxzkIAReUByYKzS	브로	super_admin	\N	2026-04-08 12:23:28.404412+09	\N	\N	t	2026-04-07 15:44:41.895107+09	2026-04-08 12:23:28.405064+09	\N	\N
3	shinypsy@naver.com	$2b$12$ScUfmVccTwNHJIt5pGfCAeaKykGUr46bIvK/Uf6YgoNL987ckzuKO	구담당자	user	\N	\N	d964820481097c397ed26db498ea9182c0e5483306febc8d9dd43b747f634e5c	2026-04-11 16:30:36.451982+09	t	2026-04-09 16:30:36.454588+09	2026-04-09 16:30:36.454591+09	\N	\N
4	shinypsy@gmail.com	$2b$12$JrCB0vrgZ8qc5E5zyGf0FOEUG86UH1M/FQgVb7HG/5hTHhAhPT7rG	구담당자	regional_manager	1	2026-04-09 16:36:08.841808+09	\N	\N	t	2026-04-09 16:35:13.847815+09	2026-04-09 16:36:08.849111+09	\N	\N
2	shinypsy@daum.net	$2b$12$aiZ5E6kf8.Zgs2Atv5tTeuu23o3mwJHcuTLDqfzi6hJLCiKOJZkq2	유저1	user	\N	2026-04-08 12:09:35.112662+09	\N	\N	t	2026-04-08 11:39:41.046748+09	2026-04-08 12:09:35.113328+09	\N	\N
\.


--
-- Name: districts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.districts_id_seq', 9, true);


--
-- Name: free_share_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.free_share_posts_id_seq', 1, true);


--
-- Name: known_restaurant_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.known_restaurant_posts_id_seq', 31, true);


--
-- Name: payment_intents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_intents_id_seq', 1, false);


--
-- Name: restaurant_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurant_comments_id_seq', 7, true);


--
-- Name: restaurant_likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurant_likes_id_seq', 2, true);


--
-- Name: restaurant_menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurant_menu_items_id_seq', 60, true);


--
-- Name: restaurants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurants_id_seq', 29, true);


--
-- Name: site_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.site_events_id_seq', 3, true);


--
-- Name: site_notices_slot_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.site_notices_slot_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: districts districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_pkey PRIMARY KEY (id);


--
-- Name: free_share_posts free_share_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_share_posts
    ADD CONSTRAINT free_share_posts_pkey PRIMARY KEY (id);


--
-- Name: known_restaurant_posts known_restaurant_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.known_restaurant_posts
    ADD CONSTRAINT known_restaurant_posts_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (id);


--
-- Name: restaurant_comments restaurant_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_comments
    ADD CONSTRAINT restaurant_comments_pkey PRIMARY KEY (id);


--
-- Name: restaurant_likes restaurant_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_likes
    ADD CONSTRAINT restaurant_likes_pkey PRIMARY KEY (id);


--
-- Name: restaurant_menu_items restaurant_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_menu_items
    ADD CONSTRAINT restaurant_menu_items_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: site_events site_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_events
    ADD CONSTRAINT site_events_pkey PRIMARY KEY (id);


--
-- Name: site_notices site_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_notices
    ADD CONSTRAINT site_notices_pkey PRIMARY KEY (slot);


--
-- Name: restaurant_likes uq_restaurant_like_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_likes
    ADD CONSTRAINT uq_restaurant_like_user UNIQUE (restaurant_id, user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_districts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_districts_id ON public.districts USING btree (id);


--
-- Name: ix_districts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_districts_name ON public.districts USING btree (name);


--
-- Name: ix_free_share_posts_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_free_share_posts_author_id ON public.free_share_posts USING btree (author_id);


--
-- Name: ix_free_share_posts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_free_share_posts_id ON public.free_share_posts USING btree (id);


--
-- Name: ix_known_restaurant_posts_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_known_restaurant_posts_author_id ON public.known_restaurant_posts USING btree (author_id);


--
-- Name: ix_known_restaurant_posts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_known_restaurant_posts_id ON public.known_restaurant_posts USING btree (id);


--
-- Name: ix_payment_intents_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_intents_id ON public.payment_intents USING btree (id);


--
-- Name: ix_payment_intents_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_intents_user_id ON public.payment_intents USING btree (user_id);


--
-- Name: ix_restaurant_comments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_comments_id ON public.restaurant_comments USING btree (id);


--
-- Name: ix_restaurant_comments_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_comments_restaurant_id ON public.restaurant_comments USING btree (restaurant_id);


--
-- Name: ix_restaurant_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_comments_user_id ON public.restaurant_comments USING btree (user_id);


--
-- Name: ix_restaurant_likes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_likes_id ON public.restaurant_likes USING btree (id);


--
-- Name: ix_restaurant_likes_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_likes_restaurant_id ON public.restaurant_likes USING btree (restaurant_id);


--
-- Name: ix_restaurant_likes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_likes_user_id ON public.restaurant_likes USING btree (user_id);


--
-- Name: ix_restaurant_menu_items_card_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_menu_items_card_slot ON public.restaurant_menu_items USING btree (card_slot);


--
-- Name: ix_restaurant_menu_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_menu_items_id ON public.restaurant_menu_items USING btree (id);


--
-- Name: ix_restaurant_menu_items_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurant_menu_items_restaurant_id ON public.restaurant_menu_items USING btree (restaurant_id);


--
-- Name: ix_restaurants_district_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurants_district_id ON public.restaurants USING btree (district_id);


--
-- Name: ix_restaurants_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurants_id ON public.restaurants USING btree (id);


--
-- Name: ix_restaurants_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurants_is_deleted ON public.restaurants USING btree (is_deleted);


--
-- Name: ix_restaurants_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_restaurants_status ON public.restaurants USING btree (status);


--
-- Name: ix_site_events_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_events_author_id ON public.site_events USING btree (author_id);


--
-- Name: ix_site_events_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_events_id ON public.site_events USING btree (id);


--
-- Name: ix_site_events_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_events_restaurant_id ON public.site_events USING btree (restaurant_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_managed_district_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_managed_district_id ON public.users USING btree (managed_district_id);


--
-- Name: free_share_posts free_share_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_share_posts
    ADD CONSTRAINT free_share_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: known_restaurant_posts known_restaurant_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.known_restaurant_posts
    ADD CONSTRAINT known_restaurant_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: payment_intents payment_intents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: restaurant_comments restaurant_comments_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_comments
    ADD CONSTRAINT restaurant_comments_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_comments restaurant_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_comments
    ADD CONSTRAINT restaurant_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_likes restaurant_likes_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_likes
    ADD CONSTRAINT restaurant_likes_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_likes restaurant_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_likes
    ADD CONSTRAINT restaurant_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_menu_items restaurant_menu_items_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_menu_items
    ADD CONSTRAINT restaurant_menu_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurants restaurants_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: restaurants restaurants_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE RESTRICT;


--
-- Name: restaurants restaurants_submitted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: site_events site_events_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_events
    ADD CONSTRAINT site_events_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: site_events site_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_events
    ADD CONSTRAINT site_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL;


--
-- Name: users users_managed_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_managed_district_id_fkey FOREIGN KEY (managed_district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict eA12wd9lZxCtD651DVrbMXHVatHK0fzWQMtIqkZq9f7fAKdNUtcRlGGLrplfe2t

