--
-- PostgreSQL database dump
--

\restrict J36TAWMKuBVi988Vrx1ygMkU1dAlfOuX5q2BH4WGVPgM4JGmsh1XkGIjsHDACQn

-- Dumped from database version 16.14
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_code character varying(50) NOT NULL,
    full_name character varying(100) NOT NULL,
    phone character varying(20),
    email character varying(150),
    address text,
    city character varying(100),
    tags text[],
    notes text,
    is_vip boolean DEFAULT false,
    credit_limit numeric(10,2) DEFAULT 0,
    credit_balance numeric(10,2) DEFAULT 0,
    avatar_url character varying(500),
    sms_notifications boolean DEFAULT true,
    email_notifications boolean DEFAULT true,
    whatsapp_notifications boolean DEFAULT false,
    marketing_offers boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#6B7280'::character varying,
    icon character varying(50),
    budget_limit numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    category_id uuid,
    vendor character varying(150),
    amount numeric(10,2) NOT NULL,
    payment_method character varying(30),
    expense_date date DEFAULT CURRENT_DATE,
    reference_no character varying(100),
    receipt_url character varying(500),
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expenses_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'mpesa'::character varying, 'bank_transfer'::character varying, 'card'::character varying])::text[])))
);


--
-- Name: held_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.held_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    label character varying(100),
    type character varying(20) DEFAULT 'dine_in'::character varying NOT NULL,
    table_id uuid,
    table_number character varying(20),
    customer_name character varying(100),
    items jsonb NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT held_orders_type_check CHECK (((type)::text = ANY ((ARRAY['dine_in'::character varying, 'takeaway'::character varying, 'delivery'::character varying])::text[])))
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sku character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    category character varying(100),
    supplier_id uuid,
    quantity numeric(10,2) DEFAULT 0,
    unit character varying(30) DEFAULT 'Kg'::character varying NOT NULL,
    cost_per_unit numeric(10,2) DEFAULT 0,
    reorder_level numeric(10,2) DEFAULT 0,
    expiry_date date,
    location character varying(100) DEFAULT 'Main Store'::character varying,
    image_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_item_id uuid,
    type character varying(30) NOT NULL,
    quantity_change numeric(10,2) NOT NULL,
    quantity_before numeric(10,2) NOT NULL,
    quantity_after numeric(10,2) NOT NULL,
    notes text,
    reference_id uuid,
    performed_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inventory_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['purchase'::character varying, 'adjustment'::character varying, 'sale'::character varying, 'waste'::character varying, 'transfer'::character varying])::text[])))
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'declined'::character varying])::text[])))
);


--
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid,
    total_points integer DEFAULT 0,
    available_points integer DEFAULT 0,
    redeemed_points integer DEFAULT 0,
    tier_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: loyalty_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_rewards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    points_cost integer NOT NULL,
    reward_type character varying(30),
    reward_value numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT loyalty_rewards_reward_type_check CHECK (((reward_type)::text = ANY ((ARRAY['discount_voucher'::character varying, 'free_item'::character varying, 'cash_voucher'::character varying])::text[])))
);


--
-- Name: loyalty_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_tiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(50) NOT NULL,
    min_points integer DEFAULT 0 NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    benefits text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid,
    type character varying(20) NOT NULL,
    points integer NOT NULL,
    description text,
    reference_id uuid,
    performed_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT loyalty_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['earn'::character varying, 'redeem'::character varying, 'adjust'::character varying, 'expire'::character varying])::text[])))
);


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: menu_item_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_modifiers (
    menu_item_id uuid NOT NULL,
    modifier_id uuid NOT NULL
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id uuid,
    name character varying(150) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    cost numeric(10,2) DEFAULT 0,
    image_url character varying(500),
    preparation_time integer DEFAULT 15,
    status character varying(20) DEFAULT 'available'::character varying,
    tags text[],
    is_featured boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    track_stock boolean DEFAULT false NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 5 NOT NULL,
    CONSTRAINT menu_items_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'unavailable'::character varying, 'out_of_stock'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: menu_modifier_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_modifier_options (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    modifier_id uuid,
    name character varying(100) NOT NULL,
    price_adjustment numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: menu_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_modifiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(20) DEFAULT 'single'::character varying,
    is_required boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT menu_modifiers_type_check CHECK (((type)::text = ANY ((ARRAY['single'::character varying, 'multiple'::character varying])::text[])))
);


--
-- Name: menu_stock_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_stock_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    menu_item_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    quantity_change integer NOT NULL,
    quantity_before integer NOT NULL,
    quantity_after integer NOT NULL,
    notes text,
    reference_id uuid,
    performed_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT menu_stock_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['sale'::character varying, 'restock'::character varying, 'adjustment'::character varying])::text[])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    type character varying(30) DEFAULT 'info'::character varying,
    is_read boolean DEFAULT false,
    reference_type character varying(50),
    reference_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'success'::character varying])::text[])))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid,
    menu_item_id uuid,
    item_name character varying(150) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    modifiers jsonb,
    special_instructions text,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_items_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'preparing'::character varying, 'ready'::character varying, 'served'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_number character varying(50) NOT NULL,
    type character varying(20) DEFAULT 'dine_in'::character varying NOT NULL,
    status character varying(30) DEFAULT 'new'::character varying NOT NULL,
    table_id uuid,
    customer_id uuid,
    customer_name character varying(100),
    guests integer DEFAULT 1,
    subtotal numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    service_charge numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0,
    amount_paid numeric(10,2) DEFAULT 0 NOT NULL,
    special_instructions text,
    served_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    inventory_deducted boolean DEFAULT false NOT NULL,
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['awaiting_payment'::character varying, 'new'::character varying, 'preparing'::character varying, 'ready'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT orders_type_check CHECK (((type)::text = ANY ((ARRAY['dine_in'::character varying, 'takeaway'::character varying, 'delivery'::character varying])::text[])))
);


--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_resets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid,
    payment_method character varying(30) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    reference character varying(100),
    mpesa_transaction_id character varying(100),
    mpesa_phone character varying(20),
    mpesa_merchant_request_id character varying(100),
    result_code character varying(10),
    result_desc text,
    split_details jsonb,
    expires_at timestamp without time zone,
    processed_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'mpesa'::character varying, 'card'::character varying, 'split'::character varying])::text[]))),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    purchase_order_id uuid,
    inventory_item_id uuid,
    item_name character varying(150) NOT NULL,
    unit character varying(30) NOT NULL,
    quantity_ordered numeric(10,2) NOT NULL,
    quantity_received numeric(10,2) DEFAULT 0,
    unit_price numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    po_number character varying(50) NOT NULL,
    supplier_id uuid,
    status character varying(30) DEFAULT 'draft'::character varying,
    order_date date DEFAULT CURRENT_DATE,
    expected_date date,
    received_date date,
    subtotal numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0,
    payment_status character varying(30) DEFAULT 'unpaid'::character varying,
    notes text,
    attachment_url character varying(500),
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT purchase_orders_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying])::text[]))),
    CONSTRAINT purchase_orders_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'partially_received'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_ingredients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    menu_item_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity_per_item numeric(12,3) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT recipe_ingredients_quantity_per_item_check CHECK ((quantity_per_item > (0)::numeric))
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    payment_id uuid,
    amount numeric(10,2) NOT NULL,
    reason text,
    method character varying(30) DEFAULT 'cash'::character varying NOT NULL,
    is_void boolean DEFAULT false NOT NULL,
    restocked boolean DEFAULT false NOT NULL,
    points_reversed integer DEFAULT 0 NOT NULL,
    processed_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT refunds_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT refunds_method_check CHECK (((method)::text = ANY ((ARRAY['cash'::character varying, 'mpesa'::character varying, 'card'::character varying, 'store_credit'::character varying])::text[])))
);


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    table_id uuid,
    customer_id uuid,
    customer_name character varying(100),
    customer_phone character varying(20),
    guests integer DEFAULT 1 NOT NULL,
    reservation_time timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 90,
    status character varying(20) DEFAULT 'confirmed'::character varying,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reservations_status_check CHECK (((status)::text = ANY ((ARRAY['confirmed'::character varying, 'seated'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'no_show'::character varying])::text[])))
);


--
-- Name: restaurant_tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_tables (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    table_number character varying(10) NOT NULL,
    area character varying(50) DEFAULT 'Main Hall'::character varying,
    capacity integer DEFAULT 2 NOT NULL,
    status character varying(20) DEFAULT 'available'::character varying,
    current_order_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT restaurant_tables_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'occupied'::character varying, 'reserved'::character varying, 'cleaning'::character varying])::text[])))
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(100) NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid
);


