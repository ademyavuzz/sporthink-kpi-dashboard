import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PermissionPicker } from "@/components/feature/PermissionPicker";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Kullanıcı & Rol Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Kullanıcıları davet et, rol ata, izinleri yönet.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="roles">Roller</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles" className="space-y-4">
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
  const qc = useQueryClient();
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
      void qc.invalidateQueries({ queryKey: ["users", "list"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : "Kullanıcı oluşturulamadı"),
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
      void qc.invalidateQueries({ queryKey: ["users", "list"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : "Güncelleme başarısız"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["users", "list"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : "Silme başarısız"),
  });

  const resetPwMut = useMutation({
    mutationFn: (id: number) => adminApi.resetUserPassword(id),
    onSuccess: (data) => {
      setEditUser(null);
      setResetResult(data);
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : "Şifre sıfırlama başarısız"),
  });

  const roles = rolesQuery.data ?? [];

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <Label htmlFor="search" className="text-xs">
            Ara (e-posta veya ad)
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ahmet@..."
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rol</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Durum</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">ID</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son Giriş</TableHead>
                <TableHead className="text-right w-32">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground text-sm"
                  >
                    {search || roleFilter !== "all" || statusFilter !== "all"
                      ? "Filtreye uyan kullanıcı yok."
                      : "Henüz kullanıcı yok."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id} className={cn(!u.is_active && "opacity-60")}>
                    <TableCell className="font-mono text-xs">{u.id}</TableCell>
                    <TableCell className="font-mono text-xs">{u.email}</TableCell>
                    <TableCell>
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.is_active}
                          disabled={u.role?.is_system || updateMut.isPending}
                          onCheckedChange={(checked) =>
                            updateMut.mutate({
                              id: u.id,
                              payload: { is_active: checked },
                            })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {u.is_active ? "Aktif" : "Pasif"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_login_at
                        ? dayjs
                            .utc(u.last_login_at)
                            .tz("Europe/Istanbul")
                            .format("DD.MM.YYYY HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditUser(u)}
                          aria-label="Düzenle"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={u.role?.is_system}
                          onClick={() => setPendingDelete(u)}
                          aria-label="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CREATE Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı Davet Et</DialogTitle>
            <DialogDescription>
              Geçici şifre üretilir; kullanıcı ilk girişte değiştirir.
            </DialogDescription>
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
            <DialogTitle>Kullanıcıyı Düzenle</DialogTitle>
            <DialogDescription>
              <code className="text-xs">{editUser?.email}</code>
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <UserEditForm
              user={editUser}
              roles={roles}
              onSubmit={(payload) =>
                updateMut.mutate({ id: editUser.id, payload })
              }
              onResetPassword={() => resetPwMut.mutate(editUser.id)}
              loading={updateMut.isPending}
              resetLoading={resetPwMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* CREATED — temp password */}
      <Dialog
        open={createdUser !== null}
        onOpenChange={(o) => !o && setCreatedUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              Kullanıcı Oluşturuldu
            </DialogTitle>
            <DialogDescription>
              Geçici şifreyi kullanıcıya iletin. Bu şifre tekrar gösterilmez.
            </DialogDescription>
          </DialogHeader>
          {createdUser && (
            <TempPasswordReveal
              email={createdUser.email}
              tempPassword={createdUser.temp_password}
              onClose={() => setCreatedUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* PASSWORD RESET — temp password */}
      <Dialog
        open={resetResult !== null}
        onOpenChange={(o) => !o && setResetResult(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              Şifre Sıfırlandı
            </DialogTitle>
            <DialogDescription>
              Yeni geçici şifre üretildi, tüm aktif oturumlar kapatıldı.
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <TempPasswordReveal
              email={resetResult.email}
              tempPassword={resetResult.temp_password}
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
            <DialogTitle>Kullanıcıyı sil?</DialogTitle>
            <DialogDescription>
              <strong>{pendingDelete?.email}</strong> pasifleştirilecek (soft
              delete). Geri alınabilir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Evet, sil
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
  return (
    <Badge
      variant={role.is_system ? "default" : "secondary"}
      className="font-medium"
    >
      {role.is_system && <ShieldCheck className="h-3 w-3 mr-1" />}
      {role.name}
    </Badge>
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
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  // Default: ilk non-system rol; yoksa Süper Admin (id 1)
  const [roleId, setRoleId] = useState<string>(() => {
    const nonSystem = roles.find((r) => !r.is_system);
    return String(nonSystem?.id ?? roles[0]?.id ?? 1);
  });

  const selectedRole = roles.find((r) => String(r.id) === roleId);

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
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="first">Ad</Label>
          <Input
            id="first"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last">Soyad</Label>
          <Input
            id="last"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Rol</Label>
        <Select value={roleId} onValueChange={setRoleId}>
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
                    ({r.permission_count} izin)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRole && (
          <p className="text-xs text-muted-foreground">
            {selectedRole.description ?? "Açıklama yok"}
          </p>
        )}
      </div>
      <DialogFooter className="pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Davet Et
        </Button>
      </DialogFooter>
    </form>
  );
}

function UserEditForm({
  user,
  roles,
  onSubmit,
  onResetPassword,
  loading,
  resetLoading,
}: {
  user: UserListItem;
  roles: RoleListItem[];
  onSubmit: (p: {
    first_name?: string;
    last_name?: string;
    role_id?: number;
  }) => void;
  onResetPassword: () => void;
  loading: boolean;
  resetLoading: boolean;
}) {
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [roleId, setRoleId] = useState<string>(String(user.role_id));

  const dirty =
    first !== user.first_name ||
    last !== user.last_name ||
    Number(roleId) !== user.role_id;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ef">Ad</Label>
          <Input
            id="ef"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="el">Soyad</Label>
          <Input
            id="el"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Rol</Label>
        <Select
          value={roleId}
          onValueChange={setRoleId}
          disabled={user.role?.is_system}
        >
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
                    ({r.permission_count} izin)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {user.role?.is_system && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Süper Admin'in rolü değiştirilemez.
          </p>
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
          Şifreyi Sıfırla
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          Yeni geçici şifre üretilir; tüm aktif oturumlar kapanır.
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
          Kaydet
        </Button>
      </DialogFooter>
    </div>
  );
}

function TempPasswordReveal({
  email,
  tempPassword,
  onClose,
}: {
  email: string;
  tempPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API yoksa fallback
      const ta = document.createElement("textarea");
      ta.value = tempPassword;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">E-posta</Label>
          <code className="block bg-muted/50 p-2 rounded text-sm font-mono">
            {email}
          </code>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Geçici Şifre</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted/50 p-2 rounded text-sm font-mono select-all">
              {tempPassword}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Tamam</Button>
      </DialogFooter>
    </>
  );
}

/* ====================================================================== */
/*  ROLLER TAB                                                              */
/* ====================================================================== */

function RolesTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleListItem | null>(null);
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
      permissions: string[];
    }) => adminApi.createRole(p),
    onSuccess: () => {
      setCreateOpen(false);
      setErrorMsg(null);
      void qc.invalidateQueries({ queryKey: ["roles", "list"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : "Rol oluşturulamadı"),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { name?: string; description?: string; permissions?: string[] };
    }) => adminApi.updateRole(id, payload),
    onSuccess: () => {
      setEditRole(null);
      setErrorMsg(null);
      void qc.invalidateQueries({ queryKey: ["roles", "list"] });
      void qc.invalidateQueries({ queryKey: ["roles", "detail"] });
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : "Güncelleme başarısız"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteRole(id),
    onSuccess: (data) => {
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["roles", "list"] });
      void qc.invalidateQueries({ queryKey: ["users", "list"] });
      if (data.deactivated_users > 0) {
        setErrorMsg(
          `Rol silindi. ${data.deactivated_users} kullanıcı pasifleştirildi.`,
        );
      }
    },
    onError: (err) =>
      setErrorMsg(err instanceof ApiError ? err.message : "Rol silinemedi"),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Roller, kullanıcıların hangi sayfalara erişebileceğini ve hangi
          işlemleri yapabileceğini belirler.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Rol
        </Button>
      </div>

      {errorMsg && (
        <Alert>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">ID</TableHead>
                <TableHead>Rol Adı</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="text-right">Kullanıcı</TableHead>
                <TableHead className="text-right">İzin</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead className="text-right w-24">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              ) : (
                (q.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {r.is_system && (
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        )}
                        <span className="font-medium">{r.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                      {r.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.user_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.permission_count}
                    </TableCell>
                    <TableCell>
                      {r.is_system ? (
                        <Badge>Sistem</Badge>
                      ) : (
                        <Badge variant="secondary">Özel</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={r.is_system}
                          onClick={() => setEditRole(r)}
                          aria-label="Düzenle"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={r.is_system}
                          onClick={() => setPendingDelete(r)}
                          aria-label="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editRole ? `Rolü Düzenle: ${editRole.name}` : "Yeni Rol"}
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
            <DialogTitle>Rolü sil?</DialogTitle>
            <DialogDescription>
              <strong>{pendingDelete?.name}</strong> rolüne sahip{" "}
              <strong>{pendingDelete?.user_count} kullanıcı</strong>{" "}
              <strong>pasifleştirilecek</strong> ve aktif oturumları
              kapatılacak. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Evet, rolü sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoleForm({
  roleId,
  onSubmit,
  loading,
}: {
  roleId: number | null;
  onSubmit: (p: { name: string; description?: string; permissions: string[] }) => void;
  loading: boolean;
}) {
  // Edit modunda backend'den rol detayını çek
  const detailQuery = useQuery({
    queryKey: ["roles", "detail", roleId],
    queryFn: () => adminApi.getRole(roleId!),
    enabled: roleId !== null,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Detail yüklendikten sonra form'u doldur
  if (detailQuery.data && !initialized) {
    setName(detailQuery.data.name);
    setDescription(detailQuery.data.description ?? "");
    setPermissions(detailQuery.data.permissions);
    setInitialized(true);
  }

  if (roleId !== null && detailQuery.isPending) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, description: description || undefined, permissions });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rname">Rol Adı</Label>
          <Input
            id="rname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="örn: Pazarlama Müdürü"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rdesc">Açıklama (opsiyonel)</Label>
          <Textarea
            id="rdesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bu rolün amacı..."
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>İzinler</Label>
        <PermissionPicker
          selected={permissions}
          onChange={setPermissions}
          disabled={loading}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading || !name}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {roleId ? "Güncelle" : "Oluştur"}
        </Button>
      </DialogFooter>
    </form>
  );
}
