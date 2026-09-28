'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from './supabase/client';
import type {
  CashAccountBalance,
  CashMovement,
  CashRequest,
  CashReconciliation,
  CashPeriod,
} from '@workflow/shared';

interface RolePermCheck {
  roles?: {
    is_superuser?: boolean;
    is_active?: boolean;
    role_permissions?: Array<{ permissions?: { code?: string } | null }>;
  } | null;
}

export interface SaveMovementInput {
  cash_account_id: string;
  movement_type: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT';
  direction: 'IN' | 'OUT';
  amount: number;
  category_code: string;
  description: string;
  reference?: string;
  movement_date: string;
  case_id?: string;
  file?: File;
}

export interface SaveRequestInput {
  amount: number; currency: string; category_code: string; reason: string; case_id?: string;
}

export interface SaveReconciliationInput {
  cash_account_id: string; cash_period_id?: string; reconciliation_date: string;
  period_start: string; period_end: string; system_balance: number; counted_balance: number; observations?: string;
}

export function useCashData() {
  const [balances, setBalances] = useState<CashAccountBalance[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [requests, setRequests] = useState<CashRequest[]>([]);
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>([]);
  const [periods, setPeriods] = useState<CashPeriod[]>([]);
  const [categories, setCategories] = useState<Array<{ code: string; label: string }>>([]);
  const [cases, setCases] = useState<Array<{ id: string; case_number: string; title?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isMfaActive, setIsMfaActive] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canClose, setCanClose] = useState(false);

  const fetchAuthAndPerms = async () => {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;
    setCurrentUserId(authData.user.id);

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setIsMfaActive(aalData?.currentLevel === 'aal2');

    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('roles(is_superuser, is_active, role_permissions(permissions(code)))')
      .eq('user_id', authData.user.id);

    const roleList = (userRoles || []) as unknown as RolePermCheck[];
    let isSuper = false;
    const perms = new Set<string>();
    for (const ur of roleList) {
      if (ur.roles?.is_active) {
        if (ur.roles.is_superuser) isSuper = true;
        ur.roles.role_permissions?.forEach((rp) => {
          if (rp.permissions?.code) perms.add(rp.permissions.code);
        });
      }
    }
    setCanWrite(isSuper || perms.has('cash.write'));
    setCanRequest(isSuper || perms.has('cash.request'));
    setCanApprove(isSuper || perms.has('cash.approve'));
    setCanClose(isSuper || perms.has('cash.close'));
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      await fetchAuthAndPerms();
      const [balRes, movRes, reqRes, recRes, perRes, catRes, caseRes] = await Promise.all([
        supabase.from('cash_account_balances').select('*'),
        supabase.from('cash_movements').select('*').order('movement_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('cash_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('cash_reconciliations').select('*').order('reconciliation_date', { ascending: false }),
        supabase.from('cash_periods').select('*'),
        supabase.from('catalog_items').select('code, label').eq('catalog_code', 'cash_categories').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('cases').select('id, case_number, title').order('case_number', { ascending: false }).limit(50),
      ]);
      if (balRes.error) throw balRes.error;
      setBalances((balRes.data as CashAccountBalance[]) || []);
      setMovements((movRes.data as CashMovement[]) || []);
      setRequests((reqRes.data as CashRequest[]) || []);
      setReconciliations((recRes.data as CashReconciliation[]) || []);
      setPeriods((perRes.data as CashPeriod[]) || []);
      setCategories(catRes.data || []);
      setCases(caseRes.data || []);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al cargar datos de caja chica');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveMovement = async (data: SaveMovementInput) => {
    const supabase = createClient();
    let supportPath: string | null = null;
    if (data.file) {
      const ext = data.file.name.split('.').pop();
      const path = `movements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('cash-support').upload(path, data.file);
      if (uploadErr) throw uploadErr;
      supportPath = path;
    }
    const correlative = `MOV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('cash_movements').insert({
      movement_number: correlative,
      cash_account_id: data.cash_account_id,
      movement_type: data.movement_type,
      direction: data.direction,
      amount: data.amount,
      category_code: data.category_code,
      description: data.description,
      reference: data.reference,
      movement_date: data.movement_date,
      case_id: data.case_id,
      support_document_path: supportPath,
      created_by: currentUserId,
    });
    if (error) throw error;
    await loadData();
  };

  const handleConfirmReversal = async (origId: string, reason: string) => {
    const orig = movements.find((m) => m.id === origId);
    if (!orig) throw new Error('Movimiento no encontrado');
    const supabase = createClient();
    const reverseDir = orig.direction === 'OUT' ? 'IN' : 'OUT';
    const correlative = `REV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('cash_movements').insert({
      movement_number: correlative,
      cash_account_id: orig.cash_account_id,
      movement_type: 'REVERSAL',
      direction: reverseDir,
      amount: orig.amount,
      category_code: orig.category_code,
      description: `Reverso de ${orig.movement_number || orig.id}: ${reason}`,
      reference: orig.reference,
      movement_date: new Date().toISOString().split('T')[0],
      reversal_of: orig.id,
      case_id: orig.case_id,
      created_by: currentUserId,
    });
    if (error) throw error;
    await loadData();
  };

  const handleSaveRequest = async (data: SaveRequestInput) => {
    const supabase = createClient();
    const correlative = `SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('cash_requests').insert({
      request_number: correlative,
      amount: data.amount,
      currency: data.currency,
      category_code: data.category_code,
      reason: data.reason,
      case_id: data.case_id,
      requested_by: currentUserId,
      status: 'PENDING',
    });
    if (error) throw error;
    await loadData();
  };

  const handleApproveRequest = async (reqId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('cash_requests')
      .update({ status: 'APPROVED', approved_by: currentUserId, approved_at: new Date().toISOString() })
      .eq('id', reqId);
    if (error) throw error;
    await loadData();
  };

  const handleRejectRequest = async (reqId: string, reason: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('cash_requests')
      .update({ status: 'REJECTED', approved_by: currentUserId, rejection_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', reqId);
    if (error) throw error;
    await loadData();
  };

  const handleDisburseRequest = async (reqId: string, accountId: string) => {
    const req = requests.find((r) => r.id === reqId);
    if (!req) return;
    const supabase = createClient();
    const correlative = `MOV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error: movErr } = await supabase.from('cash_movements').insert({
      movement_number: correlative,
      cash_account_id: accountId,
      movement_type: 'EXPENSE',
      direction: 'OUT',
      amount: req.amount,
      category_code: req.category_code,
      description: `Desembolso solicitud ${req.request_number}: ${req.reason}`,
      movement_date: new Date().toISOString().split('T')[0],
      case_id: req.case_id,
      request_id: req.id,
      created_by: currentUserId,
    });
    if (movErr) throw movErr;
    const { error: reqErr } = await supabase
      .from('cash_requests')
      .update({ status: 'DISBURSED', disbursed_at: new Date().toISOString() })
      .eq('id', reqId);
    if (reqErr) throw reqErr;
    await loadData();
  };

  const handleSaveReconciliation = async (data: SaveReconciliationInput) => {
    const supabase = createClient();
    const { error } = await supabase.from('cash_reconciliations').insert({
      cash_account_id: data.cash_account_id,
      cash_period_id: data.cash_period_id,
      reconciliation_date: data.reconciliation_date,
      period_start: data.period_start,
      period_end: data.period_end,
      system_balance: data.system_balance,
      counted_balance: data.counted_balance,
      observations: data.observations,
      status: 'SUBMITTED',
      opened_by: currentUserId,
    });
    if (error) throw error;
    await loadData();
  };

  const handleApproveReconciliation = async (recId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('cash_reconciliations')
      .update({ status: 'APPROVED', approved_by: currentUserId, approved_at: new Date().toISOString() })
      .eq('id', recId);
    if (error) throw error;
    await loadData();
  };

  const handleRejectReconciliation = async (recId: string, reason: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('cash_reconciliations')
      .update({ status: 'REJECTED', approved_by: currentUserId, rejection_reason: reason })
      .eq('id', recId);
    if (error) throw error;
    await loadData();
  };

  const handleDownloadSupport = async (path: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from('cash-support').createSignedUrl(path, 60);
    if (error) return alert('No se pudo generar el enlace de descarga del comprobante');
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return {
    balances, movements, requests, reconciliations, periods, categories, cases,
    isLoading, errorMessage, currentUserId, isMfaActive,
    canWrite, canRequest, canApprove, canClose,
    loadData, handleSaveMovement, handleConfirmReversal, handleSaveRequest,
    handleApproveRequest, handleRejectRequest, handleDisburseRequest,
    handleSaveReconciliation, handleApproveReconciliation, handleRejectReconciliation,
    handleDownloadSupport,
  };
}
