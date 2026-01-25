'use client';
import { createContext, useState, useEffect, Children } from "react";
import client from "@/lib/client";

const AuthContext = createContext(null);

const AuthProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.auth.getSession().then(({data}) => {
            setUser(data?.session?.user || null);
            setLoading(false);
        }) 

        const { data: listener } = client.auth.onAuthStateChange((e, session) => {
            setUser(session?.user || null)
        })

        return () => {
            listener.subscription.unsubscribe();
        }
    }, [])

    const logout = async () => {
        await client.auth.signOut();
        setUser(null);
    };

    return (
    <AuthContext.Provider 
        value={{
            user, 
            loading,
            logout,
        }}
    >
        {children}
    </AuthContext.Provider>
    );
};

export { AuthContext, AuthProvider };