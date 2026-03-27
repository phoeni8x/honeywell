/** Obscured admin UI URL (no separate login screen; optional env-based Supabase session in middleware). */
export const ADMIN_BASE_PATH = "/admin-080209";

export const LS_USER_TYPE = "honeywell_user_type";
export const LS_CUSTOMER_TOKEN = "honeywell_customer_token";
/** Referrer code from ?ref= (another customer's HW-XXXXXX) */
export const LS_REFERRED_BY = "honeywell_referred_by";
/** This browser's own referral code (mirrors server bees_wallets.referral_code) */
export const LS_MY_REFERRAL_CODE = "honeywell_my_referral_code";
/** Team member Telegram handle captured at verify time (without @). */
export const LS_TELEGRAM_USERNAME = "honeywell_telegram_username";
