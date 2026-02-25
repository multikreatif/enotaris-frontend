import { useEffect, useMemo, useState } from 'react';
import { SearchDialog } from '@/components/layouts/layout-1/shared/dialogs/search/search-dialog';
import { ChevronsUpDown, Plus, Search } from 'lucide-react';
import { MENU_ROOT } from '@/config/layout-10.config';
import { toAbsoluteUrl } from '@/lib/helpers';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SidebarHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const menuRoot = useMemo(
    () => MENU_ROOT.filter((item) => !item.requiredRole || item.requiredRole === user?.role_name),
    [user?.role_name],
  );
  const [selectedMenuItem, setSelectedMenuItem] = useState(menuRoot[0]);

  useEffect(() => {
    menuRoot.forEach((item) => {
      const match =
        (item.rootPaths && item.rootPaths.some((p) => pathname.startsWith(p))) ||
        (item.rootPath && pathname.startsWith(item.rootPath));
      if (match) {
        setSelectedMenuItem(item);
      }
    });
  }, [pathname, menuRoot]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2.5 px-3.5 h-[70px]">
        <Link href="/dashboard">
          <img
            src={toAbsoluteUrl('/media/app/mini-logo-circle-success.svg')}
            className="h-[34px]"
            alt=""
          />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer text-secondary-foreground font-medium flex items-center justify-between gap-2 w-[190px]">
            Metronic
            <ChevronsUpDown className="text-muted-foreground size-3.5! me-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            sideOffset={10}
            side="bottom"
            align="start"
            className="dark w-(--radix-popper-anchor-width)"
          >
            {menuRoot.map((item, index) => (
              <DropdownMenuItem
                key={index}
                asChild
                className={cn(item === selectedMenuItem && 'bg-accent')}
              >
                <Link href={item.path || ''}>
                  {item.icon && <item.icon />}
                  {item.title}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2.5 px-3.5">
        <Button
          asChild
          variant="secondary"
          className="text-white justify-center w-full max-w-[198px]"
        >
          <Link href="/dashboard">
            <Plus /> Dashboard
          </Link>
        </Button>

        <SearchDialog
          trigger={
            <Button
              mode="icon"
              variant="secondary"
              className="justify-center text-white shrink-0"
            >
              <Search className="size-4.5!" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
