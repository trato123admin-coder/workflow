'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { FormField } from '../../components/ui/FormField';
import { createClient } from '../../lib/supabase/client';
import {
  Users,
  ShieldCheck,
  Plus,
  Shield,
  KeyRound,
  LogOut,
  Lock,
  Check,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import {
  CreateUserSchema,
  CreateRoleSchema,
  MODULE_NAMES,
  type PermissionCode,
} from '@workflow/shared';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  last_sign_in_at: string | null;
  roles: { id: string; code: string; name: string; is_superuser: boolean }[];
  mfa_enabled: boolean;
  assigned_cases_count?: number;
}

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_superuser: boolean;
  requires_mfa: boolean;
  is_active: boolean;
  permissions: string[];
}

interface PermissionCatalogItem {
  id: string;
  code: PermissionCode;
  module: string;
  description: string;
}

interface DbProfileResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  last_sign_in_at: string | null;
  user_roles: {
    roles: {
      id: string;
      code: string;
      name: string;
      is_superuser: boolean;
    } | null;
  }[];
}

interface DbRoleResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_superuser: boolean;
  requires_mfa: boolean;
  is_active: boolean;
  role_permissions: {
    permissions: {
      code: string;
    } | null;
  }[];
}

export default function UsersManagementPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<RoleItem | null>(null);

  // New user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>([]);
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // New role form state
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleRequiresMfa, setNewRoleRequiresMfa] = useState(false);
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const supabase = createClient();

      // 1. Fetch profiles & user_roles
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select(`
          id,
          email,
          first_name,
          last_name,
          is_active,
          last_sign_in_at,
          user_roles!user_id (
            roles (
              id,
              code,
              name,
              is_superuser
            )
          )
        `);

      if (profilesError) throw profilesError;

      // 2. Fetch roles and permissions
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select(
          `
          id,
          code,
          name,
          description,
          is_system,
          is_superuser,
          requires_mfa,
          is_active,
          role_permissions (
            permissions (
              code
            )
          )
        `,
        )
        .order('is_system', { ascending: false });

      if (rolesError) throw rolesError;

      // 3. Fetch canonical permissions
      const { data: permsData, error: permsError } = await supabase
        .from('permissions')
        .select('id, code, module, description')
        .order('module');

      if (permsError) throw permsError;

      const typedRolesData = (rolesData || []) as unknown as DbRoleResponse[];
      const formattedRoles: RoleItem[] = typedRolesData.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        is_system: r.is_system,
        is_superuser: r.is_superuser,
        requires_mfa: r.requires_mfa,
        is_active: r.is_active,
        permissions: (r.role_permissions || [])
          .map((rp) => rp.permissions?.code)
          .filter((code): code is string => Boolean(code)),
      }));

      const typedProfilesData = (profilesData || []) as unknown as DbProfileResponse[];
      const formattedUsers: UserProfile[] = typedProfilesData.map((p) => {
        const userRolesList = (p.user_roles || [])
          .map((ur) => ur.roles)
          .filter((r): r is NonNullable<typeof r> => Boolean(r));

        return {
          id: p.id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          is_active: p.is_active,
          last_sign_in_at: p.last_sign_in_at,
          roles: userRolesList,
          mfa_enabled: userRolesList.some((r) => r.is_superuser), // In Sprint 1, admins require MFA
          assigned_cases_count: 0,
        };
      });

      setRoles(formattedRoles);
      setUsers(formattedUsers);
      setPermissions(permsData || []);

      if (formattedRoles.length > 0 && !selectedRoleForMatrix) {
        setSelectedRoleForMatrix(formattedRoles[0]);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error al cargar datos de usuarios y roles',
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoleForMatrix]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle user active status
  const handleToggleUserActive = async (user: UserProfile) => {
    const supabase = createClient();
    const nextStatus = !user.is_active;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: nextStatus })
        .eq('id', user.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(`Usuario ${nextStatus ? 'activado' : 'desactivado'} con éxito.`);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: nextStatus } : u)));
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al actualizar usuario');
    }
  };

  // Submit new user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormErrors({});

    const validation = CreateUserSchema.safeParse({
      email: newUserEmail,
      firstName: newUserFirstName,
      lastName: newUserLastName,
      roleIds: newUserRoles,
    });

    if (!validation.success) {
      const errMap: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        errMap[String(err.path[0])] = err.message;
      });
      setUserFormErrors(errMap);
      return;
    }

    setIsSubmittingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          firstName: newUserFirstName,
          lastName: newUserLastName,
          roleIds: newUserRoles,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      setSuccessMessage(`Usuario ${newUserEmail} creado con éxito.`);
      setIsNewUserModalOpen(false);
      setNewUserEmail('');
      setNewUserFirstName('');
      setNewUserLastName('');
      setNewUserRoles([]);
      loadData();
    } catch (err: unknown) {
      setUserFormErrors({ general: err instanceof Error ? err.message : 'Error al crear usuario' });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Toggle permission in matrix for selected role
  const handleTogglePermission = async (permCode: string) => {
    if (!selectedRoleForMatrix || selectedRoleForMatrix.is_superuser) return;

    const supabase = createClient();
    const hasPerm = selectedRoleForMatrix.permissions.includes(permCode);
    const permRecord = permissions.find((p) => p.code === permCode);
    if (!permRecord) return;

    try {
      if (hasPerm) {
        // Remove
        await supabase
          .from('role_permissions')
          .delete()
          .match({ role_id: selectedRoleForMatrix.id, permission_id: permRecord.id });
      } else {
        // Add
        await supabase
          .from('role_permissions')
          .insert({ role_id: selectedRoleForMatrix.id, permission_id: permRecord.id });
      }

      // Update state locally
      const updatedPerms = hasPerm
        ? selectedRoleForMatrix.permissions.filter((p) => p !== permCode)
        : [...selectedRoleForMatrix.permissions, permCode];

      const updatedRole = { ...selectedRoleForMatrix, permissions: updatedPerms };
      setSelectedRoleForMatrix(updatedRole);
      setRoles((prev) => prev.map((r) => (r.id === updatedRole.id ? updatedRole : r)));
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al actualizar permisos del rol');
    }
  };

  // Columns for Users DataTable (Mockup 8)
  const userColumns: Column<UserProfile>[] = [
    {
      id: 'user',
      header: 'Usuario',
      sortable: true,
      accessorKey: 'email',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 shrink-0">
            {(user.first_name || user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-foreground">
              {user.first_name || user.last_name
                ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                : user.email.split('@')[0]}
            </div>
            <div className="text-[11px] text-muted-foreground">{user.email}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      header: 'Perfiles / Roles',
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.length > 0 ? (
            user.roles.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground border border-border"
              >
                {r.name}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-muted-foreground italic">Sin rol asignado</span>
          )}
        </div>
      ),
    },
    {
      id: 'mfa',
      header: 'MFA',
      cell: (user) => (
        <StatusBadge
          category={user.mfa_enabled ? 'success' : 'neutral'}
          label={user.mfa_enabled ? 'Activo' : 'Inactivo'}
          size="sm"
        />
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (user) => (
        <button
          type="button"
          onClick={() => handleToggleUserActive(user)}
          className="group flex items-center gap-2 focus:outline-none"
          title={user.is_active ? 'Click para desactivar' : 'Click para activar'}
        >
          <StatusBadge
            category={user.is_active ? 'success' : 'danger'}
            label={user.is_active ? 'Activo' : 'Inactivo'}
            size="sm"
          />
        </button>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      className: 'text-right',
      cell: (user) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => alert(`Restablecer MFA solicitado para ${user.email}`)}
            title="Restablecer MFA"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => alert(`Cerrar sesiones activas para ${user.email}`)}
            title="Cerrar sesiones activas"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const map: Record<string, PermissionCatalogItem[]> = {};
    permissions.forEach((p) => {
      if (!map[p.module]) map[p.module] = [];
      map[p.module].push(p);
    });
    return map;
  }, [permissions]);

  return (
    <AppShell
      userName="Administrador"
      userRole="Superusuario"
      userEmail="admin@docuai.pe"
      isSuperuser={true}
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Users className="w-6 h-6 text-primary" />
              <span>Gestión de Usuarios y Roles</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Administración de cuentas, autenticación en dos pasos (MFA) y matriz de control de
              acceso.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'users' ? (
              <button
                type="button"
                onClick={() => setIsNewUserModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>Nuevo usuario</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsNewRoleModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo rol</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Feedback Banners */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-xs font-bold hover:underline"
            >
              Cerrar
            </button>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <Tabs
          tabs={[
            { id: 'users', label: 'Usuarios', count: users.length },
            { id: 'roles', label: 'Roles y Permisos', count: roles.length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab 1: Users List (Mockup 8) */}
        {activeTab === 'users' && (
          <DataTable
            data={users}
            columns={userColumns}
            keyExtractor={(u) => u.id}
            isLoading={isLoading}
            searchPlaceholder="Buscar por nombre o correo..."
            searchFilter={(u, q) =>
              u.email.toLowerCase().includes(q.toLowerCase()) ||
              `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q.toLowerCase())
            }
          />
        )}

        {/* Tab 2: Roles and Permissions Matrix */}
        {activeTab === 'roles' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Roles Sidebar */}
            <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
                Roles del Sistema
              </span>
              <div className="space-y-1 pt-2">
                {roles.map((r) => {
                  const isSelected = selectedRoleForMatrix?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoleForMatrix(r)}
                      className={`w-full text-left p-3 rounded-xl text-xs transition-all flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{r.name}</span>
                        {r.is_superuser && (
                          <span title="Superusuario inmutable">
                            <Lock className="w-3.5 h-3.5 opacity-80" />
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] truncate ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`}
                      >
                        {r.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permission Matrix for Selected Role */}
            <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
              {selectedRoleForMatrix ? (
                <>
                  <div className="flex items-start justify-between pb-4 border-b border-border">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">
                          {selectedRoleForMatrix.name}
                        </h2>
                        {selectedRoleForMatrix.is_system && (
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            Sistema
                          </span>
                        )}
                        {selectedRoleForMatrix.requires_mfa && (
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Requiere MFA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedRoleForMatrix.description || 'Sin descripción'}
                      </p>
                    </div>

                    {selectedRoleForMatrix.is_superuser && (
                      <div className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Acceso Total (Superusuario)</span>
                      </div>
                    )}
                  </div>

                  {/* Modules and Permissions List */}
                  <div className="space-y-6">
                    {Object.entries(permissionsByModule).map(([moduleKey, perms]) => (
                      <div key={moduleKey} className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/50 pb-1.5">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          <span>{MODULE_NAMES[moduleKey] || moduleKey}</span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {perms.map((p) => {
                            const isChecked =
                              selectedRoleForMatrix.is_superuser ||
                              selectedRoleForMatrix.permissions.includes(p.code);

                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-3 p-3 rounded-xl border text-xs transition-colors cursor-pointer select-none ${
                                  isChecked
                                    ? 'bg-primary/5 border-primary/30 text-foreground'
                                    : 'border-border hover:bg-muted/40 text-muted-foreground'
                                } ${selectedRoleForMatrix.is_superuser ? 'cursor-not-allowed opacity-90' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={selectedRoleForMatrix.is_superuser}
                                  onChange={() => handleTogglePermission(p.code)}
                                  className="mt-0.5 rounded border-input text-primary focus:ring-primary w-4 h-4"
                                />
                                <div>
                                  <div className="font-semibold text-foreground">{p.code}</div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {p.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  Seleccione un rol de la lista para visualizar su matriz de permisos.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Nuevo Usuario */}
        <Modal
          isOpen={isNewUserModalOpen}
          onClose={() => setIsNewUserModalOpen(false)}
          title="Registrar Nuevo Usuario"
          description="Cree una cuenta para un nuevo colaborador y asígnele los perfiles correspondientes."
        >
          <form onSubmit={handleCreateUser} className="space-y-4">
            {userFormErrors.general && (
              <p className="text-xs text-destructive font-medium">{userFormErrors.general}</p>
            )}

            <FormField
              id="new-user-email"
              label="Correo electrónico"
              error={userFormErrors.email}
              required
            >
              <input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="colaborador@workflow.pe"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="new-user-first"
                label="Nombres"
                error={userFormErrors.firstName}
                required
              >
                <input
                  id="new-user-first"
                  type="text"
                  value={newUserFirstName}
                  onChange={(e) => setNewUserFirstName(e.target.value)}
                  placeholder="Juan"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary"
                />
              </FormField>
              <FormField
                id="new-user-last"
                label="Apellidos"
                error={userFormErrors.lastName}
                required
              >
                <input
                  id="new-user-last"
                  type="text"
                  value={newUserLastName}
                  onChange={(e) => setNewUserLastName(e.target.value)}
                  placeholder="Pérez"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary"
                />
              </FormField>
            </div>

            <FormField
              id="new-user-roles"
              label="Asignar Roles"
              error={userFormErrors.roleIds}
              required
            >
              <div className="space-y-1.5 max-h-48 overflow-y-auto p-1">
                {roles.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={newUserRoles.includes(r.id)}
                      onChange={(e) => {
                        if (e.target.checked) setNewUserRoles([...newUserRoles, r.id]);
                        else setNewUserRoles(newUserRoles.filter((id) => id !== r.id));
                      }}
                      className="rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="font-semibold text-foreground">{r.name}</span>
                    <span className="text-muted-foreground text-[11px]">({r.code})</span>
                  </label>
                ))}
              </div>
            </FormField>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewUserModalOpen(false)}
                className="px-3.5 py-2 text-xs rounded-xl border border-border hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingUser}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmittingUser ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Nuevo Rol */}
        <Modal
          isOpen={isNewRoleModalOpen}
          onClose={() => setIsNewRoleModalOpen(false)}
          title="Crear Rol Personalizado"
          description="Defina un nuevo rol operativo con su código y conjunto de permisos base."
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setRoleFormErrors({});
              const validation = CreateRoleSchema.safeParse({
                code: newRoleCode,
                name: newRoleName,
                description: newRoleDesc,
                requiresMfa: newRoleRequiresMfa,
                permissionCodes: newRolePerms,
              });

              if (!validation.success) {
                const errMap: Record<string, string> = {};
                validation.error.errors.forEach((err) => {
                  errMap[String(err.path[0])] = err.message;
                });
                setRoleFormErrors(errMap);
                return;
              }

              setIsSubmittingRole(true);
              try {
                const supabase = createClient();
                const { data: roleData, error: roleError } = await supabase
                  .from('roles')
                  .insert({
                    code: newRoleCode.toUpperCase(),
                    name: newRoleName,
                    description: newRoleDesc,
                    requires_mfa: newRoleRequiresMfa,
                  })
                  .select()
                  .single();

                if (roleError) throw roleError;

                if (newRolePerms.length > 0 && roleData) {
                  const permRecords = permissions.filter((p) => newRolePerms.includes(p.code));
                  const toInsert = permRecords.map((p) => ({
                    role_id: roleData.id,
                    permission_id: p.id,
                  }));
                  await supabase.from('role_permissions').insert(toInsert);
                }

                setSuccessMessage(`Rol ${newRoleName} creado con éxito.`);
                setIsNewRoleModalOpen(false);
                setNewRoleCode('');
                setNewRoleName('');
                setNewRoleDesc('');
                setNewRolePerms([]);
                loadData();
              } catch (err: unknown) {
                setRoleFormErrors({
                  general: err instanceof Error ? err.message : 'Error al crear rol',
                });
              } finally {
                setIsSubmittingRole(false);
              }
            }}
            className="space-y-4"
          >
            {roleFormErrors.general && (
              <p className="text-xs text-destructive font-medium">{roleFormErrors.general}</p>
            )}

            <FormField
              id="role-code"
              label="Código del rol (Mayúsculas)"
              error={roleFormErrors.code}
              required
            >
              <input
                id="role-code"
                type="text"
                value={newRoleCode}
                onChange={(e) => setNewRoleCode(e.target.value.toUpperCase())}
                placeholder="EJECUTIVO"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground font-mono focus:ring-2 focus:ring-primary"
              />
            </FormField>

            <FormField id="role-name" label="Nombre visible" error={roleFormErrors.name} required>
              <input
                id="role-name"
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ejecutivo Comercial"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary"
              />
            </FormField>

            <FormField id="role-desc" label="Descripción" error={roleFormErrors.description}>
              <input
                id="role-desc"
                type="text"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Gestiona cotizaciones y clientes iniciales"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary"
              />
            </FormField>

            <label className="flex items-center gap-2 p-2 rounded-xl border border-border text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={newRoleRequiresMfa}
                onChange={(e) => setNewRoleRequiresMfa(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span className="font-semibold text-foreground">
                Requiere autenticación en dos pasos (MFA) obligatoria
              </span>
            </label>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewRoleModalOpen(false)}
                className="px-3.5 py-2 text-xs rounded-xl border border-border hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingRole}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmittingRole ? 'Guardando...' : 'Crear Rol'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
