CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending_payment',
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  service_area text NOT NULL,
  service text NOT NULL,
  frequency text NOT NULL,
  bedrooms int NOT NULL,
  bathrooms int NOT NULL,
  add_ons text[] NOT NULL DEFAULT '{}',
  rush boolean NOT NULL DEFAULT false,
  preferred_date date NOT NULL,
  time_window text NOT NULL,
  notes text NOT NULL DEFAULT '',
  amount_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  paypal_order_id text UNIQUE,
  paypal_capture_id text,
  paid_at timestamptz
);
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- No client policies: bookings are only read/written by server code.