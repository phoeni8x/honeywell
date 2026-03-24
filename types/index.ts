export type UserType = "team_member" | "guest";

export type ProductCategory = "flower" | "vitamin";

export type FulfillmentType = "dead_drop" | "pickup" | "delivery";

export type OrderStatus =
  | "payment_pending"
  | "payment_expired"
  | "waiting"
  | "confirmed"
  | "ready_at_drop"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "customer_arrived"
  | "pickup_submitted"
  | "pickup_flagged"
  | "delivered"
  | "picked_up"
  | "cancelled";

export type PaymentMethod = "revolut" | "crypto" | "bees" | "points";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  price_regular: number;
  price_team_member: number;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  customer_token: string;
  product_id: string;
  quantity: number;
  total_price: number;
  user_type: UserType;
  payment_method: PaymentMethod | string | null;
  status: OrderStatus;
  pickup_photo_url: string | null;
  created_at: string;
  updated_at: string;
  order_number?: string | null;
  referral_code_used?: string | null;
  fulfillment_type?: FulfillmentType | string | null;
  dead_drop_id?: string | null;
  location_id?: string | null;
  delivery_address?: string | null;
  delivery_apartment?: string | null;
  delivery_notes?: string | null;
  delivery_phone?: string | null;
  delivery_lat?: number | null;
  delivery_lon?: number | null;
  bees_used?: number | null;
  points_used?: number | null;
  /** delivery + Revolut remainder only */
  revolut_pay_timing?: "pay_now" | "pay_on_delivery" | null;
  pay_now_payment_confirmed?: boolean | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  created_at: string;
}

export interface DeadDropRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  apple_maps_url: string | null;
  instructions: string | null;
  location_photo_url: string | null;
}

export interface ShopLocationRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  apple_maps_url: string | null;
  admin_message: string | null;
}

export interface OrderWithProduct extends Order {
  product?: Product | null;
  dead_drop?: DeadDropRow | null;
  pickup_location?: ShopLocationRow | null;
}
