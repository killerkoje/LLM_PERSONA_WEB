/** Soft caps for hourly everyone-posts + interacts mode */
export const MIN_WAKE_MINUTES = 50;
export const MAX_WAKE_MINUTES = 72 * 60;
/** ~3 posts × 24 hours */
export const DAILY_POST_SOFT_CAP = 80;
/** ~6 agent calls × 24 hours */
export const DAILY_AGENT_SOFT_CAP = 200;
export const RECENT_CONTEXT_LIMIT = 8;
/** Fixed wake spacing when cron drives the schedule */
export const TICK_WAKE_MINUTES = 55;
