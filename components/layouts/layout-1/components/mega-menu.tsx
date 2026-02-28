import { MENU_MEGA } from '@/config/layout-1.config';
import { cn } from '@/lib/utils';
import { useMenu } from '@/hooks/use-menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { MegaMenuSubAccount } from '@/components/layouts/layout-1/shared/mega-menu/mega-menu-sub-account';
import { MegaMenuSubAuth } from '@/components/layouts/layout-1/shared/mega-menu/mega-menu-sub-auth';
import { MegaMenuSubNetwork } from '@/components/layouts/layout-1/shared/mega-menu/mega-menu-sub-network';
import { MegaMenuSubProfiles } from '@/components/layouts/layout-1/shared/mega-menu/mega-menu-sub-profiles';
import { MegaMenuSubStore } from '@/components/layouts/layout-1/shared/mega-menu/mega-menu-sub-store';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function MegaMenu() {
  const pathname = usePathname();
  const { isActive, hasActiveChild } = useMenu(pathname);
  const homeItem = MENU_MEGA[0];

  const linkClass = `
    text-sm text-secondary-foreground font-medium 
    hover:text-primary hover:bg-transparent 
    focus:text-primary focus:bg-transparent 
    data-[active=true]:text-primary data-[active=true]:bg-transparent 
    data-[state=open]:text-primary data-[state=open]:bg-transparent
  `;

  return (
    <NavigationMenu>
      <NavigationMenuList className="gap-0">
        {/* Home Item */}
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link
              href={homeItem.path || '/'}
              className={cn(linkClass)}
              data-active={isActive(homeItem.path) || undefined}
            >
              {homeItem.title}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
