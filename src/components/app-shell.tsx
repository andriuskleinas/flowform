import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  LayoutList,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryDot, ManageCategoriesDialog } from "@/components/dashboard/category-dialog";
import { Logo } from "@/components/logo";
import { RoleBadge } from "@/components/profile/team-section";
import { STATUS_STYLE } from "@/components/status-pill";
import { THEME_ICON, ThemeSubmenu, useChooseTheme } from "@/components/theme-menu";
import { useCategories } from "@/lib/categories";
import { useDashboardForms, type DashboardForm } from "@/lib/dashboard-forms";
import { UNCATEGORIZED } from "@/lib/dashboard-filters";
import { fullNameOf, useProfile } from "@/lib/profile";
import { useSignOut } from "@/lib/sign-out";
import { THEME_PREFS } from "@/lib/theme";
import { cn, getInitialsFromProfile } from "@/lib/utils";
import {
  ROLE_INFO,
  permissions,
  useWorkspaceRole,
  useWorkspaces,
  workspaceName,
} from "@/lib/workspace";

/**
 * The frame every signed-in page lives in.
 *
 * One sidebar answers "where is everything": the workspace you're in, the
 * way to make a form, search, the places you can go, and your categories.
 * Pages render inside it and never build their own header or back link, so
 * navigation looks and works the same everywhere.
 */

/** Content widths. Form header and page body share them so edges line up. */
export const SHELL_WIDTH = {
  md: "max-w-5xl",
  lg: "max-w-6xl",
} as const;
export type ShellWidth = keyof typeof SHELL_WIDTH;

