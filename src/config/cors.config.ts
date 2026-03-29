/**
 * Origin được phép (HTTP CORS + Socket.IO).
 * Chỉnh trực tiếp khi đổi domain dev hoặc thêm môi trường prod.
 */
export const CORS_ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://dorm.tuanstark.id.vn',
  'https://dorm-admin.tuanstark.id.vn'
];
