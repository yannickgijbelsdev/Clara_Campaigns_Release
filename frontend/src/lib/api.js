import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API, withCredentials: true });

let _pending = 0;
function _emitLoading() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("clara:loading", { detail: _pending > 0 }));
  }
}
function _start() { _pending += 1; _emitLoading(); }
function _stop() { _pending = Math.max(0, _pending - 1); _emitLoading(); }

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("clara_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const company = localStorage.getItem("clara_company");
  if (company) config.headers["X-Company-Id"] = company;
  _start();
  return config;
}, (error) => { _stop(); return Promise.reject(error); });

api.interceptors.response.use(
  (res) => { _stop(); return res; },
  (error) => {
    _stop();
    const status = error.response?.status;
    const url = error.config?.url || "";
    const isAuthCall = url.includes("/auth/");
    if (status === 401 && !isAuthCall) {
      localStorage.removeItem("clara_token");
      localStorage.removeItem("clara_company");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Er ging iets mis. Probeer het opnieuw.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
