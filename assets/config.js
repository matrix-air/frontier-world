/* MicroDuck 造物世界 · 站点配置
 * SUPABASE.url 与 anonKey 都填上 = 正式模式（数据读写 Supabase；建库脚本 sql/schema.sql）；
 * 任一留空 = 演示模式（数据读写本机 localStorage，仅供本地预览）。
 * url 形如 "https://xxxx.supabase.co"（项目 Settings → API → Project URL）；
 * anonKey 取「anon public」键（可公开暴露，安全由数据库 RLS 保证，见 sql/schema.sql）。
 */
window.FW_CONFIG = { SUPABASE: { url: "https://jzqhmryhfcgimzyshfly.supabase.co", anonKey: "sb_publishable_uc-QR7OSZxWHhwZgJ9E2hQ_VBJ9FjVo" } };