--
-- Name: staff_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    shift_date date NOT NULL,
    shift_type character varying(30),
    start_time time without time zone,
    end_time time without time zone,
    role_label character varying(50),
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT staff_schedules_shift_type_check CHECK (((shift_type)::text = ANY ((ARRAY['morning'::character varying, 'day'::character varying, 'evening'::character varying, 'night'::character varying, 'off'::character varying])::text[])))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(150) NOT NULL,
    contact_person character varying(100),
    phone character varying(20),
    email character varying(150),
    address text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(20),
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'waiter'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    schedule_type character varying(20) DEFAULT 'full_time'::character varying,
    avatar_url character varying(500),
    joined_date date DEFAULT CURRENT_DATE,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approval_status character varying(20) DEFAULT 'approved'::character varying NOT NULL,
    CONSTRAINT users_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['administrator'::character varying, 'manager'::character varying, 'head_chef'::character varying, 'cashier'::character varying, 'waiter'::character varying, 'kitchen_staff'::character varying, 'cleaner'::character varying])::text[]))),
    CONSTRAINT users_schedule_type_check CHECK (((schedule_type)::text = ANY ((ARRAY['full_time'::character varying, 'part_time'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'on_leave'::character varying])::text[])))
);


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, customer_code, full_name, phone, email, address, city, tags, notes, is_vip, credit_limit, credit_balance, avatar_url, sms_notifications, email_notifications, whatsapp_notifications, marketing_offers, status, created_at, updated_at) FROM stdin;
29288eca-5c23-4b13-8047-57301360d974	CUS-000245	John Mwangi	0712 345 678	john.mwangi@gmail.com	\N	Nairobi	{VIP,Regular,Family,"Weekend Customer"}	\N	t	10000.00	2450.00	\N	t	t	f	f	active	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
6a15d3ef-0f1e-4bd2-b099-a8afedb85907	CUS-000246	Mary Akinyi	0701 234 567	mary.akinyi@gmail.com	\N	Nairobi	{Regular}	\N	f	5000.00	0.00	\N	t	t	f	f	active	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
cb70069d-0003-4e86-ba96-bf928e0d0f1c	CUS-000247	Brian Odour	0723 456 789	brian.odour@gmail.com	\N	Nairobi	{Regular}	\N	f	5000.00	0.00	\N	t	t	f	f	active	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
8c1bfae2-0939-4b61-baef-25e8dbb2d7f6	CUS-000248	Lucy Kamau	0709 876 543	lucy.kamau@gmail.com	\N	Nairobi	{Regular}	\N	f	0.00	0.00	\N	t	t	f	f	active	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
4ba9f914-126e-4f22-a78c-b750ea0cfbde	CUS-000249	Peter Njenga	0715 678 901	peter.njenga@gmail.com	\N	Nairobi	{Regular}	\N	f	0.00	0.00	\N	t	t	f	f	inactive	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
8eb081b1-c2cb-4ddb-920b-043e554cc0df	CUS-000250	Emily Wanjiku	0704 321 654	emily.wanjiku@gmail.com	\N	Nairobi	{Regular}	\N	f	0.00	0.00	\N	t	t	f	f	inactive	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
f60c9464-0b6d-4bd4-b28f-8b5370fae023	CUS-000251	David Mutua	0720 987 654	david.mutua@gmail.com	\N	Nairobi	{Regular}	\N	f	0.00	0.00	\N	t	t	f	f	active	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
bdd5bf5d-22a0-45b1-9c49-af2e79f00b38	CUS-000252	Sophia Njeri	0703 654 321	sophia.njeri@gmail.com	\N	Nairobi	{VIP,Regular}	\N	t	10000.00	0.00	\N	t	t	f	f	active	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
4200d992-1fe0-44d2-984f-ded5cda43fb5	CUS-900530704	Joseph Kimunya		kimunyajoseph77@gmail.com		Nairobi	{}		t	0.00	0.00	\N	t	t	f	f	active	2026-07-03 20:15:00.532415	2026-07-03 20:15:00.532415
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_categories (id, name, color, icon, budget_limit, created_at) FROM stdin;
269c67e0-04d0-4847-b2c4-538239d8d7b2	Purchases	#3B82F6	\N	100000.00	2026-07-02 14:43:47.302039
d7459217-8433-4644-b56d-692731ba9ff4	Salaries	#8B5CF6	\N	80000.00	2026-07-02 14:43:47.302039
946e52fe-4732-431c-be65-b9fed206d316	Rent	#10B981	\N	55000.00	2026-07-02 14:43:47.302039
f407539d-1aae-4cb1-968c-f5262bb84c29	Utilities	#F59E0B	\N	20000.00	2026-07-02 14:43:47.302039
f5e18ca7-0184-49cb-81a6-129b77b2f4ff	Marketing	#EF4444	\N	15000.00	2026-07-02 14:43:47.302039
4ea97eda-e020-4321-a84a-eaeb48835d9a	Supplies	#6B7280	\N	10000.00	2026-07-02 14:43:47.302039
290445b5-5052-4050-96a6-e523c3909053	Transport	#F97316	\N	5000.00	2026-07-02 14:43:47.302039
dbb82eeb-e018-434e-9000-b290e11bacd4	Office	#14B8A6	\N	3000.00	2026-07-02 14:43:47.302039
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expenses (id, title, description, category_id, vendor, amount, payment_method, expense_date, reference_no, receipt_url, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: held_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.held_orders (id, label, type, table_id, table_number, customer_name, items, item_count, subtotal, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_items (id, sku, name, description, category, supplier_id, quantity, unit, cost_per_unit, reorder_level, expiry_date, location, image_url, created_at, updated_at, is_active) FROM stdin;
60ee8cf8-135f-4a61-978f-ebce1563b49e	ING-0012	Salt	Iodized table salt	Spices	\N	10.00	Kg	50.00	5.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
100dc658-e8b6-4de3-b400-7e0d7b5dea6e	ING-0013	Coriander	Fresh coriander leaves	Vegetables	\N	1.00	Kg	300.00	1.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
76fd4e05-d768-46f5-99f5-36bdaf891991	ING-0014	Ginger	Fresh ginger root	Spices	\N	2.00	Kg	400.00	1.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
db87fe57-2e68-4c0a-9a61-9e2620c1c436	ING-0015	Garlic	Fresh garlic bulbs	Spices	\N	3.00	Kg	350.00	2.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
371e81f1-da10-4f8f-996c-5e7140453123	ING-0010	Coconut Milk	Canned coconut milk	Baking	\N	23.00	Pcs	120.00	10.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-03 15:55:40.633616	t
cd0db038-aeab-469b-87ee-18f4865f672f	ING-0009	Chicken	Fresh whole chicken	Meat	\N	22.75	Kg	450.00	5.00	\N	Cold Room	\N	2026-07-02 14:43:47.302039	2026-07-03 15:55:40.633616	t
332c9314-5799-4820-bfcc-2391def65cd3	ING-0007	Wheat Flour	All purpose flour	Baking	\N	2.76	Kg	150.00	10.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-03 20:11:18.153508	t
9154d4c5-c4e4-4924-88bf-6192e0469b22	ING-0008	Milk	Full cream milk	Dairy	\N	19.80	L	210.00	16.00	\N	Cold Room	\N	2026-07-02 14:43:47.302039	2026-07-04 18:37:48.316505	t
b651a451-886c-4f4e-a686-5ee3af9e3b85	ING-0011	Sugar	White granulated sugar	Baking	\N	24.96	Kg	130.00	10.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-04 18:37:48.316505	t
2696382a-a076-4667-8ccf-1a0ba8e35b4a		Rice		Grains	\N	69.50	Kg	150.00	0.00	2026-09-04	Main Store	\N	2026-07-04 00:25:03.33166	2026-07-05 00:46:27.291626	t
d3f3d99e-de7c-4791-b49a-9f9421b8a07b	ING-0006	Pilau Masala	Pilau spice mix	Spices	\N	7.80	Pcs	250.00	3.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-05 00:46:27.291626	t
ea1a9b04-d7cb-4f9d-882a-57fbfd4a4c52	ING-0001	Rice	Long grain basmati rice	Grains	\N	119.00	Kg	120.00	20.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-05 00:46:27.291626	t
1e410322-fbb0-488c-b1dd-d291d45f13ee	ING-0005	Tomatoes	Fresh tomatoes	Vegetables	\N	-0.24	Kg	180.00	5.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-05 00:49:50.010802	t
b9568ab9-6ee0-4181-ad88-67e0de374847	ING-0004	Onions	Fresh red onions	Vegetables	\N	21.67	Kg	120.00	5.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-05 00:49:50.010802	t
b96e9f20-06be-40e8-8482-b2c2aece18de	ING-0002	Beef	Fresh beef	Meat	\N	65.64	Kg	680.00	5.00	\N	Cold Room	\N	2026-07-02 14:43:47.302039	2026-07-05 00:49:50.010802	t
ee8fcedb-8139-49ee-a21b-acdc2d52df70	ING-0003	Cooking Oil	Pure vegetable oil	Oils	\N	4.78	L	450.00	10.00	\N	Main Store	\N	2026-07-02 14:43:47.302039	2026-07-05 00:49:50.010802	t
\.


--
-- Data for Name: inventory_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_transactions (id, inventory_item_id, type, quantity_change, quantity_before, quantity_after, notes, reference_id, performed_by, created_at) FROM stdin;
de530016-07ef-46cc-8bc1-f322910b9493	b96e9f20-06be-40e8-8482-b2c2aece18de	adjustment	34.00	18.00	52.00		\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 19:16:26.597687
06ec7306-7d89-4c85-ac78-0c8a874c82cf	b96e9f20-06be-40e8-8482-b2c2aece18de	adjustment	10.00	52.00	62.00		\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 19:16:45.185232
6de8d4e5-1219-4f13-8c8e-47b8932c92a9	cd0db038-aeab-469b-87ee-18f4865f672f	adjustment	11.00	12.00	23.00		\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 19:16:58.63484
aa50a8a6-17f4-488c-9622-024c82623569	332c9314-5799-4820-bfcc-2391def65cd3	sale	-0.12	3.00	2.88	Auto stock deduction for order	d97ba9f4-5af6-4859-a219-db18fb21ce0f	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 23:57:28.368858
cf9552c9-b5ed-4aac-80ad-68d495efd815	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.02	5.00	4.98	Auto stock deduction for order	d97ba9f4-5af6-4859-a219-db18fb21ce0f	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 23:57:28.368858
420a2486-7277-499a-bce8-066e6c8b479a	b9568ab9-6ee0-4181-ad88-67e0de374847	sale	-0.05	2.00	1.95	Auto stock deduction for order	96508ff5-37ed-450d-81f7-2f2750c7f857	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:08:31.688344
64e1236d-b5a4-402e-aa38-fde433a79390	b96e9f20-06be-40e8-8482-b2c2aece18de	sale	-0.15	62.00	61.85	Auto stock deduction for order	96508ff5-37ed-450d-81f7-2f2750c7f857	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:08:31.688344
e33a9dee-c36d-4668-a40f-9af1cbb8abf2	d3f3d99e-de7c-4791-b49a-9f9421b8a07b	sale	-0.05	8.00	7.95	Auto stock deduction for order	96508ff5-37ed-450d-81f7-2f2750c7f857	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:08:31.688344
0769759a-9284-4911-9c5d-6dbf3308d73f	ea1a9b04-d7cb-4f9d-882a-57fbfd4a4c52	sale	-0.25	120.00	119.75	Auto stock deduction for order	96508ff5-37ed-450d-81f7-2f2750c7f857	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:08:31.688344
77e57826-a06c-4774-8cef-789ee31f88cb	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.03	4.98	4.95	Auto stock deduction for order	96508ff5-37ed-450d-81f7-2f2750c7f857	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:08:31.688344
c61007dd-0eee-45a6-a890-fbe407e9c26a	b9568ab9-6ee0-4181-ad88-67e0de374847	sale	-0.05	1.95	1.90	Auto stock deduction for order	5aa4aefa-e001-4672-a7ae-8bbce894f2d6	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:09:25.130981
721fc6b0-e2d2-4540-b079-41c9e9887bae	b96e9f20-06be-40e8-8482-b2c2aece18de	sale	-0.15	61.85	61.70	Auto stock deduction for order	5aa4aefa-e001-4672-a7ae-8bbce894f2d6	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:09:25.130981
330e9cd0-b7b2-4988-aa7d-a7ad6749174e	d3f3d99e-de7c-4791-b49a-9f9421b8a07b	sale	-0.05	7.95	7.90	Auto stock deduction for order	5aa4aefa-e001-4672-a7ae-8bbce894f2d6	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:09:25.130981
e669e8ef-1704-49ac-8360-8101e2a5305b	ea1a9b04-d7cb-4f9d-882a-57fbfd4a4c52	sale	-0.25	119.75	119.50	Auto stock deduction for order	5aa4aefa-e001-4672-a7ae-8bbce894f2d6	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:09:25.130981
f616a275-8563-44d7-8678-3b70e94a1b7e	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.03	4.95	4.92	Auto stock deduction for order	5aa4aefa-e001-4672-a7ae-8bbce894f2d6	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:09:25.130981
4cd07748-70a1-4f5e-8ed2-23bd47f19c64	b9568ab9-6ee0-4181-ad88-67e0de374847	adjustment	20.00	1.90	21.90		\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:10:03.416345
77a28008-90b7-42fb-ac63-a76d3f03d97d	371e81f1-da10-4f8f-996c-5e7140453123	sale	-1.00	24.00	23.00	Auto stock deduction for order	715793fb-d0e6-4020-8223-c1d330468bfa	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:55:40.633616
68d39d19-3937-443c-af5f-90ffdd3159aa	b9568ab9-6ee0-4181-ad88-67e0de374847	sale	-0.05	21.90	21.85	Auto stock deduction for order	715793fb-d0e6-4020-8223-c1d330468bfa	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:55:40.633616
b4e8d928-1812-41ef-8664-a399b8eea566	cd0db038-aeab-469b-87ee-18f4865f672f	sale	-0.25	23.00	22.75	Auto stock deduction for order	715793fb-d0e6-4020-8223-c1d330468bfa	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:55:40.633616
c92af91a-c3ff-4ead-8a13-d80222743859	9154d4c5-c4e4-4924-88bf-6192e0469b22	sale	-0.10	0.00	-0.10	Auto stock deduction for order	0af16624-16fc-4115-8b0b-0763ee399d4f	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:07:31.812577
5ce2c98b-e259-4152-85fa-e16ad8d13a88	b651a451-886c-4f4e-a686-5ee3af9e3b85	sale	-0.02	25.00	24.98	Auto stock deduction for order	0af16624-16fc-4115-8b0b-0763ee399d4f	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:07:31.812577
6548e636-d02d-4459-9276-a87c65af4d2b	9154d4c5-c4e4-4924-88bf-6192e0469b22	adjustment	0.10	-0.10	0.00	Stock restored — order cancelled	0af16624-16fc-4115-8b0b-0763ee399d4f	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:08:20.757155
850489c9-e5a5-4f90-b90d-04bdd83af4ea	b651a451-886c-4f4e-a686-5ee3af9e3b85	adjustment	0.02	24.98	25.00	Stock restored — order cancelled	0af16624-16fc-4115-8b0b-0763ee399d4f	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:08:20.757155
856adde5-a027-491e-b54a-986a82e3f490	332c9314-5799-4820-bfcc-2391def65cd3	sale	-0.12	2.88	2.76	Auto stock deduction for order	19a91e9a-ffa2-4891-add2-8b3d52c105f6	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:11:18.153508
55d77930-0ece-4d3d-b1c5-7b8c6f8f445a	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.02	4.92	4.90	Auto stock deduction for order	19a91e9a-ffa2-4891-add2-8b3d52c105f6	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:11:18.153508
901b6039-2b19-4b19-bca5-b00c7c139bf8	2696382a-a076-4667-8ccf-1a0ba8e35b4a	sale	-0.25	70.00	69.75	Auto stock deduction for order	a1457757-c080-4df5-a901-9e1989242008	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:06:37.344601
0b4279a9-84c2-44c8-888b-0babc5946429	b96e9f20-06be-40e8-8482-b2c2aece18de	sale	-0.20	61.70	61.50	Auto stock deduction for order	a1457757-c080-4df5-a901-9e1989242008	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:06:37.344601
a0cc6392-74b4-4861-811b-42d4cbb279a9	d3f3d99e-de7c-4791-b49a-9f9421b8a07b	sale	-0.05	7.90	7.85	Auto stock deduction for order	a1457757-c080-4df5-a901-9e1989242008	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:06:37.344601
83ac8f7f-120d-4548-8ad1-8de67eb5e236	ea1a9b04-d7cb-4f9d-882a-57fbfd4a4c52	sale	-0.25	119.50	119.25	Auto stock deduction for order	a1457757-c080-4df5-a901-9e1989242008	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:06:37.344601
bd05811c-24ff-4158-8823-eb4dd9785713	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.03	4.90	4.87	Auto stock deduction for order	a1457757-c080-4df5-a901-9e1989242008	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:06:37.344601
bd0e4bc5-6114-4995-a70f-b71448676c87	9154d4c5-c4e4-4924-88bf-6192e0469b22	adjustment	20.00	0.00	20.00	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:09:56.031944
aff83fb7-2913-4a93-9fa2-0d48eefda49a	9154d4c5-c4e4-4924-88bf-6192e0469b22	sale	-0.10	20.00	19.90	Auto stock deduction for order	50d3b348-150b-48af-801f-f0dea7182862	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:08:32.378241
10f0db8b-3a12-4b57-92c1-0f64b0ca7364	b651a451-886c-4f4e-a686-5ee3af9e3b85	sale	-0.02	25.00	24.98	Auto stock deduction for order	50d3b348-150b-48af-801f-f0dea7182862	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:08:32.378241
bdbf3d8a-6f1d-4362-821d-4a74d984f519	1e410322-fbb0-488c-b1dd-d291d45f13ee	sale	-0.08	0.00	-0.08	Auto stock deduction for order	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:35:07.423109
6dcdd420-c3b1-4be6-9bb2-0a2627732689	b9568ab9-6ee0-4181-ad88-67e0de374847	sale	-0.06	21.85	21.79	Auto stock deduction for order	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:35:07.423109
ea3693f8-6e1b-4bc4-931a-882354eb2eb0	b96e9f20-06be-40e8-8482-b2c2aece18de	sale	-0.22	61.50	61.28	Auto stock deduction for order	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:35:07.423109
06e98ea7-43f6-4975-ab00-05298d363888	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.02	4.87	4.85	Auto stock deduction for order	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:35:07.423109
84f813e4-7371-4ed0-bff7-830dc4e059d0	9154d4c5-c4e4-4924-88bf-6192e0469b22	sale	-0.10	19.90	19.80	Auto stock deduction for order	1b5fd808-bb97-4588-9e43-44c2fddfe78a	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 18:37:48.316505
e09a069f-1e4e-42cd-ab3b-b66ab92463b7	b651a451-886c-4f4e-a686-5ee3af9e3b85	sale	-0.02	24.98	24.96	Auto stock deduction for order	1b5fd808-bb97-4588-9e43-44c2fddfe78a	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 18:37:48.316505
bcf991d5-9c6c-4366-a563-dedb3c954b35	b96e9f20-06be-40e8-8482-b2c2aece18de	adjustment	5.00	61.28	66.28	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 23:22:54.793671
875b47c0-dd2a-4ba2-9886-86c01a4793f3	1e410322-fbb0-488c-b1dd-d291d45f13ee	sale	-0.08	-0.08	-0.16	Auto stock deduction for order	cf7fe121-a307-4bf1-826b-441973773232	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:25:04.400156
75fd6ead-d0f6-4be1-86c7-de3d3fed7503	b9568ab9-6ee0-4181-ad88-67e0de374847	sale	-0.06	21.79	21.73	Auto stock deduction for order	cf7fe121-a307-4bf1-826b-441973773232	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:25:04.400156
26a51dfb-8274-478c-be52-1cf2f3124904	b96e9f20-06be-40e8-8482-b2c2aece18de	sale	-0.22	66.28	66.06	Auto stock deduction for order	cf7fe121-a307-4bf1-826b-441973773232	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:25:04.400156
2c9802b4-9e22-45d8-992d-952f6512ea3f	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.02	4.85	4.83	Auto stock deduction for order	cf7fe121-a307-4bf1-826b-441973773232	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:25:04.400156
de1ddcc9-9048-4aba-9a85-669f85c00bd3	2696382a-a076-4667-8ccf-1a0ba8e35b4a	sale	-0.25	69.75	69.50	Auto stock deduction for order	006fbed8-0658-4f63-8cb6-62e14af527b5	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:46:27.291626
6dbfc6c4-1e37-48b5-aa32-d5806488f0a3	b96e9f20-06be-40e8-8482-b2c2aece18de	sale	-0.20	66.06	65.86	Auto stock deduction for order	006fbed8-0658-4f63-8cb6-62e14af527b5	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:46:27.291626
c2ac12fb-bccd-43c3-9116-031c9028eb50	d3f3d99e-de7c-4791-b49a-9f9421b8a07b	sale	-0.05	7.85	7.80	Auto stock deduction for order	006fbed8-0658-4f63-8cb6-62e14af527b5	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:46:27.291626
56ed135f-5db2-4a4e-ab1f-89abce4968f0	ea1a9b04-d7cb-4f9d-882a-57fbfd4a4c52	sale	-0.25	119.25	119.00	Auto stock deduction for order	006fbed8-0658-4f63-8cb6-62e14af527b5	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:46:27.291626
f7a0eedf-c7e2-4a6f-bd84-683b3b724318	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.03	4.83	4.80	Auto stock deduction for order	006fbed8-0658-4f63-8cb6-62e14af527b5	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:46:27.291626
23722bb1-b251-45f8-96dd-3f0cfd8189fc	1e410322-fbb0-488c-b1dd-d291d45f13ee	sale	-0.08	-0.16	-0.24	Auto stock deduction for order	add3433d-f92f-4f82-bfb7-a6cfac42590c	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:49:50.010802
bbf82899-4549-40ba-add8-34395874e717	b9568ab9-6ee0-4181-ad88-67e0de374847	sale	-0.06	21.73	21.67	Auto stock deduction for order	add3433d-f92f-4f82-bfb7-a6cfac42590c	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:49:50.010802
fa7fc10c-99d1-467f-88fd-ce38e2a13a46	b96e9f20-06be-40e8-8482-b2c2aece18de	sale	-0.22	65.86	65.64	Auto stock deduction for order	add3433d-f92f-4f82-bfb7-a6cfac42590c	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:49:50.010802
d8883332-7164-4c51-8361-6f1859e8254c	ee8fcedb-8139-49ee-a21b-acdc2d52df70	sale	-0.02	4.80	4.78	Auto stock deduction for order	add3433d-f92f-4f82-bfb7-a6cfac42590c	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:49:50.010802
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_requests (id, user_id, start_date, end_date, reason, status, reviewed_by, reviewed_at, created_at) FROM stdin;
\.


--
-- Data for Name: loyalty_points; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_points (id, customer_id, total_points, available_points, redeemed_points, tier_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: loyalty_rewards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_rewards (id, name, description, points_cost, reward_type, reward_value, is_active, created_at) FROM stdin;
1ab4157d-8354-4545-a8a9-a0cadabd67d0	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-02 14:43:47.302039
0722eeaa-d695-466b-a544-b6d403420020	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-02 14:43:47.302039
4612075e-558e-4351-97cf-30e499842bfa	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-02 14:43:47.302039
7d497fb9-a452-4ef6-93e5-e4a7bfcfc286	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-02 14:43:47.302039
4473c3dc-b1c1-4c65-beda-5a4f491fdd63	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-02 23:53:52.253188
c5dc6814-c9c0-4341-8be2-6cdb399b4842	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-02 23:53:52.253188
8651dc60-6f43-40e1-bdf1-fcafeda1a9dd	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-02 23:53:52.253188
b80b83b4-0a73-4233-9b42-5a720243f08c	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-02 23:53:52.253188
cd35ece8-c6eb-4b0a-8c51-d7fa3fdea4a3	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-03 13:16:13.38806
da9d0414-8d6a-4cf8-bb35-16645e71abcb	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-03 13:16:13.38806
314ff10f-1d6d-434f-97a5-77c5f7cbd0dd	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-03 13:16:13.38806
345c4325-42f9-461a-9b57-96a4fd96d6fe	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-03 13:16:13.38806
7f0b47de-f326-424b-99e5-516469c5f2c1	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-03 15:26:48.076177
79187a38-2df9-48e7-b37c-cba573eda7ca	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-03 15:26:48.076177
3ad5b8d3-309b-4a1c-8d52-5dd72530166c	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-03 15:26:48.076177
ef3c8fd3-375c-4076-899c-fd81f829c897	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-03 15:26:48.076177
dd67317a-c34b-4534-8b73-eda45fb9eb0b	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-03 21:52:20.315208
5c29ad4b-2827-4e88-9d15-959b850daf4a	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-03 21:52:20.315208
300b208a-24b4-4585-afa1-7e909ff73aa6	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-03 21:52:20.315208
ba590e55-77b4-44df-9a8e-1ee0cfb59a67	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-03 21:52:20.315208
daa7ed9a-5e76-4980-a9e2-2205f115e45f	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-04 01:04:44.006484
7d252201-c9f8-4501-862d-38d28c4ee169	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-04 01:04:44.006484
b86bc0f3-e9ae-45ce-b37b-f9c3e10344f0	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-04 01:04:44.006484
f75ceb44-c73c-4c3a-b924-ced7bef35a32	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-04 01:04:44.006484
0d6a5a57-5913-4d18-9ce4-a6748ec72188	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-04 17:12:13.930652
ea291fb2-c39c-4703-9c4b-2b782ebcfb8f	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-04 17:12:13.930652
3c747915-5179-4cef-9e5f-2ced4bb2ab2d	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-04 17:12:13.930652
cd266fb8-f40a-4f51-b823-e464c1d68c1f	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-04 17:12:13.930652
2fdb4130-6739-4b2d-966a-d44afb2f140d	10% Discount Voucher	Get 10% off your next order	1000	discount_voucher	10.00	t	2026-07-04 23:39:07.509365
c6b59090-921e-4e6f-967d-2fe3a549f0d8	Free Soda	Enjoy a complimentary soda	300	free_item	120.00	t	2026-07-04 23:39:07.509365
2aa451cf-0750-4290-9b0b-bbf046fa4e71	Free Dessert	Choose any dessert on us	800	free_item	250.00	t	2026-07-04 23:39:07.509365
f69e295b-9b7e-41c9-80f5-5b3c90ceb8c2	KES 500 Voucher	Cash voucher worth KES 500	2000	cash_voucher	500.00	t	2026-07-04 23:39:07.509365
\.


--
-- Data for Name: loyalty_tiers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_tiers (id, name, min_points, discount_percentage, benefits, created_at) FROM stdin;
ec1bcf47-77cf-4a80-80fe-f42cc6648f61	Bronze	0	0.00	{"Welcome Reward","Member Offers"}	2026-07-02 14:43:47.302039
dbb04c98-edc8-48b8-85ee-f62fb3bfd560	Silver	500	5.00	{"5% Discount","Special Offers"}	2026-07-02 14:43:47.302039
72ebe92e-92d3-411e-a385-8a7eba36168c	Gold	1000	10.00	{"10% Discount","Birthday Reward"}	2026-07-02 14:43:47.302039
\.


--
-- Data for Name: loyalty_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_transactions (id, customer_id, type, points, description, reference_id, performed_by, created_at) FROM stdin;
\.


--
-- Data for Name: menu_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_categories (id, name, description, sort_order, is_active, created_at, updated_at) FROM stdin;
52f0ed72-18e6-413b-8fe0-2ff5da35f6eb	Main Dishes	Hearty main course dishes	1	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
b2c2ebd4-7428-43b4-a908-2bb282e65061	Swahili Specials	Authentic Swahili cuisine	2	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
eab3250d-1ed0-40b1-9902-05a96ccb01cc	Sides	Side dishes and accompaniments	3	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
895585e3-08e9-4146-9bfc-34e0c1f3e73d	Drinks	Beverages and refreshments	4	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
e52accbf-4c1c-474d-9421-4fe7bbd209a0	Desserts	Sweet treats and desserts	5	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
f88e11bf-7af9-4766-9885-92db3084e790	Breakfast	Morning meals	6	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
4a6724d8-d0b3-483d-a2e4-68ef0d58423b	Snacks	Light bites and snacks	7	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
\.


--
-- Data for Name: menu_item_modifiers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_item_modifiers (menu_item_id, modifier_id) FROM stdin;
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_items (id, category_id, name, description, price, cost, image_url, preparation_time, status, tags, is_featured, sort_order, created_at, updated_at, track_stock, stock_quantity, reorder_level) FROM stdin;
0e5a655a-55fc-4453-b90f-a1dd71d4ce1a	b2c2ebd4-7428-43b4-a908-2bb282e65061	Wali wa Nazi	Coconut rice cooked in fresh coconut milk.	200.00	80.00	\N	20	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	f	0	5
e1a09f46-fd55-435e-bf66-16f36698ef68	eab3250d-1ed0-40b1-9902-05a96ccb01cc	Sukuma Wiki	Sautéed kale with onions and tomatoes.	80.00	30.00	\N	10	available	{Vegan}	f	0	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	f	0	5
7d9574d3-377d-4920-bcc7-c15b6dfdb51e	eab3250d-1ed0-40b1-9902-05a96ccb01cc	Ugali	Classic Kenyan staple made from maize flour.	100.00	30.00	\N	10	available	{Vegan}	f	0	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	f	0	5
52e47e32-3bc6-4aee-bc4d-51c3d3d1dfdc	895585e3-08e9-4146-9bfc-34e0c1f3e73d	Tea	Kenyan chai with milk.	80.00	30.00	\N	5	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	f	0	5
d093132e-864b-4c8d-9987-6e6c775dbe9f	895585e3-08e9-4146-9bfc-34e0c1f3e73d	Water	Bottled mineral water.	60.00	25.00	\N	1	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	f	0	5
ead1cc95-3168-439f-96f8-74ed3090b82a	f88e11bf-7af9-4766-9885-92db3084e790	Uji	Traditional porridge, lightly sweetened.	150.00	50.00	\N	10	available	{Vegan}	f	0	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	f	0	5
3defb79a-c47b-4be8-ad16-670567c88fc8	4a6724d8-d0b3-483d-a2e4-68ef0d58423b	Soup	Hearty bone broth soup.	250.00	100.00	\N	15	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	f	0	5
bb1567db-c926-478f-8f74-4a2eaaf179d1	eab3250d-1ed0-40b1-9902-05a96ccb01cc	Kachumbari	Fresh tomato and onion salad with coriander.	100.00	40.00	\N	5	archived	{Vegan}	f	0	2026-07-02 14:43:47.302039	2026-07-02 17:39:26.871259	f	0	5
9c18e01d-3340-45cb-9be4-ff34931220a5	52f0ed72-18e6-413b-8fe0-2ff5da35f6eb	Beef Pilau	Generous pilau with extra beef portions.	500.00	230.00	/uploads/menu/1783084990990-71a7ab04-b755-4e9b-84a1-782b05e94028.jpg	30	available	{Popular}	f	0	2026-07-02 14:43:47.302039	2026-07-03 16:23:13.718631	f	0	5
e658c1cd-c769-4bf7-b39a-c7ed06e38834	52f0ed72-18e6-413b-8fe0-2ff5da35f6eb	Beef Stew	Slow-cooked tender beef in rich tomato gravy with vegetables.	550.00	250.00	/uploads/menu/1783085781233-4006e631-4271-402b-ae19-32686a6ebc90.jpg	25	available	{Popular}	f	0	2026-07-02 14:43:47.302039	2026-07-03 16:36:25.945827	f	0	5
6ff414f3-b725-433a-b5b1-8293ae763032	b2c2ebd4-7428-43b4-a908-2bb282e65061	Biryani	Fragrant basmati rice with spiced meat.	850.00	400.00	/uploads/menu/1783086484952-094604cb-6697-4f41-9ab7-8aa1b65f0901.jpg	40	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 16:48:10.906436	f	0	5
68234a48-6031-45b0-bb98-6d1319a2b189	eab3250d-1ed0-40b1-9902-05a96ccb01cc	Chapati	Soft layered flatbread, freshly made.	120.00	50.00	/uploads/menu/1783087048760-6887affe-5aa7-4f8b-bda0-39fa9b9c0a84.jpg	15	available	{Vegan}	f	0	2026-07-02 14:43:47.302039	2026-07-03 16:57:33.325364	f	0	5
745d1317-1498-4705-8e66-ee33fe03e684	b2c2ebd4-7428-43b4-a908-2bb282e65061	Samaki Wa Kupaka	Grilled fish in coconut sauce, a Swahili classic.	650.00	300.00	\N	35	archived	{Popular}	f	0	2026-07-02 14:43:47.302039	2026-07-03 18:02:27.421248	f	0	5
42cb323e-0a5b-47c8-a4db-5e40c94a8ad8	52f0ed72-18e6-413b-8fe0-2ff5da35f6eb	Chicken Curry	Kenyan-style chicken curry with coconut milk.	550.00	240.00	/uploads/menu/1783087912157-393ec1fe-7152-4887-9f3d-1b1e82b5c547.jpg	25	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 17:12:21.890774	f	0	5
ffce5873-1942-4dee-a691-d32b209ae67d	e52accbf-4c1c-474d-9421-4fe7bbd209a0	Coconut Pudding	Creamy coconut dessert with caramel.	250.00	100.00	/uploads/menu/1783088670635-bbf4235d-3826-48ab-a5eb-8be961a3c16e.jpg	10	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 17:24:34.280684	f	0	5
5e8b9db3-5bd1-4f66-bf62-90ca1b59f6d8	895585e3-08e9-4146-9bfc-34e0c1f3e73d	Coffee	Freshly brewed Kenyan coffee.	150.00	60.00	/uploads/menu/1783089316030-9f441fd9-e2e9-4f84-967b-87285dba0025.jpg	5	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 17:35:20.961051	f	0	5
632c3483-96f3-4ea8-a805-e399584a8082	895585e3-08e9-4146-9bfc-34e0c1f3e73d	Fresh Juice	Freshly squeezed fruit juice of the day.	200.00	80.00	/uploads/menu/1783089478651-61dd34cf-034e-43af-975f-a7c6c0c6a815.jpg	5	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 17:38:01.030547	f	0	5
979a57b2-2eef-4e7c-9eb3-a040b517c1e3	4a6724d8-d0b3-483d-a2e4-68ef0d58423b	Mahamri	Sweet coconut doughnuts.	100.00	40.00	/uploads/menu/1783089744021-f8b24644-d4c6-4f0b-ab1e-1250c0e7c779.webp	10	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 17:42:26.328961	f	0	5
6cdfdb8c-2dc6-46cf-aa45-f3db46e0fa14	4a6724d8-d0b3-483d-a2e4-68ef0d58423b	Mandazi	Sweet Swahili doughnuts, 3 pieces.	100.00	40.00	/uploads/menu/1783089849479-d67a4e15-2719-4b72-bd2c-9fc9c1faaebe.jpg	10	available	{Vegan}	f	0	2026-07-02 14:43:47.302039	2026-07-03 17:44:12.121563	f	0	5
aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	52f0ed72-18e6-413b-8fe0-2ff5da35f6eb	Pilau	Aromatic spiced rice cooked with tender beef, served with kachumbari.	900.00	450.00	/uploads/menu/1783090695313-dc817d75-255c-41a9-a09e-e0a57dd3dbb6.jpg	30	available	{Popular,"Best Seller"}	t	0	2026-07-02 14:43:47.302039	2026-07-03 17:58:17.064788	f	0	5
1fdf2d89-be34-4bb9-9c7e-c4b38af4aea6	895585e3-08e9-4146-9bfc-34e0c1f3e73d	Ukwaju	Assorted soft drinks.	50.00	20.00		2	available	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 18:03:57.626235	f	0	5
46ea648e-a535-47d0-ac30-312b6f7e83ff	895585e3-08e9-4146-9bfc-34e0c1f3e73d	Soda	Assorted soft drinks.	120.00	60.00	\N	2	available	{}	f	0	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208	f	0	5
dcf21dc3-d7a8-4c1f-9178-7d1714883010	f88e11bf-7af9-4766-9885-92db3084e790	capuccino		500.00	200.00	/uploads/menu/1783151953228-b637e2a4-d926-49ab-93c4-974bee8d1516.jpg	15	available	{}	f	0	2026-07-04 11:00:23.398129	2026-07-04 11:00:23.398129	f	0	5
1e7e674d-ee6f-4ac0-b21b-7aee4e95653b	4a6724d8-d0b3-483d-a2e4-68ef0d58423b	Samosa	Crispy pastry filled with spiced meat.	100.00	40.00	\N	5	archived	{}	f	0	2026-07-02 14:43:47.302039	2026-07-03 13:30:20.987077	f	0	5
\.


--
-- Data for Name: menu_modifier_options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_modifier_options (id, modifier_id, name, price_adjustment, created_at) FROM stdin;
\.


--
-- Data for Name: menu_modifiers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_modifiers (id, name, type, is_required, created_at) FROM stdin;
\.


--
-- Data for Name: menu_stock_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_stock_transactions (id, menu_item_id, type, quantity_change, quantity_before, quantity_after, notes, reference_id, performed_by, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, message, type, is_read, reference_type, reference_id, created_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, total_price, modifiers, special_instructions, status, created_at) FROM stdin;
c344361d-b098-41a7-a561-1518033fe2af	b9f36626-0e82-4394-a23f-5b8a2e74ec7b	6ff414f3-b725-433a-b5b1-8293ae763032	Biryani	1	850.00	850.00	null	\N	pending	2026-07-02 14:48:27.558811
2cc8baeb-e695-4d42-9951-1f61c47167b3	ec0ca9fa-bc45-4bb4-93b2-22f19c89b8b5	6ff414f3-b725-433a-b5b1-8293ae763032	Biryani	1	850.00	850.00	null	\N	pending	2026-07-02 14:48:38.245111
41e1238e-d103-4798-b9ea-91842ab5cd53	94b76d96-6dd8-4f78-9493-3ee0ab40421c	6ff414f3-b725-433a-b5b1-8293ae763032	Biryani	1	850.00	850.00	null	\N	pending	2026-07-02 14:49:04.22223
ddb08438-37b0-4492-bdde-d175b8ee7ed3	7f303ed9-0c22-4aa3-958a-b486d8ceb23e	6ff414f3-b725-433a-b5b1-8293ae763032	Biryani	1	850.00	850.00	null	\N	pending	2026-07-02 15:54:08.773421
a7f807d1-f2e2-476e-8ccb-d98fa5e907f4	b7c4473f-7c13-45af-a3e1-b9b8050ccf64	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-02 15:54:52.185886
91d463a0-8bc2-47c4-8557-06d823818997	ba2e92ee-ddc6-43a7-8eb4-8357e3b992a5	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-02 15:58:45.607834
1917b86a-1fe4-483b-b53c-e98f63e9f073	b5da791a-212b-40d3-a068-406f6370c4b3	9c18e01d-3340-45cb-9be4-ff34931220a5	Beef Pilau	1	500.00	500.00	null	\N	pending	2026-07-02 17:06:05.163779
069fddf7-d0d3-4942-849c-b07080109382	009bad84-42d1-4b73-a1ad-de243b1a6f47	9c18e01d-3340-45cb-9be4-ff34931220a5	Beef Pilau	1	500.00	500.00	null	\N	pending	2026-07-02 17:12:46.521366
1ae9a61c-21c6-4cb2-96a2-3c39ed6f958a	79e384f3-e876-48e3-9acd-240d9b8b20e4	9c18e01d-3340-45cb-9be4-ff34931220a5	Beef Pilau	1	500.00	500.00	null	\N	pending	2026-07-02 17:13:23.039257
bf430fe9-fd05-4fbb-828a-1e3f0951f34e	2e6f2a29-e288-4e61-90ec-2e502c9aafdf	979a57b2-2eef-4e7c-9eb3-a040b517c1e3	Mahamri	1	100.00	100.00	null	\N	pending	2026-07-02 17:14:44.038861
f8c0b725-b1a6-4b95-8a60-561110396609	3946d83d-5a27-433c-bee5-3fb78bdd64f9	68234a48-6031-45b0-bb98-6d1319a2b189	Chapati	1	120.00	120.00	null	\N	pending	2026-07-02 17:35:19.554966
0ee5df5c-e866-4939-a0de-2fd1f09818ec	c4a3baa5-d124-4d9d-a021-e56c1515f7d2	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-02 19:09:58.277986
10c6d594-e177-4865-8c75-cf56777ed466	63b64562-9fec-4534-8f47-bde31e447c34	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-02 19:18:44.009389
70c39450-878a-4c11-8fc2-7cd3e9d91199	bbdc2b45-3630-444f-bb89-7f16fd493e17	9c18e01d-3340-45cb-9be4-ff34931220a5	Beef Pilau	1	500.00	500.00	null	\N	pending	2026-07-02 23:56:35.401756
32ceba6a-2093-446a-872e-01466b8d65fa	96508ff5-37ed-450d-81f7-2f2750c7f857	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	Pilau	1	900.00	900.00	null	\N	pending	2026-07-03 00:08:31.688344
898d2518-bbea-4ca0-bbcb-d41e977b69e1	5aa4aefa-e001-4672-a7ae-8bbce894f2d6	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	Pilau	1	900.00	900.00	null	\N	pending	2026-07-03 00:09:25.130981
09ef620d-f7c8-47b6-92d4-923c6b468a5c	d97ba9f4-5af6-4859-a219-db18fb21ce0f	68234a48-6031-45b0-bb98-6d1319a2b189	Chapati	1	120.00	120.00	null	\N	pending	2026-07-02 23:57:28.368858
31a87294-315b-4285-9404-ba91c24c1477	a712b4b4-c189-4482-aff9-28078122647e	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-03 15:49:34.679191
1de177b8-c749-43df-af8e-ff8297740330	a712b4b4-c189-4482-aff9-28078122647e	68234a48-6031-45b0-bb98-6d1319a2b189	Chapati	1	120.00	120.00	null	\N	pending	2026-07-03 15:49:34.679191
e4a80ad4-43e9-4099-814f-2ba64c5d3148	b7437a3a-bbcc-45d6-98d2-3b55f55f634d	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-03 15:50:47.175484
b0b86035-52f5-4483-86ca-25d3f1995753	b7437a3a-bbcc-45d6-98d2-3b55f55f634d	68234a48-6031-45b0-bb98-6d1319a2b189	Chapati	1	120.00	120.00	null	\N	pending	2026-07-03 15:50:47.175484
01e0983a-6c27-469a-9c97-372e656ef1cf	715793fb-d0e6-4020-8223-c1d330468bfa	42cb323e-0a5b-47c8-a4db-5e40c94a8ad8	Chicken Curry	1	550.00	550.00	null	\N	pending	2026-07-03 15:55:40.633616
fb55237b-7bcc-412e-a76d-7a4dfab37dc3	e9e7ef84-a7fd-4cb0-899a-b30eaaaddae6	632c3483-96f3-4ea8-a805-e399584a8082	Fresh Juice	1	200.00	200.00	null	\N	pending	2026-07-03 19:09:58.647764
28e281fb-26a2-49e7-85eb-08acfc1e3a0c	4374dddf-47d8-4fad-af39-3484ddd07fd5	ffce5873-1942-4dee-a691-d32b209ae67d	Coconut Pudding	1	250.00	250.00	null	\N	pending	2026-07-03 19:11:14.543128
175e1fc9-16c5-4fa2-9bc7-61a71b3d2cfd	0af16624-16fc-4115-8b0b-0763ee399d4f	5e8b9db3-5bd1-4f66-bf62-90ca1b59f6d8	Coffee	1	150.00	150.00	null	\N	pending	2026-07-03 20:07:31.812577
6e722cf9-e4a5-46cf-a4c3-589ec7cb4b12	19a91e9a-ffa2-4891-add2-8b3d52c105f6	68234a48-6031-45b0-bb98-6d1319a2b189	Chapati	1	120.00	120.00	null	\N	pending	2026-07-03 20:11:18.153508
04028048-c0c2-4a94-aa73-0161b44effb8	d78df697-b610-4c02-84ad-0166b1f1e562	632c3483-96f3-4ea8-a805-e399584a8082	Fresh Juice	1	200.00	200.00	null	\N	pending	2026-07-03 20:19:53.99757
71c50bed-101e-444e-a403-26acef5c9496	224ab328-14d8-4c5b-a653-7b1b6db6ddf7	632c3483-96f3-4ea8-a805-e399584a8082	Fresh Juice	1	200.00	200.00	null	\N	pending	2026-07-03 21:09:07.471603
51143e82-8a2c-4d2e-af3a-ab33f3f135a8	15fb39ac-a02d-4b08-8fc0-a6af5cf91dd9	632c3483-96f3-4ea8-a805-e399584a8082	Fresh Juice	1	200.00	200.00	null	\N	pending	2026-07-03 21:11:48.944828
3d2ce794-e24e-44f2-bb09-9720ab9be58a	a1457757-c080-4df5-a901-9e1989242008	9c18e01d-3340-45cb-9be4-ff34931220a5	Beef Pilau	1	500.00	500.00	null	\N	pending	2026-07-04 01:06:37.344601
c245eaf3-64e6-4e3b-a44a-1214ebc1734e	537b2a10-89c8-48a8-8aae-9bec16153510	68234a48-6031-45b0-bb98-6d1319a2b189	Chapati	1	120.00	120.00	null	\N	pending	2026-07-04 01:13:43.531946
9029cfae-0dd3-4377-b47c-cb33f51582e1	3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	dcf21dc3-d7a8-4c1f-9178-7d1714883010	capuccino	1	500.00	500.00	null	\N	pending	2026-07-04 11:01:34.896377
4cea1964-d598-4837-8bde-b50c649a4a03	50d3b348-150b-48af-801f-f0dea7182862	5e8b9db3-5bd1-4f66-bf62-90ca1b59f6d8	Coffee	1	150.00	150.00	null	\N	pending	2026-07-04 11:08:09.808803
94fee152-8179-4647-ba6d-532f45f712eb	2fbf3dfb-63c5-49d8-8912-98fd79238ac8	6ff414f3-b725-433a-b5b1-8293ae763032	Biryani	1	850.00	850.00	null	\N	pending	2026-07-04 11:31:48.419934
d60d6ccb-2d81-4311-ab6f-3a1d747da091	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-04 17:34:25.624756
5c78637b-d59d-49e3-a045-1ac5aeec5680	1b5fd808-bb97-4588-9e43-44c2fddfe78a	5e8b9db3-5bd1-4f66-bf62-90ca1b59f6d8	Coffee	1	150.00	150.00	null	\N	pending	2026-07-04 18:37:48.316505
cec00dcd-f90f-4cc8-905b-6c19f29781e2	2370f3a0-92a1-4710-8aad-2a039c168f77	6ff414f3-b725-433a-b5b1-8293ae763032	Biryani	1	850.00	850.00	null	\N	pending	2026-07-05 00:11:53.699419
a65c74a1-ff5a-4228-a27f-36ee3759cada	cf7fe121-a307-4bf1-826b-441973773232	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-05 00:25:04.400156
ae7e474a-d629-49e0-90ec-7ce242b7159d	e792cea6-ec53-40c4-9c5f-ef0b904f2508	ffce5873-1942-4dee-a691-d32b209ae67d	Coconut Pudding	1	250.00	250.00	null	\N	pending	2026-07-05 00:28:01.920253
8aa2cd16-71ca-434b-9cfa-3a00fe072781	006fbed8-0658-4f63-8cb6-62e14af527b5	9c18e01d-3340-45cb-9be4-ff34931220a5	Beef Pilau	1	500.00	500.00	null	\N	pending	2026-07-05 00:46:27.291626
3ed8459f-086c-49e1-bdf2-69169b0e65ec	add3433d-f92f-4f82-bfb7-a6cfac42590c	e658c1cd-c769-4bf7-b39a-c7ed06e38834	Beef Stew	1	550.00	550.00	null	\N	pending	2026-07-05 00:49:50.010802
f3d4d00d-89d3-4a42-b515-a28b7f187134	f8fe6381-4148-4f2a-814a-31c6f4ca34f5	6cdfdb8c-2dc6-46cf-aa45-f3db46e0fa14	Mandazi	1	100.00	100.00	null	\N	pending	2026-07-05 01:07:36.630584
760889c5-e4d7-4cb2-9168-de9a12b1eb87	f8fe6381-4148-4f2a-814a-31c6f4ca34f5	632c3483-96f3-4ea8-a805-e399584a8082	Fresh Juice	1	200.00	200.00	null	\N	pending	2026-07-05 01:07:36.630584
36cac159-6d7e-47c9-882d-51095541a92f	57f365eb-98da-435d-94c8-666299a7f74e	ffce5873-1942-4dee-a691-d32b209ae67d	Coconut Pudding	1	250.00	250.00	null	\N	pending	2026-07-05 01:08:23.765739
8d0a034f-e033-48c9-929c-7afb1b0d912d	7c8f8837-ff38-4904-96ea-ad347e01dcb0	dcf21dc3-d7a8-4c1f-9178-7d1714883010	capuccino	1	500.00	500.00	null	\N	pending	2026-07-05 01:08:53.594403
73378ca0-ef14-4e87-b031-7f8cb581565d	b42ce243-d356-43cc-91a0-fe144f8741fb	632c3483-96f3-4ea8-a805-e399584a8082	Fresh Juice	1	200.00	200.00	null	\N	pending	2026-07-05 01:09:48.122038
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, order_number, type, status, table_id, customer_id, customer_name, guests, subtotal, discount, service_charge, tax, total, amount_paid, special_instructions, served_by, created_at, updated_at, completed_at, inventory_deducted) FROM stdin;
b9f36626-0e82-4394-a23f-5b8a2e74ec7b	ORD-907559769	dine_in	awaiting_payment	\N	\N	Walk-in Customer	1	850.00	0.00	42.50	136.00	1028.50	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 14:48:27.558811	2026-07-02 14:48:27.558811	\N	f
5aa4aefa-e001-4672-a7ae-8bbce894f2d6	ORD-565131628	dine_in	completed	\N	\N	Walk-in Customer	1	900.00	0.00	45.00	144.00	1089.00	1089.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:09:25.130981	2026-07-03 00:25:31.288252	2026-07-03 00:25:31.288252	t
2370f3a0-92a1-4710-8aad-2a039c168f77	ORD-513700648	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	850.00	0.00	0.00	0.00	850.00	850.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:11:53.699419	2026-07-05 00:14:59.716896	2026-07-05 00:14:59.716896	t
96508ff5-37ed-450d-81f7-2f2750c7f857	ORD-511688318	dine_in	completed	\N	\N	Walk-in Customer	1	900.00	0.00	45.00	144.00	1089.00	1089.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:08:31.688344	2026-07-03 00:28:34.54696	2026-07-03 00:28:34.54696	t
94b76d96-6dd8-4f78-9493-3ee0ab40421c	ORD-944222205	dine_in	completed	\N	\N	Walk-in Customer	1	850.00	0.00	42.50	136.00	1028.50	1028.50	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 14:49:04.22223	2026-07-02 14:49:41.057333	2026-07-02 14:49:41.057333	f
ec0ca9fa-bc45-4bb4-93b2-22f19c89b8b5	ORD-918245307	dine_in	completed	\N	\N	Walk-in Customer	1	850.00	0.00	42.50	136.00	1028.50	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 14:48:38.245111	2026-07-02 14:49:46.167265	2026-07-02 14:49:46.167265	f
cf7fe121-a307-4bf1-826b-441973773232	ORD-304400127	dine_in	completed	bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	\N	Walk-in Customer	1	550.00	0.00	0.00	0.00	550.00	550.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:25:04.400156	2026-07-05 00:26:41.936171	2026-07-05 00:26:41.936171	t
715793fb-d0e6-4020-8223-c1d330468bfa	ORD-340634827	dine_in	completed	c372d641-9800-4347-8e08-1637b708dff9	\N	Walk-in Customer	1	550.00	0.00	27.50	88.00	665.50	665.50	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:55:40.633616	2026-07-03 15:56:14.844322	2026-07-03 15:56:14.844322	t
b7c4473f-7c13-45af-a3e1-b9b8050ccf64	ORD-892186872	dine_in	awaiting_payment	\N	\N	Walk-in Customer	1	550.00	0.00	27.50	88.00	665.50	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 15:54:52.185886	2026-07-02 15:54:52.185886	\N	f
b7437a3a-bbcc-45d6-98d2-3b55f55f634d	ORD-047176228	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	670.00	0.00	33.50	107.20	810.70	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:50:47.175484	2026-07-03 15:53:45.036223	2026-07-03 15:53:45.036223	f
e792cea6-ec53-40c4-9c5f-ef0b904f2508	ORD-481922397	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	250.00	0.00	0.00	0.00	250.00	250.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:28:01.920253	2026-07-05 00:28:33.648247	2026-07-05 00:28:33.648247	t
a712b4b4-c189-4482-aff9-28078122647e	ORD-974683453	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	670.00	0.00	33.50	107.20	810.70	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:49:34.679191	2026-07-03 15:53:58.719365	2026-07-03 15:53:58.719365	f
006fbed8-0658-4f63-8cb6-62e14af527b5	ORD-587293528	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	500.00	0.00	0.00	0.00	500.00	500.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:46:27.291626	2026-07-05 00:47:35.904863	2026-07-05 00:47:35.904863	t
e9e7ef84-a7fd-4cb0-899a-b30eaaaddae6	ORD-998650833	dine_in	completed	bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	\N	Walk-in Customer	1	200.00	0.00	10.00	32.00	242.00	242.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 19:09:58.647764	2026-07-03 20:09:23.535237	2026-07-03 20:09:23.535237	t
add3433d-f92f-4f82-bfb7-a6cfac42590c	ORD-790013945	dine_in	completed	77898dc7-97e9-4dd8-82b3-f32e364f28eb	\N	Walk-in Customer	1	550.00	0.00	0.00	0.00	550.00	550.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:49:50.010802	2026-07-05 00:55:23.24223	2026-07-05 00:55:23.24223	t
3946d83d-5a27-433c-bee5-3fb78bdd64f9	ORD-919555985	dine_in	completed	\N	\N	Walk-in Customer	1	120.00	0.00	6.00	19.20	145.20	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:35:19.554966	2026-07-02 17:38:47.664624	2026-07-02 17:38:47.664624	f
0af16624-16fc-4115-8b0b-0763ee399d4f	ORD-451814902	dine_in	cancelled	8225b44e-014f-46e2-851c-4dd5d0058b83	\N	Walk-in Customer	1	150.00	0.00	7.50	24.00	181.50	100.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:07:31.812577	2026-07-03 20:08:20.757155	\N	f
4374dddf-47d8-4fad-af39-3484ddd07fd5	ORD-074545225	dine_in	completed	83c202a9-3069-444d-bd7d-fd75ae086d5b	\N	Walk-in Customer	1	250.00	0.00	12.50	40.00	302.50	302.50	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 19:11:14.543128	2026-07-03 20:09:20.21819	2026-07-03 20:09:20.21819	t
f8fe6381-4148-4f2a-814a-31c6f4ca34f5	ORD-856631110	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	300.00	0.00	0.00	0.00	300.00	300.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:07:36.630584	2026-07-05 01:10:57.62557	2026-07-05 01:10:57.62557	t
19a91e9a-ffa2-4891-add2-8b3d52c105f6	ORD-678153912	dine_in	completed	bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	\N	Walk-in Customer	1	120.00	0.00	6.00	19.20	145.20	145.20	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:11:18.153508	2026-07-03 20:24:03.927854	2026-07-03 20:24:03.927854	t
d78df697-b610-4c02-84ad-0166b1f1e562	ORD-194000900	dine_in	completed	16c236c0-2d1c-4a0a-b44f-06b54f82584a	\N	Walk-in Customer	1	200.00	0.00	10.00	32.00	242.00	242.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:19:53.99757	2026-07-03 20:24:15.036553	2026-07-03 20:24:15.036553	t
b5da791a-212b-40d3-a068-406f6370c4b3	ORD-165161719	dine_in	completed	\N	\N	Walk-in Customer	1	500.00	0.00	25.00	80.00	605.00	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:06:05.163779	2026-07-02 23:59:03.302621	2026-07-02 23:59:03.302621	f
224ab328-14d8-4c5b-a653-7b1b6db6ddf7	ORD-147474973	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	200.00	0.00	0.00	0.00	200.00	200.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 21:09:07.471603	2026-07-03 21:11:10.225744	2026-07-03 21:11:10.225744	t
ba2e92ee-ddc6-43a7-8eb4-8357e3b992a5	ORD-125608122	dine_in	completed	\N	\N	Walk-in Customer	1	550.00	0.00	27.50	88.00	665.50	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 15:58:45.607834	2026-07-02 23:59:04.667663	2026-07-02 23:59:04.667663	f
7f303ed9-0c22-4aa3-958a-b486d8ceb23e	ORD-848774680	dine_in	completed	\N	\N	Walk-in Customer	1	850.00	0.00	42.50	136.00	1028.50	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 15:54:08.773421	2026-07-02 23:59:05.751415	2026-07-02 23:59:05.751415	f
d97ba9f4-5af6-4859-a219-db18fb21ce0f	ORD-848369768	dine_in	completed	\N	\N	Walk-in Customer	1	120.00	0.00	6.00	19.20	145.20	145.20	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 23:57:28.368858	2026-07-02 23:58:35.933193	2026-07-02 23:58:35.933193	t
bbdc2b45-3630-444f-bb89-7f16fd493e17	ORD-795403218	dine_in	completed	\N	\N	Walk-in Customer	1	500.00	0.00	25.00	80.00	605.00	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 23:56:35.401756	2026-07-02 23:58:57.493109	2026-07-02 23:58:57.493109	f
63b64562-9fec-4534-8f47-bde31e447c34	ORD-124010916	dine_in	completed	\N	\N	Walk-in Customer	1	550.00	0.00	27.50	88.00	665.50	665.50	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 19:18:44.009389	2026-07-02 23:58:58.784403	2026-07-02 23:58:58.784403	f
c4a3baa5-d124-4d9d-a021-e56c1515f7d2	ORD-598290564	dine_in	completed	\N	\N	Walk-in Customer	1	550.00	0.00	27.50	88.00	665.50	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 19:09:58.277986	2026-07-02 23:58:59.534681	2026-07-02 23:58:59.534681	f
2e6f2a29-e288-4e61-90ec-2e502c9aafdf	ORD-684039118	dine_in	completed	\N	\N	Walk-in Customer	1	100.00	0.00	5.00	16.00	121.00	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:14:44.038861	2026-07-02 23:59:00.220762	2026-07-02 23:59:00.220762	f
79e384f3-e876-48e3-9acd-240d9b8b20e4	ORD-603040855	dine_in	completed	\N	\N	Walk-in Customer	1	500.00	0.00	25.00	80.00	605.00	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:13:23.039257	2026-07-02 23:59:00.817974	2026-07-02 23:59:00.817974	f
009bad84-42d1-4b73-a1ad-de243b1a6f47	ORD-566521300	dine_in	completed	\N	\N	Walk-in Customer	1	500.00	0.00	25.00	80.00	605.00	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:12:46.521366	2026-07-02 23:59:01.384045	2026-07-02 23:59:01.384045	f
15fb39ac-a02d-4b08-8fc0-a6af5cf91dd9	ORD-308947724	dine_in	completed	bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	\N	Walk-in Customer	1	200.00	0.00	0.00	0.00	200.00	200.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 21:11:48.944828	2026-07-03 21:57:00.30925	2026-07-03 21:57:00.30925	t
a1457757-c080-4df5-a901-9e1989242008	ORD-397345482	dine_in	completed	c372d641-9800-4347-8e08-1637b708dff9	\N	Walk-in Customer	1	500.00	0.00	0.00	0.00	500.00	500.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:06:37.344601	2026-07-04 01:07:41.081554	2026-07-04 01:07:41.081554	t
537b2a10-89c8-48a8-8aae-9bec16153510	ORD-823533832	takeaway	cancelled	\N	\N	Walk-in Customer	1	120.00	0.00	0.00	0.00	120.00	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:13:43.531946	2026-07-04 01:14:22.946285	\N	f
50d3b348-150b-48af-801f-f0dea7182862	ORD-489809541	dine_in	completed	bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	\N	Walk-in Customer	1	150.00	0.00	0.00	0.00	150.00	150.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:08:09.808803	2026-07-04 11:09:26.526737	2026-07-04 11:09:26.526737	t
2fbf3dfb-63c5-49d8-8912-98fd79238ac8	ORD-908423536	dine_in	completed	bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	\N	Walk-in Customer	1	850.00	0.00	0.00	0.00	850.00	850.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:31:48.419934	2026-07-04 11:39:52.248811	2026-07-04 11:39:52.248811	t
3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	ORD-094908973	dine_in	cancelled	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	500.00	0.00	0.00	0.00	500.00	0.00	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:01:34.896377	2026-07-04 11:40:33.661559	\N	t
7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	ORD-665627499	dine_in	completed	c372d641-9800-4347-8e08-1637b708dff9	\N	Walk-in Customer	1	550.00	0.00	0.00	0.00	550.00	550.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:34:25.624756	2026-07-04 18:37:07.581809	2026-07-04 18:37:07.581809	t
1b5fd808-bb97-4588-9e43-44c2fddfe78a	ORD-468318445	dine_in	completed	990f633e-54d4-4814-b3aa-016f65bc8664	\N	Walk-in Customer	1	150.00	0.00	0.00	0.00	150.00	150.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 18:37:48.316505	2026-07-04 18:39:07.123993	2026-07-04 18:39:07.123993	t
57f365eb-98da-435d-94c8-666299a7f74e	ORD-903767286	takeaway	completed	\N	\N	Walk-in Customer	1	250.00	0.00	0.00	0.00	250.00	250.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:08:23.765739	2026-07-05 01:08:23.803351	2026-07-05 01:08:23.803351	t
7c8f8837-ff38-4904-96ea-ad347e01dcb0	ORD-933594805	delivery	completed	\N	\N	Walk-in Customer	1	500.00	0.00	0.00	0.00	500.00	500.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:08:53.594403	2026-07-05 01:08:53.608827	2026-07-05 01:08:53.608827	t
b42ce243-d356-43cc-91a0-fe144f8741fb	ORD-988122991	takeaway	completed	\N	\N	Walk-in Customer	1	200.00	0.00	0.00	0.00	200.00	200.00	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:09:48.122038	2026-07-05 01:09:48.145083	2026-07-05 01:09:48.145083	t
\.


--
-- Data for Name: password_resets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_resets (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, order_id, payment_method, amount, status, reference, mpesa_transaction_id, mpesa_phone, mpesa_merchant_request_id, result_code, result_desc, split_details, expires_at, processed_by, created_at, updated_at) FROM stdin;
d37a567f-8bc5-400b-a7ef-b595eafc7dc7	94b76d96-6dd8-4f78-9493-3ee0ab40421c	cash	1028.50	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 14:49:04.241928	2026-07-02 14:49:04.241928
1f2e6d26-6dc4-4427-8e28-7882c50aeefc	b5da791a-212b-40d3-a068-406f6370c4b3	mpesa	605.00	failed	ws_CO_02072026170606834741616119	\N	254741616119	c204-42ba-87a1-1270fb8842b318868	4999	The transaction is still under processing	\N	2026-07-02 17:08:06.424831	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:06:06.424831	2026-07-02 17:06:14.522091
a2e9445a-1a76-475e-b42e-2df3cf19dd91	009bad84-42d1-4b73-a1ad-de243b1a6f47	mpesa	605.00	expired	ws_CO_02072026171247815741616119	\N	254741616119	66c4-4a36-a597-a5de0acd06e55302	1037	DS timeout user cannot be reached.	\N	2026-07-02 17:14:47.419272	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:12:47.419272	2026-07-02 17:12:50.995663
e92d4e70-0ba2-49d1-b2f7-a6059242c270	79e384f3-e876-48e3-9acd-240d9b8b20e4	mpesa	605.00	failed	ws_CO_02072026171324253741616119	\N	254741616119	66c4-4a36-a597-a5de0acd06e55329	4999	The transaction is still under processing	\N	2026-07-02 17:15:23.808438	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:13:23.808438	2026-07-02 17:13:28.097895
35d47d30-800d-4460-a223-38ebc72a0b7c	2e6f2a29-e288-4e61-90ec-2e502c9aafdf	mpesa	121.00	failed	ws_CO_02072026171445215741616119	\N	254741616119	39c1-4448-b5d4-46553e20eda893049	4999	The transaction is still under processing	\N	2026-07-02 17:16:44.773422	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:14:44.773422	2026-07-02 17:14:48.41045
a73520c6-65a3-4167-a7c6-05f080051573	3946d83d-5a27-433c-bee5-3fb78bdd64f9	mpesa	146.00	cancelled	ws_CO_02072026173521090741616119	\N	254741616119	c204-42ba-87a1-1270fb8842b319456	1032	Request Cancelled by user.	\N	2026-07-02 17:37:20.862155	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 17:35:20.862155	2026-07-02 17:35:45.372284
938feb96-6a8c-459a-8bd5-1ad0ebc45285	c4a3baa5-d124-4d9d-a021-e56c1515f7d2	mpesa	666.00	cancelled	ws_CO_02072026191000066741616119	\N	254741616119	c204-42ba-87a1-1270fb8842b321058	\N	Cancelled by cashier before completion	\N	2026-07-02 19:11:59.485618	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 19:09:59.485618	2026-07-02 19:11:22.164972
61474b9b-62bb-45f6-be11-eca719c70e2b	63b64562-9fec-4534-8f47-bde31e447c34	cash	665.50	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 19:18:44.028936	2026-07-02 19:18:44.028936
ef1b9ea2-3d7a-46b1-bb45-4f1a78d58346	bbdc2b45-3630-444f-bb89-7f16fd493e17	mpesa	605.00	cancelled	ws_CO_02072026235636307741616119	\N	254741616119	39c1-4448-b5d4-46553e20eda8120174	1032	Request Cancelled by user.	\N	2026-07-02 23:58:37.172154	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 23:56:37.172154	2026-07-02 23:57:00.492974
0c039e98-62c4-495d-9db4-0f377c067101	d97ba9f4-5af6-4859-a219-db18fb21ce0f	cash	145.20	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-02 23:57:28.403045	2026-07-02 23:57:28.403045
e070c3cd-414c-463b-974b-17ee786fd26e	96508ff5-37ed-450d-81f7-2f2750c7f857	cash	1089.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:08:31.741158	2026-07-03 00:08:31.741158
20119ca6-986d-4d35-b8e1-3def1f66c748	5aa4aefa-e001-4672-a7ae-8bbce894f2d6	cash	1089.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:09:25.188187	2026-07-03 00:09:25.188187
430ab39c-1da7-473f-8607-114e82056c9c	a712b4b4-c189-4482-aff9-28078122647e	mpesa	811.00	failed	ws_CO_03072026154935352741616119	\N	254741616119	5e2e-400c-aa5c-216294f9bc7e38988	4999	The transaction is still under processing	\N	2026-07-03 15:51:36.097306	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:49:36.097306	2026-07-03 15:49:39.881853
5e5d3baa-4709-4a23-9f42-2faa52f1577c	b7437a3a-bbcc-45d6-98d2-3b55f55f634d	mpesa	811.00	cancelled	ws_CO_03072026155047430741616119	\N	254741616119	5e2e-400c-aa5c-216294f9bc7e39080	1032	Request Cancelled by user.	\N	2026-07-03 15:52:48.130676	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:50:48.130676	2026-07-03 15:51:07.381402
01ffb5fa-b2ff-42e3-b643-0a03f332f780	715793fb-d0e6-4020-8223-c1d330468bfa	cash	665.50	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 15:55:40.668065	2026-07-03 15:55:40.668065
a885ca69-fbec-4d37-aae3-33ce1bb94b4d	e9e7ef84-a7fd-4cb0-899a-b30eaaaddae6	cash	242.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 19:09:58.699014	2026-07-03 19:09:58.699014
7edf27ad-8d5d-4420-b939-646e082e9fbd	4374dddf-47d8-4fad-af39-3484ddd07fd5	cash	200.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 19:11:14.576631	2026-07-03 19:11:14.576631
2a99f988-babe-45d0-ab80-9f0555220825	4374dddf-47d8-4fad-af39-3484ddd07fd5	mpesa	103.00	failed	ws_CO_03072026191140834741616119	\N	254741616119	934e-485f-93a1-766dc71b6c9a2615	4999	The transaction is still under processing	\N	2026-07-03 19:13:41.194664	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 19:11:41.194664	2026-07-03 19:11:49.728042
cdd21391-d31e-4d3f-8b1b-4a153d8c083e	4374dddf-47d8-4fad-af39-3484ddd07fd5	mpesa	103.00	cancelled	ws_CO_03072026191204036741616119	\N	254741616119	4c7c-40bb-96c1-99c4d8eb1b157111	1032	Request Cancelled by user.	\N	2026-07-03 19:14:04.455889	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 19:12:04.455889	2026-07-03 19:12:19.266946
579ef2b3-956d-4fcb-8ad2-1706ba2f90c8	4374dddf-47d8-4fad-af39-3484ddd07fd5	cash	102.50	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 19:12:28.946813	2026-07-03 19:12:28.946813
816c25ba-26a4-4cb3-af41-79504fa40529	0af16624-16fc-4115-8b0b-0763ee399d4f	cash	100.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:07:31.864688	2026-07-03 20:07:31.864688
9136369f-0a6a-444d-98cc-6b78c1b5d8a4	19a91e9a-ffa2-4891-add2-8b3d52c105f6	cash	145.20	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:11:18.203735	2026-07-03 20:11:18.203735
0006f300-7671-4509-94cb-c452b63de232	d78df697-b610-4c02-84ad-0166b1f1e562	cash	242.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 20:19:54.084479	2026-07-03 20:19:54.084479
1df3577a-8f83-4025-a740-534b747e2066	224ab328-14d8-4c5b-a653-7b1b6db6ddf7	cash	200.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 21:09:07.511457	2026-07-03 21:09:07.511457
3c3099c6-73e1-4e4d-a863-0414bda5878d	15fb39ac-a02d-4b08-8fc0-a6af5cf91dd9	cash	200.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 21:11:48.991082	2026-07-03 21:11:48.991082
a08c65ca-99e9-440c-ad42-bcc5b5df8605	a1457757-c080-4df5-a901-9e1989242008	cash	500.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:06:37.403904	2026-07-04 01:06:37.403904
b7a37100-b4c3-4010-89aa-e2f473eee409	537b2a10-89c8-48a8-8aae-9bec16153510	mpesa	120.00	failed	ws_CO_04072026011344478741616119	\N	254741616119	934e-485f-93a1-766dc71b6c9a6584	4999	The transaction is still under processing	\N	2026-07-04 01:15:44.863685	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 01:13:44.863685	2026-07-04 01:13:48.69368
ff2d64bd-4216-430b-9bd2-81264c7e4da5	3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	mpesa	300.00	failed	ws_CO_04072026110248724769896466	\N	254769896466	5e2e-400c-aa5c-216294f9bc7e56121	4999	The transaction is still under processing	\N	2026-07-04 11:04:49.216728	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:02:49.216728	2026-07-04 11:02:58.9252
92c103ad-0c32-4256-bf99-d47900162977	3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	mpesa	300.00	cancelled	ws_CO_04072026110311145769896466	\N	254769896466	15da-4574-bd08-ea5c7f3ef7af32819	\N	Cancelled by cashier before completion	\N	2026-07-04 11:05:11.614087	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:03:11.614087	2026-07-04 11:03:20.041628
fdc15c63-e4c4-4ea0-b028-dd7e57cc1878	3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	mpesa	300.00	failed	ws_CO_04072026110406961769896446	\N	254769896446	934e-485f-93a1-766dc71b6c9a16789	4999	The transaction is still under processing	\N	2026-07-04 11:06:07.690611	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:04:07.690611	2026-07-04 11:04:12.308656
0bdae991-53a3-431a-a784-daea69bcf8d1	3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	mpesa	300.00	failed	ws_CO_04072026110440380741616119	\N	254741616119	934e-485f-93a1-766dc71b6c9a16797	4999	The transaction is still under processing	\N	2026-07-04 11:06:41.136633	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:04:41.136633	2026-07-04 11:04:44.912326
a5c9f72c-a0a6-4547-9a64-e16ec37eaa53	50d3b348-150b-48af-801f-f0dea7182862	mpesa	150.00	cancelled	ws_CO_04072026110810150741616119	\N	254741616119	15da-4574-bd08-ea5c7f3ef7af33128	1032	Request Cancelled by user.	\N	2026-07-04 11:10:10.814919	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:08:10.814919	2026-07-04 11:08:20.374204
0929c917-52a2-4d4c-a399-1dfd16aa94d9	50d3b348-150b-48af-801f-f0dea7182862	cash	150.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:08:32.378241	2026-07-04 11:08:32.378241
e4404dbb-2dfb-474f-91fc-dc0e31240300	2fbf3dfb-63c5-49d8-8912-98fd79238ac8	cash	850.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:31:48.459823	2026-07-04 11:31:48.459823
0df04b09-335e-4e80-bdb3-70438054fa44	3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	cash	200.00	refunded	\N	\N	\N	\N	\N	\N	\N	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:01:34.946899	2026-07-04 11:40:33.661559
352b2dbb-2dff-466c-928b-b2b8cf6543cc	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	mpesa	550.00	expired	ws_CO_04072026173426908741616119	\N	254741616119	15da-4574-bd08-ea5c7f3ef7af61141	1037	DS timeout user cannot be reached.	\N	2026-07-04 17:36:27.353076	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:34:27.353076	2026-07-04 17:34:30.930735
3ad837d8-ae43-421d-a57b-22b12bd8c3cf	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	mpesa	550.00	cancelled	ws_CO_04072026173441402741616119	\N	254741616119	15da-4574-bd08-ea5c7f3ef7af61150	1032	Request Cancelled by user.	\N	2026-07-04 17:36:41.676605	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:34:41.676605	2026-07-04 17:34:56.114136
2e3e709b-7415-462a-9610-016079f6cd9d	7ce412b1-00c5-4a7c-a9a8-e9fdbafbf2e6	cash	550.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 17:35:07.423109	2026-07-04 17:35:07.423109
6b176a52-005f-457d-9885-27f7b5ce128c	1b5fd808-bb97-4588-9e43-44c2fddfe78a	cash	150.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-04 18:37:48.347433	2026-07-04 18:37:48.347433
c492f44f-d5d2-4e8e-95d1-74ae5faac327	2370f3a0-92a1-4710-8aad-2a039c168f77	cash	850.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:11:53.765975	2026-07-05 00:11:53.765975
1138d214-6d7b-4b9a-b84c-26665ba19c1a	cf7fe121-a307-4bf1-826b-441973773232	cash	550.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:25:04.451806	2026-07-05 00:25:04.451806
f83f1674-93bb-4ce8-9ea8-e2ae94843106	e792cea6-ec53-40c4-9c5f-ef0b904f2508	cash	250.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:28:01.9557	2026-07-05 00:28:01.9557
393792a1-0a0c-4085-b8a9-0666f67a1243	006fbed8-0658-4f63-8cb6-62e14af527b5	cash	500.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:46:27.342076	2026-07-05 00:46:27.342076
edeae612-ca10-4dd7-979b-5ac30e381a8a	add3433d-f92f-4f82-bfb7-a6cfac42590c	cash	550.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 00:49:50.079635	2026-07-05 00:49:50.079635
a5b79b31-3da4-46bb-b000-a164ddda540a	f8fe6381-4148-4f2a-814a-31c6f4ca34f5	cash	300.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:07:36.658356	2026-07-05 01:07:36.658356
9051c9ae-d76b-4fa3-9220-0495b084d00a	57f365eb-98da-435d-94c8-666299a7f74e	cash	250.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:08:23.803351	2026-07-05 01:08:23.803351
0b439ee4-f44b-4eaf-8a96-53b6abc3957a	7c8f8837-ff38-4904-96ea-ad347e01dcb0	cash	500.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:08:53.608827	2026-07-05 01:08:53.608827
1761ab16-5909-44a6-95f8-88bf48b01e10	b42ce243-d356-43cc-91a0-fe144f8741fb	cash	200.00	completed	\N	\N	\N	\N	\N	\N	\N	\N	b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	2026-07-05 01:09:48.145083	2026-07-05 01:09:48.145083
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_order_items (id, purchase_order_id, inventory_item_id, item_name, unit, quantity_ordered, quantity_received, unit_price, total, created_at) FROM stdin;
06f5240d-b02e-421d-95fd-2c29577555c0	88cbe7d6-0ba3-4228-bfc9-7e5a8523e23f	\N	meat	Kg	20.00	20.00	800.00	16000.00	2026-07-03 00:32:48.197991
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_orders (id, po_number, supplier_id, status, order_date, expected_date, received_date, subtotal, discount, tax, total_amount, payment_status, notes, attachment_url, created_by, created_at, updated_at) FROM stdin;
88cbe7d6-0ba3-4228-bfc9-7e5a8523e23f	PO-796819777	60595643-a1f5-4bbe-ae08-07e56594e45e	received	2026-07-03	2026-07-08	2026-07-04	16000.00	600.00	0.00	15400.00	unpaid		\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 00:32:48.197991	2026-07-04 13:06:22.894369
\.


--
-- Data for Name: recipe_ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipe_ingredients (id, menu_item_id, inventory_item_id, quantity_per_item, created_at, updated_at) FROM stdin;
90d41a04-5b9c-4440-a736-3596903449e3	42cb323e-0a5b-47c8-a4db-5e40c94a8ad8	cd0db038-aeab-469b-87ee-18f4865f672f	0.250	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
c3e8c6d5-3c1f-4e50-a5fa-62d8b06423fe	42cb323e-0a5b-47c8-a4db-5e40c94a8ad8	371e81f1-da10-4f8f-996c-5e7140453123	1.000	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
6957476b-7163-4a60-9b94-9f1f6b263550	42cb323e-0a5b-47c8-a4db-5e40c94a8ad8	b9568ab9-6ee0-4181-ad88-67e0de374847	0.050	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
71118a8a-e390-4c1a-8733-48ba437491da	9c18e01d-3340-45cb-9be4-ff34931220a5	b96e9f20-06be-40e8-8482-b2c2aece18de	0.200	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
a48c56f1-cd4b-404f-a00a-217493529f71	9c18e01d-3340-45cb-9be4-ff34931220a5	d3f3d99e-de7c-4791-b49a-9f9421b8a07b	0.050	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
95e8434f-f4ca-4842-a861-74ffe4584bcf	9c18e01d-3340-45cb-9be4-ff34931220a5	ee8fcedb-8139-49ee-a21b-acdc2d52df70	0.030	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
f9aa42b1-48d1-47d7-984d-5967c25decb4	9c18e01d-3340-45cb-9be4-ff34931220a5	ea1a9b04-d7cb-4f9d-882a-57fbfd4a4c52	0.250	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
f95f5c9f-9e8d-4fc9-ab59-8b5bff810fdb	e658c1cd-c769-4bf7-b39a-c7ed06e38834	b96e9f20-06be-40e8-8482-b2c2aece18de	0.220	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
8228ffa9-ca23-4029-b165-b99034fe98c9	e658c1cd-c769-4bf7-b39a-c7ed06e38834	1e410322-fbb0-488c-b1dd-d291d45f13ee	0.080	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
2be3e4e5-aa89-4849-9d30-b0e6d80a6967	e658c1cd-c769-4bf7-b39a-c7ed06e38834	b9568ab9-6ee0-4181-ad88-67e0de374847	0.060	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
d9eb3af8-d626-4ab2-a4dd-6edbb6b2b716	e658c1cd-c769-4bf7-b39a-c7ed06e38834	ee8fcedb-8139-49ee-a21b-acdc2d52df70	0.020	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
059dae3e-526e-4c1e-ad5a-c2723f682620	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	b96e9f20-06be-40e8-8482-b2c2aece18de	0.150	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
c5290746-3c84-48f7-86ab-e062f1eb8756	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	d3f3d99e-de7c-4791-b49a-9f9421b8a07b	0.050	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
d38c1619-ed67-40b6-a35c-6616ecc9f53b	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	b9568ab9-6ee0-4181-ad88-67e0de374847	0.050	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
7392d14c-aa94-426f-b13b-62e0a4b8e5ef	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	ee8fcedb-8139-49ee-a21b-acdc2d52df70	0.030	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
ab629964-6fb8-4138-8989-4da80afde121	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	ea1a9b04-d7cb-4f9d-882a-57fbfd4a4c52	0.250	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
9a25d7b0-7a34-4d0b-932d-22993c274612	68234a48-6031-45b0-bb98-6d1319a2b189	332c9314-5799-4820-bfcc-2391def65cd3	0.120	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
0e8d6968-2d17-4287-9c20-117abe2c5aac	68234a48-6031-45b0-bb98-6d1319a2b189	ee8fcedb-8139-49ee-a21b-acdc2d52df70	0.020	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
c0a73686-22f1-42aa-8abd-304b6b655bb0	7d9574d3-377d-4920-bcc7-c15b6dfdb51e	332c9314-5799-4820-bfcc-2391def65cd3	0.200	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
709dd552-1a4b-410b-8b0e-ac35aecef56d	52e47e32-3bc6-4aee-bc4d-51c3d3d1dfdc	b651a451-886c-4f4e-a686-5ee3af9e3b85	0.020	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
ee39132c-f329-422d-9fe2-8cefada731c1	52e47e32-3bc6-4aee-bc4d-51c3d3d1dfdc	9154d4c5-c4e4-4924-88bf-6192e0469b22	0.150	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
a29ef90c-bb8d-4f47-bd07-64679f0aac62	5e8b9db3-5bd1-4f66-bf62-90ca1b59f6d8	b651a451-886c-4f4e-a686-5ee3af9e3b85	0.020	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
55a09aaf-d113-434f-a14a-9a2eb5dabf0d	5e8b9db3-5bd1-4f66-bf62-90ca1b59f6d8	9154d4c5-c4e4-4924-88bf-6192e0469b22	0.100	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
036c44ac-7da5-4747-8831-b08ee2a30b70	9c18e01d-3340-45cb-9be4-ff34931220a5	2696382a-a076-4667-8ccf-1a0ba8e35b4a	0.250	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
42399a42-21a7-4c08-91d9-f81a5d6ba5a4	aaf749bc-9f2c-4be1-bf9c-84fe4adeac14	2696382a-a076-4667-8ccf-1a0ba8e35b4a	0.250	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refunds (id, order_id, payment_id, amount, reason, method, is_void, restocked, points_reversed, processed_by, created_at) FROM stdin;
773eb9ed-c6c0-43f6-a7be-7f839e902e9c	3d56ddd9-7627-4da4-826e-ce6fc5fe2caf	\N	200.00	\N	cash	f	f	0	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 11:40:33.661559
\.


--
-- Data for Name: reservations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservations (id, table_id, customer_id, customer_name, customer_phone, guests, reservation_time, duration_minutes, status, notes, created_by, created_at, updated_at) FROM stdin;
cdfcdcac-5281-4972-9559-a4ded8bda1c0	bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	\N	Leah	\N	2	2026-07-05 13:30:00+03	90	confirmed	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 00:17:26.722587	2026-07-04 00:17:26.722587
fbd1a622-42c2-4baf-bec4-b912908757af	c372d641-9800-4347-8e08-1637b708dff9	\N	joseph	0741616119	2	2026-07-04 01:15:00+03	90	cancelled	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 00:05:14.243552	2026-07-04 01:11:55.741978
86043160-04f0-4799-b432-2c9211aff546	c372d641-9800-4347-8e08-1637b708dff9	\N	joseph	0741616119	2	2026-07-04 13:00:00+03	90	cancelled	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-03 23:57:14.435029	2026-07-04 01:11:59.482565
92492d19-743b-4feb-a983-28379cdc0a7f	990f633e-54d4-4814-b3aa-016f65bc8664	\N	john	\N	2	2026-07-04 13:15:00+03	90	cancelled	\N	531990e6-3e3b-4281-a19a-93e46319d7b9	2026-07-04 00:13:43.841727	2026-07-04 01:12:03.795627
\.


--
-- Data for Name: restaurant_tables; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurant_tables (id, table_number, area, capacity, status, current_order_id, created_at, updated_at, is_active) FROM stdin;
fcac6056-1bfb-4e5e-8b07-7b0673650ef9	T04	Main Hall	6	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
35a29c6b-0527-4a0c-9c52-c11011fc28eb	T06	Main Hall	2	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
c858c302-20ee-44b0-a763-30749a6f173d	T09	Main Hall	2	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
0cdbfe64-73fe-46a2-ac20-9b40d3404a0f	T12	Main Hall	2	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
83eca33e-00e7-4c72-9485-817f066bbf22	T13	Terrace	4	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
533a9cba-2eeb-4198-b4fa-5a44b0a5f3ee	T16	Terrace	4	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
32f0b0a6-6044-4d01-a924-a3d82b1adb98	T17	Terrace	2	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
c79aeacb-5c0b-4f7e-bf54-dd2f9b17f2a7	T18	Terrace	2	available	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	t
8225b44e-014f-46e2-851c-4dd5d0058b83	T14	Terrace	2	available	\N	2026-07-02 14:43:47.302039	2026-07-03 20:08:20.757155	t
83c202a9-3069-444d-bd7d-fd75ae086d5b	T10	Main Hall	4	available	\N	2026-07-02 14:43:47.302039	2026-07-03 20:09:20.21819	t
16c236c0-2d1c-4a0a-b44f-06b54f82584a	T07	Main Hall	2	available	\N	2026-07-02 14:43:47.302039	2026-07-03 20:24:15.036553	t
ac3c271a-2548-4bf8-9104-15e357930dc2	T11	Main Hall	4	available	\N	2026-07-02 14:43:47.302039	2026-07-03 21:55:58.800284	t
a5606184-0fd9-4ae2-827a-548f627a2b0b	T15	Terrace	6	available	\N	2026-07-02 14:43:47.302039	2026-07-03 21:56:27.840124	t
d1ff55f1-dd7b-4c49-a19e-ca1562d172af	T19	Main Hall	3	available	\N	2026-07-03 21:59:17.795893	2026-07-03 21:59:17.795893	t
42831396-4e9b-438b-8217-f5a985dfbad7	T08	Main Hall	6	available	\N	2026-07-02 14:43:47.302039	2026-07-03 21:59:39.914778	t
c372d641-9800-4347-8e08-1637b708dff9	T01	Main Hall	4	available	\N	2026-07-02 14:43:47.302039	2026-07-04 18:37:07.581809	t
bc1d2019-ba4b-4451-8b28-2bed1bdfa1a9	T03	Main Hall	4	available	\N	2026-07-02 14:43:47.302039	2026-07-05 00:26:41.936171	t
77898dc7-97e9-4dd8-82b3-f32e364f28eb	T05	Main Hall	4	available	\N	2026-07-02 14:43:47.302039	2026-07-05 00:55:23.24223	t
990f633e-54d4-4814-b3aa-016f65bc8664	T02	Main Hall	2	available	\N	2026-07-02 14:43:47.302039	2026-07-05 01:10:57.62557	t
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (key, value, updated_at, updated_by) FROM stdin;
business_logo_url	/uploads/business/1783203314642-a6867929-002b-4fff-b9e6-7c3f4ff3f93c.png	2026-07-05 01:15:14.648435	531990e6-3e3b-4281-a19a-93e46319d7b9
\.


--
-- Data for Name: staff_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff_schedules (id, user_id, shift_date, shift_type, start_time, end_time, role_label, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, name, contact_person, phone, email, address, notes, is_active, created_at, updated_at) FROM stdin;
8ce9e8c4-748c-46b2-86c6-866ee109cc79	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
0914a483-487f-4402-815d-08983ea2f921	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
58471a4b-00c5-4412-a75e-3ea2e7a2f23b	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
4bc9164e-fbea-4867-9f1d-c2ad049e1998	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
e1bed8bb-cca3-480e-9fa6-2b4b8e36a786	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
365ba75f-766c-44d7-8ce0-db0bfbc65a1b	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
a5efd713-d910-49b6-b684-eb7bb91cce9c	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039
5ec4836f-33c6-4c46-b25e-295493297a32	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
07a71946-4762-4614-9a78-55e2b6cb11e4	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
1714fc37-808b-40a4-84d9-5c4507581fb0	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
50763f37-6822-4d61-b906-2d67a8b969cd	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
60595643-a1f5-4bbe-ae08-07e56594e45e	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
378e81a2-8298-497c-9614-59fb346b3bf4	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
71ccf05b-7642-4706-9c79-7d489e96a6f6	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-02 23:53:52.253188	2026-07-02 23:53:52.253188
8dfb271b-4074-4094-b1b3-eaf9e557eba3	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-03 13:16:13.38806	2026-07-03 13:16:13.38806
246debd1-f65a-46dc-a319-dc91cb56f62a	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-03 13:16:13.38806	2026-07-03 13:16:13.38806
65f4ff54-f0a5-484d-84b3-1bbe43b6def0	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-03 13:16:13.38806	2026-07-03 13:16:13.38806
def98153-a9e3-450b-a272-85ac2d66078d	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-03 13:16:13.38806	2026-07-03 13:16:13.38806
9d03991e-35eb-44c7-93be-3dc29e48bf44	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-03 13:16:13.38806	2026-07-03 13:16:13.38806
5f5d8bd2-320d-41f3-bfa9-3f5a91cfa7e0	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-03 13:16:13.38806	2026-07-03 13:16:13.38806
d5d7a438-d9c0-4283-9f53-2a3afbeeaea7	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-03 13:16:13.38806	2026-07-03 13:16:13.38806
b6d397a8-bd49-4d48-a4f0-72fb4aebe026	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-03 15:26:48.076177	2026-07-03 15:26:48.076177
03c849e4-5e76-430a-aa11-aba97af7c407	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-03 15:26:48.076177	2026-07-03 15:26:48.076177
3d7141e6-ddc6-43ab-88f6-361ec33feaaa	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-03 15:26:48.076177	2026-07-03 15:26:48.076177
674f2435-ec1b-4c32-bb8f-613679e10860	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-03 15:26:48.076177	2026-07-03 15:26:48.076177
11c8437c-a87c-49ac-b3e2-15d54672b62e	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-03 15:26:48.076177	2026-07-03 15:26:48.076177
f299b648-4106-4804-996f-6cb59aba47c9	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-03 15:26:48.076177	2026-07-03 15:26:48.076177
04490f3b-eeee-4b7e-b175-369f3952374e	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-03 15:26:48.076177	2026-07-03 15:26:48.076177
e311df39-dbc8-4382-8292-a88397792133	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208
e524e6bb-5c32-479e-b287-64da56621294	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208
8526a580-c0f3-4295-8345-7740d0897ebb	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208
33254e55-5475-452c-aa74-5b8821535cb5	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208
93f758a9-a2b1-43b5-9ab7-4442c1fbf873	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208
35c5ef16-5ef0-492b-b32d-ab5620957bdd	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208
887d21e9-26d5-44bd-8e17-7f5a6482ff75	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-03 21:52:20.315208	2026-07-03 21:52:20.315208
829e9767-f2f2-4dd1-b316-e8b1a29058e7	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
0c1a6ac2-9e41-4e0a-938f-1e954232d8e9	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
312e1ca2-1670-433d-b500-d1cfad5216de	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
fbb918e7-0aff-4940-bd8a-81357546c7e3	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
8d58cc09-615d-4a6c-b645-77509b204dd4	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
db70e027-85c8-4020-bdc4-ba5c5a857e3f	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
c362f3fe-790f-4716-99fa-f442f8c93bf6	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-04 01:04:44.006484	2026-07-04 01:04:44.006484
b082767a-ecab-46f7-98cb-c68e3e425d10	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-04 17:12:13.930652	2026-07-04 17:12:13.930652
db0d3a3a-37c8-4c75-8e8a-d2bf3cf8944d	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-04 17:12:13.930652	2026-07-04 17:12:13.930652
e16aeb30-ae25-434d-82a7-9b02b6626dd4	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-04 17:12:13.930652	2026-07-04 17:12:13.930652
e3d46bae-e61d-4779-a9f7-196d056b6049	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-04 17:12:13.930652	2026-07-04 17:12:13.930652
6c93a2a9-7f57-4d66-a7a5-55290e4dddc2	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-04 17:12:13.930652	2026-07-04 17:12:13.930652
3e23c1b1-bd02-44f6-b11f-240f245ba059	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-04 17:12:13.930652	2026-07-04 17:12:13.930652
8849bf87-5ec5-4097-bd41-5265074d5cf6	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-04 17:12:13.930652	2026-07-04 17:12:13.930652
21142143-0581-4579-ae12-fdc8adc2d9aa	Kamau Suppliers Ltd	James Kamau	0712 345 678	james@kamausuppliers.co.ke	Industrial Area, Nairobi	\N	t	2026-07-04 23:39:07.509365	2026-07-04 23:39:07.509365
8ff57630-ce2c-46c1-89a5-77e25989ec59	Fresh Produce Co.	Janet Wambua	0721 456 789	janet@freshproduce.co.ke	City Market, Nairobi	\N	t	2026-07-04 23:39:07.509365	2026-07-04 23:39:07.509365
e4c67836-cd3f-4f1b-aa58-27a6e2dfd9ca	Meat World Ltd	Peter Njoroge	0733 987 654	peter@meatworld.co.ke	Kenyatta Market, Nairobi	\N	t	2026-07-04 23:39:07.509365	2026-07-04 23:39:07.509365
919ac2d6-2c2d-4a4c-8336-01a0b8de1c8d	Dairy Best Ltd	Grace Achieng	0701 234 567	grace@dairybest.co.ke	Westlands, Nairobi	\N	t	2026-07-04 23:39:07.509365	2026-07-04 23:39:07.509365
5006981e-f208-48ec-84fa-cebdaeeebce7	Dry Goods Ltd	Samuel Mutua	0722 111 222	samuel@drygoods.co.ke	Gikomba, Nairobi	\N	t	2026-07-04 23:39:07.509365	2026-07-04 23:39:07.509365
9cf6a182-2e83-4af7-9bba-4a15308dfbe8	K-Gas Limited	Faith Wanjiru	0715 876 543	faith@kgas.co.ke	Industrial Area, Nairobi	\N	t	2026-07-04 23:39:07.509365	2026-07-04 23:39:07.509365
5a3ac8d0-c0ed-4372-b23f-93d9a01d258b	Bestcare Supplies	John Odhiambo	0709 543 210	john@bestcare.co.ke	Kikuyu, Kiambu	\N	t	2026-07-04 23:39:07.509365	2026-07-04 23:39:07.509365
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, full_name, email, phone, password_hash, role, status, schedule_type, avatar_url, joined_date, last_login, created_at, updated_at, approval_status) FROM stdin;
ad479767-6b4b-4c63-91ae-52aad140c2b0	Mary Njeri	mary.njeri@shawalsdei.com	0701 234 567	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	manager	active	full_time	\N	2023-02-05	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
9e3c75c6-c709-4bac-8bf4-12d0818aea91	Peter Mwangi	peter.mwangi@shawalsdei.com	0722 345 890	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	head_chef	active	full_time	\N	2023-03-12	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
16133d61-a21a-4d10-9129-c777dfe6f342	Alice Wanjiku	alice.wanjiku@shawalsdei.com	0708 765 432	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	cashier	active	full_time	\N	2023-04-03	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
9933aefd-78c2-4d32-9671-d8e16b231b4c	Brian Otieno	brian.otieno@shawalsdei.com	0716 234 891	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	waiter	active	full_time	\N	2023-05-18	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
20f546d7-6aa1-4306-9b7d-138b280369b9	Sarah Ndungu	sarah.ndungu@shawalsdei.com	0700 987 654	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	waiter	active	part_time	\N	2023-06-01	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
6e741aa3-4ac7-4eb7-a3dc-05048bcc763f	Daniel Kamau	daniel.kamau@shawalsdei.com	0714 456 789	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	kitchen_staff	active	full_time	\N	2023-07-08	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
bff46365-515d-4692-b02b-0d04f17d9bb4	Grace Mutua	grace.mutua@shawalsdei.com	0720 333 222	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	cleaner	on_leave	part_time	\N	2023-08-15	\N	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
69ff3756-a7ef-4849-a2f2-1f4127ba740d	joseph Kimunya	jmkimunya95@gmail.com	\N	$2a$12$.PMmnL/HmftZ4nVHWJVhpeFJvKui8axYQ0npCnk.cmA8LBrl4uU6O	waiter	active	full_time	\N	2026-07-04	\N	2026-07-04 17:26:39.688619	2026-07-04 17:26:39.688619	pending
b6d9b46c-bcdd-4a5b-ae4c-d53dc07bc488	Joseph Kimunya	kimunyajoseph77@gmail.com		$2a$12$ZtvgBtwlmFmyw0GfwXZHa.tHo1MU8sg94AN7QmxnNAbp7lwB2X6su	waiter	active	full_time	\N	2026-07-04	2026-07-05 01:13:04.17778	2026-07-04 11:42:58.409427	2026-07-04 11:42:58.409427	approved
531990e6-3e3b-4281-a19a-93e46319d7b9	Joseph Kimunya	kimunyajoseph77@gmail.com	0741616119	$2a$12$R/zeQZDGiuaZQywmj6KAK.GXwGf0oKvNB2IE4RQGGhDKMhhSBHFQa	administrator	active	full_time	\N	2023-01-10	2026-07-05 01:14:23.81534	2026-07-02 14:43:47.302039	2026-07-02 14:43:47.302039	approved
\.


--
-- Name: customers customers_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_name_key UNIQUE (name);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: held_orders held_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.held_orders
    ADD CONSTRAINT held_orders_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_sku_key UNIQUE (sku);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: loyalty_points loyalty_points_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_customer_id_key UNIQUE (customer_id);


--
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


--
-- Name: loyalty_rewards loyalty_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id);


