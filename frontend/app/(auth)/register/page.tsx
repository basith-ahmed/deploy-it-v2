"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post("/register", { email, password });
      router.push("/login");
    } catch (error) {
      setError("Registration failed");
    }
  };

  return (
    <div className="h-full min-h-screen w-screen bg-black text-white flex items-center justify-center">
      <div className="border border-white/20 p-8 rounded-lg w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white/80 mb-6">Register</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-4 text-white/80 bg-white/10 rounded-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 text-white/80 bg-white/10 rounded-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-2 text-black bg-white rounded-md hover:bg-gray-100 duration-300 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Loading..." : "Register"}
        </button>

        <Link
          href="/login"
          className="block text-center mt-4 text-white/80 hover:text-white duration-300"
        >
          Already have an account? Login
        </Link>

        {error && <p className="mt-4 text-red-500 text-center">{error}</p>}
      </div>
    </div>
  );
}
