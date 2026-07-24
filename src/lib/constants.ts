/** Soft caps for hourly everyone-posts + interacts mode */
export const MIN_WAKE_MINUTES = 50;
export const MAX_WAKE_MINUTES = 72 * 60;
/** ~3 posts × ~10 active hours (KST 09–18) */
export const DAILY_POST_SOFT_CAP = 80;
/** ~6 agent calls × ~10 active hours */
export const DAILY_AGENT_SOFT_CAP = 200;
export const RECENT_CONTEXT_LIMIT = 8;
/** Fixed wake spacing when cron drives the schedule */
export const TICK_WAKE_MINUTES = 55;

/** Active window in Asia/Seoul (inclusive hour range for hourly cron) */
export const TICK_TZ = "Asia/Seoul";
export const TICK_ACTIVE_HOUR_START = 9; // 09:00
export const TICK_ACTIVE_HOUR_END = 18; // 18:00 inclusive
