'use client';

import { gameButtonClass } from '@/lib/gameTheme';
import { useSessionUser } from '@/lib/sessionClient';
import { cn } from '@/lib/utils';

export default function AuthButtons() {
  const { user, loading, logout } = useSessionUser();

  if (loading) {
    return <div className="hidden h-10 w-28 sm:block" />;
  }

  if (!user) {
    return (
      <a
        href="/api/auth/discord"
        className={cn(gameButtonClass, 'inline-flex items-center justify-center no-underline hover:no-underline')}
      >
        Login with Discord
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="h-8 w-8 border border-[#4a4338] object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center border border-[#4a4338] bg-[#171411] text-xs text-[#e5b56e]">
          {user.username.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="hidden max-w-[9rem] truncate text-sm text-[#ddd6cb] sm:inline">{user.username}</span>
      <button type="button" className={gameButtonClass} onClick={() => void logout()}>
        Log out
      </button>
    </div>
  );
}
