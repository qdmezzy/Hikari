import client from "@/lib/client"

export const getFoundingAuthHeaders = async () => {
  const { data } = await client.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const foundingFetch = async (url, options = {}) => {
  const headers = await getFoundingAuthHeaders()
  return fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...headers, ...(options.headers || {}) },
  })
}
