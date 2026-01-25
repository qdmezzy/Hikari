import { useContext } from "react";
import { AuthContext } from "@/components/context/AuthProvider";

const UseAuth = () => {
    const context = useContext(AuthContext);

    if(!context) {
        throw new Error("useAuth must be used inside AuthProvider")
    }

    return context;
};

export default UseAuth;