export function AppShell({
  userId,
  email,
  ownerId,
  header,
  width = "lg",
  children,
}: {
  userId: string;
  email: string;
  /** Workspace in view (its owner's user id). Defaults to your own. */
  ownerId?: string | null;
  /** Sticky bar above the page body, e.g. a form's Build / Results tabs. */
  header?: React.ReactNode;
  width?: ShellWidth;
  children: React.ReactNode;
}) {
  const owner = ownerId || userId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const { data: forms = [] } = useDashboardForms(owner);
  const { role } = useWorkspaceRole(userId, owner);
  const can = permissions(role);

  // Any navigation closes the mobile drawer.
  const href = useRouterState({ select: (s) => s.location.href });
  useEffect(() => setMenuOpen(false), [href]);

  // ⌘K / Ctrl+K opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categoryCounts = new Map<string, number>();
  for (const f of forms)
    if (f.category_id)
      categoryCounts.set(f.category_id, (categoryCounts.get(f.category_id) ?? 0) + 1);

  const sidebar = (
    <SidebarBody
      userId={userId}
      email={email}
      ownerId={owner}
      forms={forms}
      categoryCounts={categoryCounts}
      canEdit={can.canEdit}
      onSearch={() => {
        setMenuOpen(false);
        setPaletteOpen(true);
      }}
      onManageCategories={() => {
        setMenuOpen(false);
        setManageOpen(true);
      }}
    />
  );

  return (
    <div className="min-h-screen bg-surface text-ink lg:pl-60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      {/* Desktop: fixed sidebar. */}
      <aside
        aria-label="Workspace"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-hairline bg-paper lg:flex"
      >
        {sidebar}
      </aside>

      {/* Mobile: slim top bar; the same sidebar slides in as a drawer. */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-hairline bg-surface/90 px-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="inline-flex size-9 items-center justify-center rounded-md text-ink/70 outline-none hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Menu className="size-5" />
          </button>
          <Link
            to="/dashboard"
            search={owner === userId ? {} : { ws: owner }}
            className="rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="inline-flex size-9 items-center justify-center rounded-md text-ink/70 outline-none hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Search className="size-[18px]" />
          </button>
          {can.canEdit && (
            <Link
              to="/forms/new"
              search={owner === userId ? {} : { ws: owner }}
              aria-label="New form"
              className="inline-flex size-9 items-center justify-center rounded-md bg-ink text-paper outline-none hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
            >
              <Plus className="size-[18px]" />
            </Link>
          )}
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-paper p-0 sm:max-w-72">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Workspace, navigation and categories
          </SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>

      {header}

      <main
        id="main"
        className={cn("mx-auto w-full px-5 pb-24 pt-7 md:px-8 md:pt-9", SHELL_WIDTH[width])}
      >
        {children}
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        userId={userId}
        ownerId={owner}
        forms={forms}
        canEdit={can.canEdit}
      />

      <ManageCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        userId={owner}
        formCounts={categoryCounts}
      />
    </div>
  );
}

/** The frame with nothing in it yet: shown while the session is resolving. */
export function AppShellSkeleton({ width = "lg" }: { width?: ShellWidth }) {
  return (
    <div className="min-h-screen bg-surface text-ink lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-3 border-r border-hairline bg-paper p-4 lg:flex">
        <Logo />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="mt-4 h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </aside>
      <div className="flex h-14 items-center border-b border-hairline px-4 lg:hidden">
        <Logo />
      </div>
      <main className={cn("mx-auto w-full px-5 pt-7 md:px-8 md:pt-9", SHELL_WIDTH[width])}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        <Skeleton className="mt-8 h-48 w-full" />
      </main>
    </div>
  );
}

/** Title, one line of context, and the page's own actions. Same on every page. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] leading-tight md:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------- Sidebar -------------------------------- */

const navItem =
  "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40";
const navIdle = "text-ink/65 hover:bg-ink/[0.045] hover:text-ink";
const navActive = "bg-ink/[0.07] font-medium text-ink";

function SidebarBody({
  userId,
  email,
  ownerId,
  forms,
  categoryCounts,
  canEdit,
  onSearch,
  onManageCategories,
}: {
  userId: string;
  email: string;
  ownerId: string;
  forms: DashboardForm[];
  categoryCounts: Map<string, number>;
  canEdit: boolean;
  onSearch: () => void;
  onManageCategories: () => void;
}) {
  const isOwn = ownerId === userId;
  const ws = isOwn ? {} : { ws: ownerId };
  const { data: categories = [] } = useCategories(ownerId);
  const uncategorised = forms.filter((f) => !f.category_id).length;

  const location = useRouterState({ select: (s) => s.location });
  const path = location.pathname;
  const activeCat = path === "/dashboard" ? (location.search as { cat?: string }).cat : undefined;
  const onForms = (path === "/dashboard" && !activeCat) || path.startsWith("/forms");
  const onTeam = path === "/profile" && location.hash === "team";
  const onSettings = path === "/profile" && !onTeam;
  const onGuide = path === "/guide";

  // The shortcut label depends on the platform, which only the browser knows.
  const [shortcut, setShortcut] = useState("");
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K");
  }, []);

  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link
          to="/dashboard"
          search={ws}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Logo />
        </Link>
      </div>

      <div className="px-3">
        <WorkspaceSwitcher userId={userId} ownerId={ownerId} />
      </div>

      <div className="mt-3 space-y-1.5 px-3">
        {canEdit && (
          <Link
            to="/forms/new"
            search={ws}
            className="flex h-9 items-center justify-center gap-2 rounded-md bg-ink text-[13px] font-medium text-paper outline-none transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <Plus className="size-4" />
            New form
          </Link>
        )}
        <button
          type="button"
          onClick={onSearch}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-hairline bg-card px-2.5 text-[13px] text-ink/50 outline-none transition-colors hover:border-ink/25 hover:text-ink/75 focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          {shortcut && <kbd className="font-mono text-[10px] text-ink/40">{shortcut}</kbd>}
        </button>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <nav aria-label="Main">
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/dashboard"
                search={ws}
                aria-current={onForms ? "page" : undefined}
                className={cn(navItem, onForms ? navActive : navIdle)}
              >
                <LayoutList className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="flex-1">Forms</span>
                {forms.length > 0 && (
                  <span className="font-mono text-[11px] tabular-nums text-ink/40">
                    {forms.length}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                hash="team"
                aria-current={onTeam ? "page" : undefined}
                className={cn(navItem, onTeam ? navActive : navIdle)}
              >
                <Users className="size-4 shrink-0" strokeWidth={1.75} />
                Team
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                aria-current={onSettings ? "page" : undefined}
                className={cn(navItem, onSettings ? navActive : navIdle)}
              >
                <Settings2 className="size-4 shrink-0" strokeWidth={1.75} />
                Settings
              </Link>
            </li>
            <li>
              <Link
                to="/guide"
                aria-current={onGuide ? "page" : undefined}
                className={cn(navItem, onGuide ? navActive : navIdle)}
              >
                <BookOpen className="size-4 shrink-0" strokeWidth={1.75} />
                Guide
              </Link>
            </li>
          </ul>
        </nav>

        {(categories.length > 0 || canEdit) && (
          <nav aria-label="Categories" className="mt-6">
            <div className="flex h-7 items-center justify-between pl-2.5 pr-1">
              <h2 className="text-xs font-medium tracking-normal text-ink/45">Categories</h2>
              {canEdit && categories.length > 0 && (
                <button
                  type="button"
                  onClick={onManageCategories}
                  className="rounded px-1.5 py-0.5 text-[11px] text-ink/45 outline-none hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Manage
                </button>
              )}
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {categories.map((c) => {
                const active = activeCat === c.id;
                return (
                  <li key={c.id}>
                    <Link
                      to="/dashboard"
                      // Clicking the active category again clears the filter.
                      search={active ? ws : { ...ws, cat: c.id }}
                      aria-current={active ? "page" : undefined}
                      className={cn(navItem, active ? navActive : navIdle)}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        <CategoryDot color={c.color} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="font-mono text-[11px] tabular-nums text-ink/40">
                        {categoryCounts.get(c.id) ?? 0}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {categories.length > 0 && uncategorised > 0 && (
                <li>
                  <Link
                    to="/dashboard"
                    search={activeCat === UNCATEGORIZED ? ws : { ...ws, cat: UNCATEGORIZED }}
                    aria-current={activeCat === UNCATEGORIZED ? "page" : undefined}
                    className={cn(navItem, activeCat === UNCATEGORIZED ? navActive : navIdle)}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <span
                        aria-hidden
                        className="size-2 rounded-full border border-dashed border-ink/35"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">Uncategorised</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink/40">
                      {uncategorised}
                    </span>
                  </Link>
                </li>
              )}
              {categories.length === 0 && canEdit && (
                <li>
                  <button
                    type="button"
                    onClick={onManageCategories}
                    className={cn(navItem, navIdle, "w-full")}
                  >
                    <Plus className="size-4 shrink-0" strokeWidth={1.75} />
                    Add a category
                  </button>
                </li>
              )}
            </ul>
          </nav>
        )}
      </div>

      <div className="shrink-0 border-t border-hairline p-2">
        <AccountMenu userId={userId} email={email} />
      </div>
    </>
  );
}

function WorkspaceSwitcher({ userId, ownerId }: { userId: string; ownerId: string }) {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces(userId);
  const current = workspaces.find((w) => w.owner_id === ownerId);
  const isOwn = ownerId === userId;
  const name = current ? workspaceName(current) : "My workspace";
  const role = isOwn ? "owner" : (current?.role ?? null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Workspace: ${name}. Switch workspace`}
        className="flex h-11 w-full items-center gap-2.5 rounded-md border border-hairline bg-card px-2 text-left outline-none transition-colors hover:border-ink/25 focus-visible:ring-2 focus-visible:ring-brand/40 data-[state=open]:border-ink/25"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded text-xs font-semibold",
            isOwn ? "bg-ink text-paper" : "bg-brand/12 text-brand",
          )}
        >
          {(current?.owner_name?.trim() || current?.owner_email || name).slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">{name}</span>
          <span className="block truncate text-[11px] leading-tight text-ink/50">
            {role ? ROLE_INFO[role].label : "Workspace"}
            {current && current.member_count > 0
              ? ` · ${current.member_count} ${current.member_count === 1 ? "teammate" : "teammates"}`
              : ""}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-ink/40" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-ink/50">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.length === 0 && (
          <DropdownMenuItem disabled className="gap-3">
            <Check className="size-4" /> My workspace
          </DropdownMenuItem>
        )}
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.owner_id}
            onClick={() =>
              navigate({
                to: "/dashboard",
                search: w.owner_id === userId ? {} : { ws: w.owner_id },
              })
            }
            className="items-start gap-3"
          >
            <span className="mt-0.5 flex size-4 items-center justify-center">
              {w.owner_id === ownerId && <Check className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{workspaceName(w)}</span>
              <span className="block text-xs text-ink/50">
                {w.form_count} {w.form_count === 1 ? "form" : "forms"}
              </span>
            </span>
            <RoleBadge role={w.role} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/profile", hash: "team" })}>
          <UserPlus className="size-4" />
          Invite teammates
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({ userId, email }: { userId: string; email: string }) {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data: profile } = useProfile(userId);
  const name = fullNameOf(profile) || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="flex h-11 w-full items-center gap-2.5 rounded-md px-2 text-left outline-none transition-colors hover:bg-ink/[0.045] focus-visible:ring-2 focus-visible:ring-brand/40 data-[state=open]:bg-ink/[0.045]"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/12 text-[11px] font-semibold text-brand"
        >
          {getInitialsFromProfile(
            profile?.first_name,
            profile?.last_name,
            profile?.display_name,
            email,
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">{name}</span>
          <span className="block truncate text-[11px] leading-tight text-ink/50">{email}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-ink/40" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
          <Settings2 className="size-4" />
          Account settings
        </DropdownMenuItem>
        <ThemeSubmenu userId={userId} />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------- Command palette ---------------------------- */

function CommandPalette({
  open,
  onOpenChange,
  userId,
  ownerId,
  forms,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  ownerId: string;
  forms: DashboardForm[];
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { pref, choose } = useChooseTheme(userId);
  const ws = ownerId === userId ? {} : { ws: ownerId };

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  const item =
    "gap-2.5 rounded-md px-2.5 py-2 text-[13px] data-[selected=true]:bg-ink/[0.06] data-[selected=true]:text-ink";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-hairline bg-popover shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <Command className="bg-transparent">
            <CommandInput placeholder="Search forms, or jump to…" className="h-12 text-sm" />
            <CommandList className="max-h-[min(56vh,26rem)] p-1.5">
              <CommandEmpty className="py-10 text-center text-sm text-ink/50">
                Nothing matches. The void is patient.
              </CommandEmpty>

              {forms.length > 0 && (
                <CommandGroup heading="Forms" className="p-0">
                  {forms.map((f) => (
                    <CommandItem
                      key={f.id}
                      value={`${f.title} ${f.category ?? ""} ${f.id}`}
                      onSelect={run(() =>
                        navigate({
                          to: canEdit ? "/forms/$formId/edit" : "/forms/$formId/responses",
                          params: { formId: f.id },
                        }),
                      )}
                      className={item}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mx-1 size-1.5 shrink-0 rounded-full",
                          STATUS_STYLE[f.status].dot,
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{f.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-ink/40">
                        {f.response_count > 0
                          ? `${f.response_count} ${f.response_count === 1 ? "response" : "responses"}`
                          : STATUS_STYLE[f.status].label.toLowerCase()}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading="Go to" className="p-0">
                {canEdit && (
                  <CommandItem
                    value="New form create"
                    onSelect={run(() => navigate({ to: "/forms/new", search: ws }))}
                    className={item}
                  >
                    <Plus /> New form
                  </CommandItem>
                )}
                <CommandItem
                  value="Forms dashboard home"
                  onSelect={run(() => navigate({ to: "/dashboard", search: ws }))}
                  className={item}
                >
                  <LayoutList /> Forms
                </CommandItem>
                <CommandItem
                  value="Team roles invite members"
                  onSelect={run(() => navigate({ to: "/profile", hash: "team" }))}
                  className={item}
                >
                  <Users /> Team
                </CommandItem>
                <CommandItem
                  value="Settings account profile password"
                  onSelect={run(() => navigate({ to: "/profile" }))}
                  className={item}
                >
                  <Settings2 /> Settings
                </CommandItem>
                <CommandItem
                  value="Guide help features how it works"
                  onSelect={run(() => navigate({ to: "/guide" }))}
                  className={item}
                >
                  <BookOpen /> Guide
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Theme" className="p-0">
                {THEME_PREFS.map((t) => {
                  const Icon = THEME_ICON[t];
                  return (
                    <CommandItem
                      key={t}
                      value={`Theme ${t} appearance mode`}
                      onSelect={run(() => choose(t))}
                      className={item}
                    >
                      <Icon />
                      <span className="flex-1 capitalize">{t}</span>
                      {pref === t && <Check className="text-ink/50" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandGroup heading="Account" className="p-0">
                <CommandItem value="Log out sign out" onSelect={run(signOut)} className={item}>
                  <LogOut /> Log out
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