--
-- Name: loyalty_tiers loyalty_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_tiers
    ADD CONSTRAINT loyalty_tiers_name_key UNIQUE (name);


--
-- Name: loyalty_tiers loyalty_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_tiers
    ADD CONSTRAINT loyalty_tiers_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_name_key UNIQUE (name);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_item_modifiers menu_item_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_pkey PRIMARY KEY (menu_item_id, modifier_id);


--
-- Name: menu_items menu_items_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_name_unique UNIQUE (name);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: menu_modifier_options menu_modifier_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_options
    ADD CONSTRAINT menu_modifier_options_pkey PRIMARY KEY (id);


--
-- Name: menu_modifiers menu_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifiers
    ADD CONSTRAINT menu_modifiers_pkey PRIMARY KEY (id);


--
-- Name: menu_stock_transactions menu_stock_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_stock_transactions
    ADD CONSTRAINT menu_stock_transactions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_token_hash_key UNIQUE (token_hash);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reference_key UNIQUE (reference);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: recipe_ingredients recipe_ingredients_menu_item_id_inventory_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_menu_item_id_inventory_item_id_key UNIQUE (menu_item_id, inventory_item_id);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: restaurant_tables restaurant_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_pkey PRIMARY KEY (id);


--
-- Name: restaurant_tables restaurant_tables_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_table_number_key UNIQUE (table_number);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: staff_schedules staff_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_pkey PRIMARY KEY (id);


