import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  UserX,
  X as XClose,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionPicker } from "@/components/feature/PermissionPicker";
import { RolePermissionMatrix } from "@/components/feature/RolePermissionMatrix";
import { UserAvatar } from "@/components/feature/UserAvatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { adminApi } from "@/lib/api/admin";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type {
  AdminPasswordResetResponse,
  RoleListItem,
  UserCreateResponse,
  UserListItem,
} from "@/types/admin";

export default function UserManagementPage() {
  const { t } = useTranslation("admin");
  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 px-6 py-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          {t("users.title")}
        </h1>
        <p className="mt-1 text-sm text-text-muted">{t("users.subtitle")}</p>
      </header>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t("users.tab_users")}</TabsTrigger>
          <TabsTrigger value="roles">{t("users.tab_roles")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-5 space-y-5">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles" className="mt-5 space-y-5">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ====================================================================== */
/*  KULLANICILAR TAB                                                       */
/* ====================================================================== */

function UsersTab() {
  const { t, i18n } = useTranslation(["admin", "common", "errors"]);
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("users.create");
  const canUpdate = has("users.update");
  const canDelete = has("users.delete");
  const canResetPw = has("users.reset_password");

  const currentUserId = useAuthStore((s) => s.user?.id);

  // Pattern C: backend her zaman ≥1 aktif Süper Admin invariant'ını korur.
  // Bu sayım UI guard'ı için — son admin durumunda buton/aksiyon disable.
  // Backend error.code (örn: EMAIL_ALREADY_EXISTS, LAST_SUPER_ADMIN) için
  // errors namespace'inde yerelleştirilmiş karşılık varsa onu göster; yoksa
  // backend'in default (İngilizce) mesajına düş.
  const translateError = (err: unknown, fallbackKey: string): string => {
    if (err instanceof ApiError) {
      const key = `errors:${err.code}`;
      if (i18n.exists(key)) return t(key, err.params ?? {});
      return err.message;
    }
    return t(fallbackKey);
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserListItem | null>(null);
  const [createdUser, setCreatedUser] = useState<UserCreateResponse | null>(null);
  const [resetResult, setResetResult] = useState<AdminPasswordResetResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtreler
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );

  const usersQuery = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => adminApi.listUsers(),
    staleTime: 30_000,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles", "list"],
    queryFn: () => adminApi.listRoles(),
    staleTime: 60 * 60_000,
  });

  const superAdminCountQuery = useQuery({
    queryKey: ["users", "super-admin-count"],
    queryFn: () => adminApi.getSuperAdminCount(),
    staleTime: 30_000,
  });
  const superAdminCount = superAdminCountQuery.data ?? Infinity;
  const isLastSuperAdmin = (u: UserListItem): boolean =>
    u.role?.is_system === true && u.is_active && superAdminCount <= 1;
  const invalidateUserData = () => {
    void qc.invalidateQueries({ queryKey: ["users", "list"] });
    void qc.invalidateQueries({ queryKey: ["users", "super-admin-count"] });
  };

  const filtered = useMemo(() => {
    const all = usersQuery.data ?? [];
    const lower = search.trim().toLowerCase();
    return all.filter((u) => {
      if (lower) {
        const hay = `${u.email} ${u.first_name} ${u.last_name}`.toLowerCase();
        if (!hay.includes(lower)) return false;
      }
      if (roleFilter !== "all" && String(u.role_id) !== roleFilter) return false;
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      return true;
    });
  }, [usersQuery.data, search, roleFilter, statusFilter]);

  const createMut = useMutation({
    mutationFn: (p: {
      email: string;
      first_name: string;
      last_name: string;
      role_id: number;
    }) => adminApi.createUser(p),
    onSuccess: (data) => {
      setCreateOpen(false);
      setCreatedUser(data);
      invalidateUserData();
    },
    onError: (err) => setErrorMsg(translateError(err, "admin:users.error_create_failed")),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        first_name?: string;
        last_name?: string;
        role_id?: number;
        is_active?: boolean;
      };
    }) => adminApi.updateUser(id, payload),
    onSuccess: () => {
      setEditUser(null);
      invalidateUserData();
    },
    onError: (err) => setErrorMsg(translateError(err, "admin:users.error_update_failed")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      setPendingDelete(null);
      invalidateUserData();
    },
    onError: (err) => setErrorMsg(translateError(err, "admin:users.error_delete_failed")),
  });

  const resetPwMut = useMutation({
    mutationFn: (id: number) => adminApi.resetUserPassword(id),
    onSuccess: (data) => {
      setEditUser(null);
      setResetResult(data);
    },
    onError: (err) => setErrorMsg(translateError(err, "admin:users.error_reset_pw_failed")),
  });

  const roles = rolesQuery.data ?? [];

  const totalUsers = (usersQuery.data ?? []).length;

  const lang = i18n.language;

  return (
    <>
      {/* Filter bar — tek satır */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin:users.search_placeholder")}
            className="h-10 pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-10 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin:users.filter_all_roles")}</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status segmented control */}
        <div className="inline-flex h-10 items-center overflow-hidden rounded-lg border border-border bg-surface">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "h-full px-3 text-xs font-semibold transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-text-muted hover:text-foreground",
              )}
            >
              {s === "all"
                ? t("admin:users.filter_all")
                : s === "active"
                  ? t("admin:users.filter_active")
                  : t("admin:users.filter_inactive")}
            </button>
          ))}
        </div>

        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="ml-auto gap-1.5">
            <Plus className="size-4" />
            {t("admin:users.new_user")}
          </Button>
        )}
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Tablo / boş / skeleton */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {usersQuery.isPending ? (
            <UserTableSkeleton />
          ) : filtered.length === 0 ? (
            totalUsers === 0 ? (
              <UsersEmptyState onInvite={() => setCreateOpen(true)} />
            ) : (
              <FilteredEmptyState
                onClear={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                }}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                    <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:users.table_user")}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:users.table_role")}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:users.table_status")}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:users.table_last_login")}
                    </TableHead>
                    <TableHead className="w-12 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:users.table_actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const neverLoggedIn = !u.last_login_at;
                    return (
                      <TableRow
                        key={u.id}
                        className={cn(
                          "border-b border-border/40 last:border-b-0 hover:bg-muted/40",
                          !u.is_active && "opacity-60",
                        )}
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={u} size="md" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {u.first_name} {u.last_name}
                              </p>
                              <p className="truncate text-xs text-text-muted">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={u.role} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={u.is_active ? "success" : "neutral"}>
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                u.is_active ? "bg-success-500" : "bg-gray-400",
                              )}
                            />
                            {u.is_active
                              ? t("admin:users.active")
                              : t("admin:users.inactive")}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {u.last_login_at ? (
                            <span
                              title={dayjs
                                .utc(u.last_login_at)
                                .tz("Europe/Istanbul")
                                .format("DD.MM.YYYY HH:mm")}
                              className="text-xs text-text-muted"
                            >
                              {dayjs
                                .utc(u.last_login_at)
                                .locale(lang)
                                .fromNow()}
                            </span>
                          ) : (
                            <StatusBadge tone="warning">
                              {t("admin:users.never_logged_in")}
                            </StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu
                            user={u}
                            neverLoggedIn={neverLoggedIn}
                            isLastSuperAdmin={isLastSuperAdmin(u)}
                            isSelf={u.id === currentUserId}
                            canEdit={canUpdate}
                            canResetPassword={canResetPw}
                            canToggleActive={canUpdate}
                            canDelete={canDelete}
                            onEdit={() => setEditUser(u)}
                            onResetPassword={() => resetPwMut.mutate(u.id)}
                            onToggleActive={() =>
                              updateMut.mutate({
                                id: u.id,
                                payload: { is_active: !u.is_active },
                              })
                            }
                            onDelete={() => setPendingDelete(u)}
                            disabled={updateMut.isPending || resetPwMut.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="size-4" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-semibold">
                  {t("admin:users.invite_title")}
                </span>
                <DialogDescription className="text-xs font-normal">
                  {t("admin:users.invite_description")}
                </DialogDescription>
              </span>
            </DialogTitle>
          </DialogHeader>
          <UserCreateForm
            roles={roles}
            onSubmit={(p) => {
              setErrorMsg(null);
              createMut.mutate(p);
            }}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* EDIT Dialog */}
      <Dialog open={editUser !== null} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin:users.edit_title")}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
                <UserAvatar user={editUser} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {editUser.first_name} {editUser.last_name}
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-text-muted">
                    <Mail className="size-3" />
                    {editUser.email}
                  </p>
                </div>
                <RoleBadge role={editUser.role} />
              </div>
              <UserEditForm
                user={editUser}
                roles={roles}
                isLastSuperAdmin={isLastSuperAdmin(editUser)}
                isSelf={editUser.id === currentUserId}
                onSubmit={(payload) =>
                  updateMut.mutate({ id: editUser.id, payload })
                }
                onResetPassword={() => resetPwMut.mutate(editUser.id)}
                loading={updateMut.isPending}
                resetLoading={resetPwMut.isPending}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* CREATED — invitation email sent */}
      <Dialog
        open={createdUser !== null}
        onOpenChange={(o) => !o && setCreatedUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              {t("admin:users.created_title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin:users.invite_sent_description")}
            </DialogDescription>
          </DialogHeader>
          {createdUser && (
            <EmailSentNotice
              email={createdUser.email}
              onClose={() => setCreatedUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* PASSWORD RESET — reset email sent */}
      <Dialog
        open={resetResult !== null}
        onOpenChange={(o) => !o && setResetResult(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              {t("admin:users.reset_pw_title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin:users.reset_email_sent_description")}
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <EmailSentNotice
              email={resetResult.email}
              onClose={() => setResetResult(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE confirm */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:users.delete_title")}</DialogTitle>
            <DialogDescription>
              <strong>{pendingDelete?.email}</strong>{" "}
              {t("admin:users.delete_description_prefix")}
            </DialogDescription>
          </DialogHeader>
          {pendingDelete?.role?.is_system && (
            <Alert variant="destructive">
              <AlertDescription>
                {t("admin:users.super_admin_delete_danger", {
                  name: `${pendingDelete.first_name} ${pendingDelete.last_name}`,
                })}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("admin:users.delete_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoleBadge({
  role,
}: {
  role: UserListItem["role"];
}) {
  if (!role) return <Badge variant="outline">—</Badge>;
  const color = role.color ?? null;
  // Renkli badge — rol API'sinden gelen color, alpha overlay ile arkaplan
  if (color) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none"
        style={{ background: `${color}1f`, color: color }}
      >
        {role.is_system && <ShieldCheck className="size-3" />}
        {role.name}
      </span>
    );
  }
  return (
    <Badge variant={role.is_system ? "default" : "secondary"} className="font-medium">
      {role.is_system && <ShieldCheck className="size-3 mr-1" />}
      {role.name}
    </Badge>
  );
}

/* ---------- Yardımcı componentler ---------- */

function RowActionsMenu({
  user,
  neverLoggedIn,
  isLastSuperAdmin,
  isSelf,
  canEdit,
  canResetPassword,
  canToggleActive,
  canDelete,
  onEdit,
  onResetPassword,
  onToggleActive,
  onDelete,
  disabled,
}: {
  user: UserListItem;
  neverLoggedIn: boolean;
  isLastSuperAdmin: boolean;
  isSelf: boolean;
  canEdit: boolean;
  canResetPassword: boolean;
  canToggleActive: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("admin");
  // Peer model (Pattern A): kullanıcı kendi hesabı üzerinde destructive
  // admin aksiyonu yapamaz; başka bir admin yapmalı. Yanlışlıkla kendini
  // kilitleme senaryosunu önler.
  // Pattern C: son aktif Super Admin de korunur.
  const selfLockTooltip = isSelf ? t("users.self_action_lock_tooltip") : undefined;
  const lastSaTooltip = isLastSuperAdmin
    ? t("users.super_admin_last_tooltip")
    : undefined;
  const deleteLocked = isSelf || isLastSuperAdmin;
  const deactivateLocked = (isSelf || isLastSuperAdmin) && user.is_active;
  const deleteTooltip = isSelf ? selfLockTooltip : lastSaTooltip;
  const deactivateTooltip = isSelf ? selfLockTooltip : lastSaTooltip;
  if (!canEdit && !canResetPassword && !canToggleActive && !canDelete) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("users.actions_aria")}
          disabled={disabled}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            {t("users.action_edit")}
          </DropdownMenuItem>
        )}
        {canResetPassword && (
          <DropdownMenuItem onSelect={onResetPassword}>
            {neverLoggedIn ? <Send /> : <KeyRound />}
            {neverLoggedIn
              ? t("users.action_resend_invite")
              : t("users.action_reset_password")}
          </DropdownMenuItem>
        )}
        {canToggleActive && (
          <DropdownMenuItem
            onSelect={onToggleActive}
            disabled={deactivateLocked}
            title={deactivateLocked ? deactivateTooltip : undefined}
          >
            {user.is_active ? <UserX /> : <UserCheck />}
            {user.is_active
              ? t("users.action_deactivate")
              : t("users.action_activate")}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={onDelete}
              disabled={deleteLocked}
              title={deleteLocked ? deleteTooltip : undefined}
            >
              <Trash2 />
              {t("users.action_delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserTableSkeleton() {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="size-10 shrink-0 rounded-full bg-muted/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 rounded bg-muted/40 animate-pulse" />
            <div className="h-3 w-56 rounded bg-muted/30 animate-pulse" />
          </div>
          <div className="hidden h-5 w-20 rounded-full bg-muted/40 animate-pulse sm:block" />
          <div className="hidden h-5 w-16 rounded-full bg-muted/40 animate-pulse md:block" />
          <div className="hidden h-3 w-24 rounded bg-muted/30 animate-pulse lg:block" />
          <div className="size-7 rounded-md bg-muted/30 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function UsersEmptyState({ onInvite }: { onInvite: () => void }) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        <UsersIcon className="size-7" />
      </div>
      <p className="text-base font-semibold text-foreground">
        {t("users.empty_title")}
      </p>
      <p className="max-w-sm text-sm text-text-muted">
        {t("users.empty_body")}
      </p>
      <Button onClick={onInvite} className="mt-3 gap-1.5">
        <Plus className="size-4" />
        {t("users.empty_cta")}
      </Button>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="rounded-full bg-muted p-3 text-text-muted">
        <Search className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {t("users.no_filtered_users")}
      </p>
      <p className="text-xs text-text-muted">{t("users.try_clear_filters")}</p>
      <Button variant="outline" size="sm" onClick={onClear} className="mt-2 gap-1.5">
        <XClose className="size-3.5" />
        {t("users.clear_filters")}
      </Button>
    </div>
  );
}

/* ---------- Roles tab helpers ---------- */

function RoleIconTile({
  color,
  isSystem,
}: {
  color?: string | null;
  isSystem: boolean;
}) {
  // Renkli kutucuk — color varsa onu, yoksa neutral
  if (color) {
    return (
      <span
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}1f`, color: color }}
      >
        <ShieldCheck className="size-4" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
        isSystem
          ? "bg-primary/10 text-primary"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      )}
    >
      <ShieldCheck className="size-4" />
    </span>
  );
}

function RoleActionsMenu({
  role,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
}: {
  role: RoleListItem;
  canEdit: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("admin");
  // Sistem rolü (Süper Admin) düzenlenemez/silinemez — yalnızca görüntülenir.
  const isSystem = role.is_system;
  const showEdit = canEdit && !isSystem;
  const showDelete = canDelete && !isSystem;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("users.actions_aria")}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onView}>
          <Eye />
          {t("roles.action_view")}
        </DropdownMenuItem>
        {showEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            {t("users.action_edit")}
          </DropdownMenuItem>
        )}
        {showDelete && <DropdownMenuSeparator />}
        {showDelete && (
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            {t("users.action_delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RolesTableSkeleton() {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="size-9 shrink-0 rounded-lg bg-muted/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-muted/40 animate-pulse" />
            <div className="h-3 w-56 rounded bg-muted/30 animate-pulse" />
          </div>
          <div className="hidden h-5 w-12 rounded-full bg-muted/40 animate-pulse sm:block" />
          <div className="hidden h-3 w-8 rounded bg-muted/30 animate-pulse md:block" />
          <div className="size-7 rounded-md bg-muted/30 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function RolesEmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        <ShieldCheck className="size-7" />
      </div>
      <p className="text-base font-semibold text-foreground">
        {t("roles.empty_title")}
      </p>
      <p className="max-w-sm text-sm text-text-muted">
        {t("roles.empty_body")}
      </p>
      <Button onClick={onCreate} className="mt-3 gap-1.5">
        <Plus className="size-4" />
        {t("roles.empty_cta")}
      </Button>
    </div>
  );
}

function UserCreateForm({
  roles,
  onSubmit,
  loading,
}: {
  roles: RoleListItem[];
  onSubmit: (p: {
    email: string;
    first_name: string;
    last_name: string;
    role_id: number;
  }) => void;
  loading: boolean;
}) {
  const { t } = useTranslation("admin");
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  // Default: ilk non-system rol; yoksa Süper Admin (id 1)
  const [roleId, setRoleId] = useState<string>(() => {
    const nonSystem = roles.find((r) => !r.is_system);
    return String(nonSystem?.id ?? roles[0]?.id ?? 1);
  });

  const selectedRole = roles.find((r) => String(r.id) === roleId);
  const canSubmit = email.trim() && first.trim() && last.trim() && roleId;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          email,
          first_name: first,
          last_name: last,
          role_id: Number(roleId),
        });
      }}
      className="space-y-5"
    >
      <FormField
        label={t("users.field_email")}
        htmlFor="email"
        required
        hint={t("users.invite_email_hint")}
      >
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@sporthink.com.tr"
            required
            autoComplete="off"
            className="h-10 pl-9"
          />
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("users.field_first_name")} htmlFor="first" required>
          <Input
            id="first"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="Ahmet"
            required
            className="h-10"
          />
        </FormField>
        <FormField label={t("users.field_last_name")} htmlFor="last" required>
          <Input
            id="last"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder="Demir"
            required
            className="h-10"
          />
        </FormField>
      </div>

      <FormField label={t("users.field_role")} required>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: r.color ?? "#94a3b8" }}
                  />
                  {r.is_system && <ShieldCheck className="size-3 text-primary" />}
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-text-muted">
                    {t("users.permission_count", { count: r.permission_count })}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRole && (
          <div
            className="mt-2 rounded-lg border bg-surface-2 px-3 py-2"
            style={{
              borderColor: `${selectedRole.color ?? "var(--border)"}40`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
              {t("users.role_about")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {selectedRole.description ?? t("users.no_description")}
            </p>
          </div>
        )}
      </FormField>

      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <p className="inline-flex items-start gap-2 text-[11px] text-text-muted">
          <Send className="mt-0.5 size-3 shrink-0 text-primary" />
          <span>{t("users.invite_footer_note")}</span>
        </p>
      </div>

      <DialogFooter className="border-t border-border pt-4">
        <Button type="submit" disabled={loading || !canSubmit} className="gap-1.5">
          {loading && <Loader2 className="size-4 animate-spin" />}
          <Send className="size-4" />
          {t("users.invite_submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Modal/dialog form alanı yardımcı componenti — label + required (*) + hint. */
function FormField({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}

function UserEditForm({
  user,
  roles,
  isLastSuperAdmin,
  isSelf,
  onSubmit,
  onResetPassword,
  loading,
  resetLoading,
}: {
  user: UserListItem;
  roles: RoleListItem[];
  isLastSuperAdmin: boolean;
  isSelf: boolean;
  onSubmit: (p: {
    first_name?: string;
    last_name?: string;
    role_id?: number;
  }) => void;
  onResetPassword: () => void;
  loading: boolean;
  resetLoading: boolean;
}) {
  const { t } = useTranslation(["admin", "common"]);
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [roleId, setRoleId] = useState<string>(String(user.role_id));

  const dirty =
    first !== user.first_name ||
    last !== user.last_name ||
    Number(roleId) !== user.role_id;

  // Pattern A: kullanıcı kendi rolünü admin panelinden değiştiremez.
  // Pattern C: son Super Admin'in rolü değiştirilemez.
  const isCurrentlySuperAdmin = user.role?.is_system === true;
  const roleSelectDisabled = isSelf || isLastSuperAdmin;
  const newRole = roles.find((r) => String(r.id) === roleId);
  const willDemote = isCurrentlySuperAdmin && newRole?.is_system === false;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ef">{t("admin:users.field_first_name")}</Label>
          <Input
            id="ef"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="el">{t("admin:users.field_last_name")}</Label>
          <Input
            id="el"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("admin:users.field_role")}</Label>
        <Select value={roleId} onValueChange={setRoleId} disabled={roleSelectDisabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                <div className="flex items-center gap-2">
                  {r.is_system && <ShieldCheck className="h-3 w-3" />}
                  {r.name}
                  <span className="text-xs text-muted-foreground">
                    {t("admin:users.permission_count", { count: r.permission_count })}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSelf ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {t("admin:users.self_role_lock")}
          </p>
        ) : isLastSuperAdmin ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {t("admin:users.super_admin_last_lock")}
          </p>
        ) : isCurrentlySuperAdmin ? (
          <p className="text-xs text-muted-foreground">
            {t("admin:users.system_role_warning")}
          </p>
        ) : null}
        {willDemote && !isLastSuperAdmin && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              {t("admin:users.super_admin_demote_danger", {
                name: `${user.first_name} ${user.last_name}`,
              })}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResetPassword}
          disabled={resetLoading}
        >
          {resetLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4 mr-2" />
          )}
          {t("admin:users.reset_password")}
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          {t("admin:users.reset_password_hint")}
        </p>
      </div>

      <DialogFooter>
        <Button
          onClick={() =>
            onSubmit({
              first_name: first !== user.first_name ? first : undefined,
              last_name: last !== user.last_name ? last : undefined,
              role_id:
                Number(roleId) !== user.role_id ? Number(roleId) : undefined,
            })
          }
          disabled={!dirty || loading}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("common:save")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function EmailSentNotice({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("admin");
  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("users.field_email")}</Label>
          <code className="block bg-muted/50 p-2 rounded text-sm font-mono">
            {email}
          </code>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("users.email_sent_hint")}
        </p>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>{t("users.ok")}</Button>
      </DialogFooter>
    </>
  );
}

/* ====================================================================== */
/*  ROLLER TAB                                                              */
/* ====================================================================== */

function RolesTab() {
  const { t } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("roles.create");
  const canUpdate = has("roles.update");
  const canDelete = has("roles.delete");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleListItem | null>(null);
  const [viewRole, setViewRole] = useState<RoleListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RoleListItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["roles", "list"],
    queryFn: () => adminApi.listRoles(),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (p: {
      name: string;
      description?: string;
      color?: string;
      permissions: string[];
    }) => adminApi.createRole(p),
    onSuccess: () => {
      setCreateOpen(false);
      setErrorMsg(null);
      void qc.invalidateQueries({ queryKey: ["roles", "list"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : t("admin:roles.error_create_failed")),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        name?: string;
        description?: string;
        color?: string;
        permissions?: string[];
      };
    }) => adminApi.updateRole(id, payload),
    onSuccess: () => {
      setEditRole(null);
      setErrorMsg(null);
      void qc.invalidateQueries({ queryKey: ["roles", "list"] });
      void qc.invalidateQueries({ queryKey: ["roles", "detail"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : t("admin:roles.error_update_failed")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteRole(id),
    onSuccess: (data) => {
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["roles", "list"] });
      void qc.invalidateQueries({ queryKey: ["users", "list"] });
      if (data.deactivated_users > 0) {
        setErrorMsg(
          t("admin:roles.deleted_with_deactivations", {
            count: data.deactivated_users,
          }),
        );
      }
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : t("admin:roles.error_delete_failed")),
  });

  // Search + stats
  const [search, setSearch] = useState("");
  const allRoles = useMemo(() => q.data ?? [], [q.data]);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    if (!lower) return allRoles;
    return allRoles.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        (r.description ?? "").toLowerCase().includes(lower),
    );
  }, [allRoles, search]);

  const stats = useMemo(() => {
    const total = allRoles.length;
    const system = allRoles.filter((r) => r.is_system).length;
    const assignments = allRoles.reduce((sum, r) => sum + r.user_count, 0);
    return { total, system, custom: total - system, assignments };
  }, [allRoles]);

  return (
    <>
      {/* Açıklama bandı */}
      <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="inline-flex items-start gap-2 text-sm text-text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{t("admin:roles.subtitle")}</span>
        </p>
      </div>

      {/* İstatistik kartları */}
      {!q.isPending && allRoles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <RoleStatCard
            icon={ShieldCheck}
            label={t("admin:roles.stat_total")}
            value={stats.total}
            tone="primary"
          />
          <RoleStatCard
            icon={Lock}
            label={t("admin:roles.stat_system")}
            value={stats.system}
            tone="error"
          />
          <RoleStatCard
            icon={KeyRound}
            label={t("admin:roles.stat_custom")}
            value={stats.custom}
            tone="info"
          />
          <RoleStatCard
            icon={UsersIcon}
            label={t("admin:roles.stat_assignments")}
            value={stats.assignments}
            tone="success"
          />
        </div>
      )}

      {/* Filter + Yeni rol */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin:roles.search_placeholder")}
            className="h-10 pl-9"
          />
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="ml-auto gap-1.5">
            <Plus className="size-4" />
            {t("admin:roles.new_role")}
          </Button>
        )}
      </div>

      {errorMsg && (
        <Alert>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {q.isPending ? (
            <RolesTableSkeleton />
          ) : filtered.length === 0 ? (
            allRoles.length === 0 ? (
              <RolesEmptyState onCreate={() => setCreateOpen(true)} />
            ) : (
              <FilteredEmptyState onClear={() => setSearch("")} />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                    <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:roles.table_role")}
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:roles.table_users")}
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:roles.table_permissions")}
                    </TableHead>
                    <TableHead className="w-12 text-right text-[11px] uppercase tracking-wider text-text-dim">
                      {t("admin:users.table_actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer border-b border-border/40 last:border-b-0 hover:bg-muted/40"
                      onClick={() => setViewRole(r)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-start gap-3">
                          <RoleIconTile color={r.color} isSystem={r.is_system} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {r.name}
                              </p>
                              {r.is_system ? (
                                <StatusBadge tone="error" size="sm">
                                  <ShieldCheck className="size-2.5" />
                                  {t("admin:roles.type_system")}
                                </StatusBadge>
                              ) : (
                                <StatusBadge tone="neutral" size="sm">
                                  {t("admin:roles.type_custom")}
                                </StatusBadge>
                              )}
                            </div>
                            <p
                              className={cn(
                                "mt-0.5 line-clamp-1 text-xs",
                                r.description ? "text-text-muted" : "text-text-dim",
                              )}
                              title={r.description ?? undefined}
                            >
                              {r.description ?? t("admin:users.no_description")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.user_count > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-600 dark:bg-success-500/15 dark:text-success-500">
                            <UsersIcon className="size-3" />
                            {r.user_count.toLocaleString("tr-TR")}
                          </span>
                        ) : (
                          <span className="text-xs text-text-dim">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-text-muted">
                        {r.permission_count}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RoleActionsMenu
                          role={r}
                          canEdit={canUpdate}
                          canDelete={canDelete}
                          onView={() => setViewRole(r)}
                          onEdit={() => setEditRole(r)}
                          onDelete={() => setPendingDelete(r)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE / EDIT Dialog */}
      <Dialog
        open={createOpen || editRole !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditRole(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <span
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                style={
                  editRole?.color
                    ? {
                        background: `${editRole.color}1f`,
                        color: editRole.color,
                      }
                    : undefined
                }
              >
                <ShieldCheck className="size-5" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-semibold">
                  {editRole
                    ? t("admin:roles.edit_role_title", { name: editRole.name })
                    : t("admin:roles.new_role_title")}
                </span>
                <DialogDescription className="text-xs font-normal">
                  {editRole
                    ? t("admin:roles.edit_role_subtitle")
                    : t("admin:roles.new_role_subtitle")}
                </DialogDescription>
              </span>
            </DialogTitle>
          </DialogHeader>
          <RoleForm
            roleId={editRole?.id ?? null}
            onSubmit={(p) => {
              if (editRole) {
                updateRoleMut.mutate({ id: editRole.id, payload: p });
              } else {
                createMut.mutate(p);
              }
            }}
            loading={createMut.isPending || updateRoleMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* DELETE confirm */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:roles.delete_title")}</DialogTitle>
            <DialogDescription>
              <strong>{pendingDelete?.name}</strong>{" "}
              {t("admin:roles.delete_description_users")}{" "}
              <strong>
                {t("admin:roles.delete_description_users_count", {
                  count: pendingDelete?.user_count ?? 0,
                })}
              </strong>{" "}
              <strong>{t("admin:roles.delete_description_action")}</strong>{" "}
              {t("admin:roles.delete_description_suffix")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("admin:roles.delete_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ROL DETAY (salt-okunur izin matrisi) */}
      <RoleDetailSheet
        role={viewRole}
        onClose={() => setViewRole(null)}
        canEdit={canUpdate}
        onEdit={(r) => {
          setViewRole(null);
          setEditRole(r);
        }}
      />
    </>
  );
}

/** Roller sekmesi üst istatistik kartı. */
function RoleStatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "primary" | "error" | "info" | "success";
}) {
  const toneClass: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
    info: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    success:
      "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
            toneClass[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none tabular-nums text-foreground">
            {value.toLocaleString("tr-TR")}
          </p>
          <p className="mt-1 truncate text-xs text-text-muted">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Rol detay paneli — sağdan açılan drawer. Rolün meta bilgisi + kategori
 * bazlı salt-okunur izin matrisi. Sistem rolü için "tam yetki" rozeti gösterir.
 */
function RoleDetailSheet({
  role,
  onClose,
  canEdit,
  onEdit,
}: {
  role: RoleListItem | null;
  onClose: () => void;
  canEdit: boolean;
  onEdit: (role: RoleListItem) => void;
}) {
  const { t, i18n } = useTranslation(["admin", "common"]);

  // Detay (izin kodları) backend'den; liste item'ı izin kodu taşımaz.
  const detailQuery = useQuery({
    queryKey: ["roles", "detail", role?.id],
    queryFn: () => adminApi.getRole(role!.id),
    enabled: role !== null,
  });

  return (
    <Sheet open={role !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        {role && (
          <>
            <SheetHeader className="border-b border-border p-5">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex size-11 shrink-0 items-center justify-center rounded-xl",
                    !role.color && "bg-primary/10 text-primary",
                  )}
                  style={
                    role.color
                      ? { background: `${role.color}1f`, color: role.color }
                      : undefined
                  }
                >
                  <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <span className="truncate">{role.name}</span>
                    {role.is_system ? (
                      <StatusBadge tone="error" size="sm">
                        <Lock className="size-2.5" />
                        {t("admin:roles.type_system")}
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral" size="sm">
                        {t("admin:roles.type_custom")}
                      </StatusBadge>
                    )}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-left">
                    {role.description ?? t("admin:users.no_description")}
                  </SheetDescription>
                </div>
              </div>

              {/* Meta satırı: kullanıcı sayısı + izin sayısı + güncelleme */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <RoleDetailMeta
                  label={t("admin:roles.table_users")}
                  value={role.user_count.toLocaleString("tr-TR")}
                />
                <RoleDetailMeta
                  label={t("admin:roles.table_permissions")}
                  value={role.permission_count.toLocaleString("tr-TR")}
                />
                <RoleDetailMeta
                  label={t("admin:roles.detail_updated")}
                  value={dayjs
                    .utc(role.updated_at)
                    .locale(i18n.language)
                    .fromNow()}
                />
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-5">
              {role.is_system && (
                <Alert className="mb-4">
                  <AlertDescription className="flex items-start gap-2">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-text-muted" />
                    <span>{t("admin:roles.detail_system_note")}</span>
                  </AlertDescription>
                </Alert>
              )}

              {detailQuery.isPending ? (
                <div className="py-12 text-center text-text-muted">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </div>
              ) : (
                <RolePermissionMatrix
                  granted={detailQuery.data?.permissions ?? []}
                  isSystem={role.is_system}
                />
              )}
            </div>

            {canEdit && !role.is_system && (
              <div className="border-t border-border p-4">
                <Button
                  className="w-full gap-1.5"
                  onClick={() => onEdit(role)}
                >
                  <Pencil className="size-4" />
                  {t("admin:roles.action_edit_permissions")}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RoleDetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <p className="truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-text-dim">
        {label}
      </p>
    </div>
  );
}

/** Önceden tanımlı rol renk paleti — kullanıcı serbest hex de girebilir
 * ama bu paletten seçim hızlı ve uyumlu görünüm verir. */
const ROLE_COLOR_PRESETS = [
  "#E63946", // rose (Süper Admin tonu)
  "#2563EB", // blue
  "#12B76A", // green
  "#F79009", // amber
  "#7A5AF8", // purple
  "#0891B2", // cyan
  "#EE46BC", // pink
  "#667085", // gray
] as const;

function RoleForm({
  roleId,
  onSubmit,
  loading,
}: {
  roleId: number | null;
  onSubmit: (p: {
    name: string;
    description?: string;
    color?: string;
    permissions: string[];
  }) => void;
  loading: boolean;
}) {
  const { t } = useTranslation("admin");
  // Edit modunda backend'den rol detayını çek
  const detailQuery = useQuery({
    queryKey: ["roles", "detail", roleId],
    queryFn: () => adminApi.getRole(roleId!),
    enabled: roleId !== null,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(ROLE_COLOR_PRESETS[0]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Detail yüklendikten sonra form'u doldur
  if (detailQuery.data && !initialized) {
    setName(detailQuery.data.name);
    setDescription(detailQuery.data.description ?? "");
    setColor(detailQuery.data.color ?? ROLE_COLOR_PRESETS[0]);
    setPermissions(detailQuery.data.permissions);
    setInitialized(true);
  }

  if (roleId !== null && detailQuery.isPending) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="size-6 animate-spin mx-auto text-text-muted" />
      </div>
    );
  }

  const isEdit = roleId !== null;
  const totalPerms = permissions.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          description: description || undefined,
          color,
          permissions,
        });
      }}
      className="space-y-5"
    >
      {/* Section 1: Rol Bilgileri */}
      <SectionShell
        icon={ShieldCheck}
        title={t("roles.section_info")}
        accentColor={color}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t("roles.field_name")} htmlFor="rname" required>
            <Input
              id="rname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("roles.field_name_placeholder")}
              required
              className="h-10"
            />
          </FormField>
          <FormField label={t("roles.field_description")} htmlFor="rdesc">
            <Textarea
              id="rdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("roles.field_description_placeholder")}
              rows={2}
              className="resize-none"
            />
          </FormField>
        </div>

        {/* Color picker */}
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm font-medium">
              {t("roles.field_color")}
            </Label>
            <span className="text-[11px] text-text-dim">
              {t("roles.color_hint")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ROLE_COLOR_PRESETS.map((c) => {
              const isActive = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={isActive}
                  className={cn(
                    "relative size-8 rounded-full transition-all",
                    isActive ? "ring-2 ring-offset-2 ring-offset-background" : "hover:scale-110",
                  )}
                  style={{
                    background: c,
                    boxShadow: isActive ? `0 0 0 2px ${c}` : undefined,
                  }}
                >
                  {isActive && (
                    <Check
                      className="absolute inset-0 m-auto size-4 text-white"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </SectionShell>

      {/* Section 2: İzinler */}
      <SectionShell
        icon={KeyRound}
        title={t("roles.section_permissions")}
        accentColor={color}
        rightContent={
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: `${color}1f`, color: color }}
          >
            <Check className="size-3" />
            {t("roles.permissions_selected", { count: totalPerms })}
          </span>
        }
      >
        <PermissionPicker
          selected={permissions}
          onChange={setPermissions}
          disabled={loading}
        />
      </SectionShell>

      <DialogFooter className="border-t border-border pt-4">
        <Button
          type="submit"
          disabled={loading || !name}
          className="gap-1.5"
          style={{ background: color, color: "#fff" }}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {isEdit ? t("roles.update_submit") : t("roles.create_submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Modal içi section — başlık + accent renkli ikon + opsiyonel sağ slot.
 *  Border'sız, sadece üst başlık çizgisi ile sade görünüm. */
function SectionShell({
  icon: Icon,
  title,
  accentColor,
  rightContent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accentColor?: string;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: accentColor ? `${accentColor}1f` : "var(--muted)",
              color: accentColor ?? "var(--muted-foreground)",
            }}
          >
            <Icon className="size-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {rightContent}
      </header>
      {children}
    </section>
  );
}
