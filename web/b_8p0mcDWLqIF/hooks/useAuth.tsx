"use client"

import * as React from "react"

interface User {
  id: string
  name: string
  email: string
  username: string
  avatar?: string
  isPremium?: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, username: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Load user from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem("hikari-user")
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem("hikari-user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const newUser: User = {
      id: "user-" + Date.now(),
      name: email.split("@")[0],
      email,
      username: email.split("@")[0].toLowerCase(),
      isPremium: false,
    }
    
    setUser(newUser)
    localStorage.setItem("hikari-user", JSON.stringify(newUser))
  }

  const register = async (email: string, password: string, username: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const newUser: User = {
      id: "user-" + Date.now(),
      name: username,
      email,
      username: username.toLowerCase(),
      isPremium: false,
    }
    
    setUser(newUser)
    localStorage.setItem("hikari-user", JSON.stringify(newUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("hikari-user")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
