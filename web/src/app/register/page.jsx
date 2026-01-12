import React, { useState } from "react";
import { Link } from "react-router-dom";

const Signup = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div>
      <form className="max-w-md m-auto pt-24">
        <h2 className="font-bold pb-2">Sign up today!</h2>
        <p>
          Already have an account? <Link to="/login" className="text-blue-500">Sign in!</Link>
        </p>
        <div className="flex flex-col py-4">
          <input placeholder="Username" className="p-3 mt-4 bg-gray-200 rounded" type="text" />
          <input placeholder="Email" className="p-3 mt-4 bg-gray-200 rounded" type="email" />
          <input placeholder="Password" className="p-4 mt-4 bg-gray-200 rounded" type="password" />
          <button type="submit" disabled={loading} className="p-2 mt-6 w-full bg-blue-500 rounded">Sign up</button>
        </div>
      </form>
    </div>
  );
};

export default Signup;
