"use client";
import { createContext, useState, useEffect, useMemo, useCallback } from "react";
import client from "@/lib/client";
import { ensureUserHandle } from "@/lib/public-profile";

const AuthContext = createContext(null);
const AUTH_CACHE_KEY = "hikari-auth-user";

const readCachedUser = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(AUTH_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const writeCachedUser = (nextUser) => {
    if (typeof window === "undefined") return;
    if (!nextUser) {
        window.sessionStorage.removeItem(AUTH_CACHE_KEY);
        return;
    }

    try {
        window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(nextUser));
    } catch {
        // Ignore cache write issues; auth state still works normally.
    }
};

const AuthProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const cachedUser = readCachedUser();
        if (cachedUser) {
            setUser(cachedUser);
        }

        const loadSession = async () => {
            try {
                const { data, error } = await client.auth.getSession();
                if (error) {
                    console.warn("Unable to load auth session.", error);
                }

                if (!isMounted) return;
                const nextUser = data?.session?.user || null;
                setUser(nextUser);
                writeCachedUser(nextUser);
                if (nextUser) void ensureUserHandle(nextUser);
            } catch (error) {
                console.warn("Unable to load auth session.", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadSession();

        const { data: listener } = client.auth.onAuthStateChange((e, session) => {
            if (!isMounted) return;
            const nextUser = session?.user || null;
            setUser(nextUser)
            writeCachedUser(nextUser)
            if (nextUser) void ensureUserHandle(nextUser)
            setLoading(false)
        })

        return () => {
            isMounted = false;
            listener?.subscription?.unsubscribe();
        }
    }, [])

    const logout = useCallback(async () => {
        await client.auth.signOut();
        setUser(null);
        writeCachedUser(null);
    }, []);

    const value = useMemo(() => ({
        user,
        loading,
        logout,
    }), [user, loading, logout])

    return (
    <AuthContext.Provider 
        value={value}
    >
        {children}
    </AuthContext.Provider>
    );
};

export { AuthContext, AuthProvider };
