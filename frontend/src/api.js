// src/api.js
// 모든 페이지에서 이걸 import해서 쓰면 됩니다
const API = import.meta.env.VITE_API_URL || ''
export default API
