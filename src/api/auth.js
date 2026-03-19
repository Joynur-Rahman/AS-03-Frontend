const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost";

export function login() {
  window.location.href = `${API_BASE}/login`;
}

export function logout() {
  window.location.href = `${API_BASE}/logout`;
}

export async function getCurrentUser() {
  const response = await fetch(`${API_BASE}/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Not authenticated");
  }

  const result = await response.json();
  return result.data;  

}

