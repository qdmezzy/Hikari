'use client';
import { createContext, useState, useEffect, useMemo, useCallback } from "react";
import client from "@/lib/client";

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
    const [user, setUser] = useState(() => readCachedUser());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.auth.getSession().then(({data}) => {
            const nextUser = data?.session?.user || null;
            setUser(nextUser);
            writeCachedUser(nextUser);
            setLoading(false);
        }) 

        const { data: listener } = client.auth.onAuthStateChange((e, session) => {
            const nextUser = session?.user || null;
            setUser(nextUser)
            writeCachedUser(nextUser)
            setLoading(false)
        })

        return () => {
            listener.subscription.unsubscribe();
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
