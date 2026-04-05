import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center">
            <Network className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">OSINT Dashboard</h1>
          <p className="text-base text-gray-400">Sign in to your account</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-base text-red-400">
              {error}
              <button
                type="button"
                onClick={clearError}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-base font-medium text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg
                         text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:border-transparent"
              placeholder="analyst@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-base font-medium text-gray-300">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 text-base bg-surface-800 border border-gray-700
                           rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700
                       rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       focus:ring-offset-surface-900"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
