"use client";
import { useAuth } from "./AuthProvider";
import Link from "next/link";
import { Button } from "./ui/button";

export default function Navbar() {
  const { token, logout } = useAuth();

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Deploy Platform
        </Link>
        {token ? (
          <div className="flex items-center gap-4">
            <Link href="/">Projects</Link>
            <Button onClick={logout}>Logout</Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
