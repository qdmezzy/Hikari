const POSTS_KEY = "hikari_social_posts";
const FOLLOWING_KEY = "hikari_social_following";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const getFollowKey = (userId) => `${FOLLOWING_KEY}:${userId || "anon"}`;

export const getSocialPosts = () => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(POSTS_KEY), []);
};

export const saveSocialPosts = (posts) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent("hikari:social-posts"));
};

export const subscribeSocialPosts = (callback) => {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("hikari:social-posts", handler);
  return () => window.removeEventListener("hikari:social-posts", handler);
};

export const getFollowing = (userId) => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(getFollowKey(userId)), []);
};

export const saveFollowing = (userId, list) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getFollowKey(userId), JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("hikari:social-following"));
};

export const subscribeFollowing = (callback) => {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("hikari:social-following", handler);
  return () => window.removeEventListener("hikari:social-following", handler);
};
