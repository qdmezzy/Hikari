const OAUTH_PROVIDERS = new Set(["google", "discord"])

const getProviders = (user) => {
  return Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers.map((provider) => String(provider).toLowerCase())
    : []
}

export const hasOauthProvider = (user) => {
  const providers = getProviders(user)
  return providers.some((provider) => OAUTH_PROVIDERS.has(provider))
}

export const getUserHandle = (user) => {
  const username = String(user?.user_metadata?.username || user?.user_metadata?.handle || "").trim()
  return username
}

export const needsAuthOnboarding = (user) => {
  if (!user) return false
  if (!hasOauthProvider(user)) return false

  const hasHandle = Boolean(getUserHandle(user))
  const setupComplete = user?.user_metadata?.oauth_setup_complete === true
  const passwordSet = user?.user_metadata?.oauth_password_set === true

  return !hasHandle || !setupComplete || !passwordSet
}

