'use client';

import { useRouter } from 'next/navigation';
import { AppsDropdownMenu } from '@/components/layouts/layout-1/shared/topbar/apps-dropdown-menu';
import { ChatSheet } from '@/components/layouts/layout-1/shared/topbar/chat-sheet';
import { UserDropdownMenu } from '@/components/layouts/layout-1/shared/topbar/user-dropdown-menu';
import { LayoutGrid, MessageCircleMore } from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

export function SidebarFooter() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/signin');
  };

  return (
    <div className="flex flex-center justify-between shrink-0 ps-4 pe-3.5 mb-3.5">
      <UserDropdownMenu
        trigger={
          <img
            className="size-9 rounded-full border-2 border-mono/25 shrink-0 cursor-pointer"
            src={toAbsoluteUrl('/media/avatars/300-2.png')}
            alt="User Avatar"
          />
        }
        user={isAuthenticated && user ? { name: user.name, email: user.email } : undefined}
        onLogout={isAuthenticated ? handleLogout : undefined}
      />

      <div className="flex items-center gap-1.5">
        <ChatSheet
          trigger={
            <Button
              variant="ghost"
              mode="icon"
              className="hover:bg-background hover:[&_svg]:text-primary"
            >
              <MessageCircleMore className="size-4.5!" />
            </Button>
          }
        />

        <AppsDropdownMenu
          trigger={
            <Button
              variant="ghost"
              mode="icon"
              className="hover:bg-background hover:[&_svg]:text-primary"
            >
              <LayoutGrid className="size-4.5!" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