--
-- Name: staff_schedules staff_schedules_user_id_shift_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_user_id_shift_date_key UNIQUE (user_id, shift_date);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_date ON public.expenses USING btree (expense_date);


--
-- Name: idx_held_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_held_orders_created_at ON public.held_orders USING btree (created_at);


--
-- Name: idx_inv_txn_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_txn_reference ON public.inventory_transactions USING btree (reference_id);


--
-- Name: idx_inventory_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_status ON public.inventory_items USING btree (quantity);


--
-- Name: idx_loyalty_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_customer ON public.loyalty_points USING btree (customer_id);


--
-- Name: idx_menu_stock_txn_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_stock_txn_item ON public.menu_stock_transactions USING btree (menu_item_id);


--
-- Name: idx_menu_stock_txn_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_stock_txn_reference ON public.menu_stock_transactions USING btree (reference_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_awaiting_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_awaiting_payment ON public.orders USING btree (status, created_at) WHERE ((status)::text = 'awaiting_payment'::text);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_type ON public.orders USING btree (type);


--
-- Name: idx_password_resets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_resets_user ON public.password_resets USING btree (user_id);


--
-- Name: idx_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id);


--
-- Name: idx_payments_pending_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_pending_expiry ON public.payments USING btree (status, expires_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_recipe_inventory_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_inventory_item ON public.recipe_ingredients USING btree (inventory_item_id);


--
-- Name: idx_recipe_menu_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recipe_menu_item ON public.recipe_ingredients USING btree (menu_item_id);


--
-- Name: idx_refunds_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_order_id ON public.refunds USING btree (order_id);


--
-- Name: idx_schedules_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_date ON public.staff_schedules USING btree (shift_date);


--
-- Name: expenses expenses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: held_orders held_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.held_orders
    ADD CONSTRAINT held_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: held_orders held_orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.held_orders
    ADD CONSTRAINT held_orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_transactions inventory_transactions_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.loyalty_tiers(id) ON DELETE SET NULL;


--
-- Name: loyalty_transactions loyalty_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_transactions loyalty_transactions_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: menu_item_modifiers menu_item_modifiers_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers menu_item_modifiers_modifier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_modifier_id_fkey FOREIGN KEY (modifier_id) REFERENCES public.menu_modifiers(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE SET NULL;


--
-- Name: menu_modifier_options menu_modifier_options_modifier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_options
    ADD CONSTRAINT menu_modifier_options_modifier_id_fkey FOREIGN KEY (modifier_id) REFERENCES public.menu_modifiers(id) ON DELETE CASCADE;


--
-- Name: menu_stock_transactions menu_stock_transactions_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_stock_transactions
    ADD CONSTRAINT menu_stock_transactions_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_stock_transactions menu_stock_transactions_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_stock_transactions
    ADD CONSTRAINT menu_stock_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: orders orders_served_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_served_by_fkey FOREIGN KEY (served_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;


--
-- Name: password_resets password_resets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: payments payments_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: recipe_ingredients recipe_ingredients_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: refunds refunds_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;


--
-- Name: settings settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff_schedules staff_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff_schedules staff_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict J36TAWMKuBVi988Vrx1ygMkU1dAlfOuX5q2BH4WGVPgM4JGmsh1XkGIjsHDACQn

