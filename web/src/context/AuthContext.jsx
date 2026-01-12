import { createContext, useEffect, useState, useContext } from "react";

const AuthContext = createContext()

export const AuthContextProvider = ({children}) => {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check if user is already logged in (from localStorage or your auth service)
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
            setSession(JSON.parse(savedUser))
        }
        setLoading(false)
    }, [])

    const login = (user) => {
        setSession(user)
        localStorage.setItem('user', JSON.stringify(user))
    }

    const logout = () => {
        setSession(null)
        localStorage.removeItem('user')
    }

    return (
        <AuthContext.Provider value={{ session, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const UserAuth = () => {
    return useContext(AuthContext)
}