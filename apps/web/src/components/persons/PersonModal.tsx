'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { PersonFormFields } from './PersonFormFields';
import { createClient } from '../../lib/supabase/client';
import {
  CreatePersonSchema,
  type PersonTypeCode,
  type IdDocumentType,
  type PersonItem,
} from '@workflow/shared';
import { Search, AlertCircle, Building2, User } from 'lucide-react';

interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (person: PersonItem) => void;
}

export const PersonModal: React.FC<PersonModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [personType, setPersonType] = useState<PersonTypeCode>('NATURAL');
  const [docType, setDocType] = useState<IdDocumentType>('DNI');
  const [docNumber, setDocNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [secondLastName, setSecondLastName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const handleTypeChange = (type: PersonTypeCode) => {
    setPersonType(type);
    setDocType(type === 'NATURAL' ? 'DNI' : 'RUC');
    setErrors({});
  };

  const getFormPayload = () => ({
    person_type: personType,
    identity_document_type: docType,
    identity_document_number: docNumber.trim(),
    first_name: personType === 'NATURAL' ? firstName.trim() : null,
    last_name: personType === 'NATURAL' ? lastName.trim() : null,
    second_last_name: personType === 'NATURAL' ? secondLastName.trim() || null : null,
    legal_name: personType === 'JURIDICA' ? legalName.trim() : null,
    trade_name: personType === 'JURIDICA' ? tradeName.trim() || null : null,
    email: email.trim() || null,
    phone: phone.trim() || null,
    address: address.trim() || null,
  });

  const validatePayload = (payload: ReturnType<typeof getFormPayload>) => {
    const res = CreatePersonSchema.safeParse(payload);
    if (!res.success) {
      const fieldErrors: Record<string, string> = {};
      res.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const executeInsert = async (payload: ReturnType<typeof getFormPayload>) => {
    const supabase = createClient();
    const personId = crypto.randomUUID();
    const newPerson: PersonItem = {
      id: personId,
      ...payload,
      marital_status: null,
      nationality: 'PERUANA',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as PersonItem;

    const { error } = await supabase.from('persons').insert({
      id: newPerson.id,
      person_type: newPerson.person_type,
      identity_document_type: newPerson.identity_document_type,
      identity_document_number: newPerson.identity_document_number,
      first_name: newPerson.first_name,
      last_name: newPerson.last_name,
      second_last_name: newPerson.second_last_name,
      legal_name: newPerson.legal_name,
      trade_name: newPerson.trade_name,
      email: newPerson.email,
      phone: newPerson.phone,
      address: newPerson.address,
    });
    if (error) throw error;
    onSaved(newPerson);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');
    const payload = getFormPayload();
    if (!validatePayload(payload)) return;

    setIsSubmitting(true);
    try {
      await executeInsert(payload);
    } catch (err: unknown) {
      setGeneralError((err as Error).message || 'Error al guardar persona');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Nueva Persona" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {generalError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('NATURAL')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
              personType === 'NATURAL'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
            }`}
          >
            <User className="w-4 h-4" /> Persona Natural
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('JURIDICA')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
              personType === 'JURIDICA'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
            }`}
          >
            <Building2 className="w-4 h-4" /> Persona Jurídica
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            id="f-doc-type"
            label="Tipo Doc."
            required
            error={errors.identity_document_type}
          >
            <select
              id="f-doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as IdDocumentType)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {personType === 'NATURAL' ? (
                <>
                  <option value="DNI">DNI (Perú)</option>
                  <option value="CE">Carné Extranjería</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </>
              ) : (
                <option value="RUC">RUC (SUNAT)</option>
              )}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              id="f-doc-number"
              label="N.º Documento"
              required
              error={errors.identity_document_number}
            >
              <div className="flex gap-2">
                <input
                  id="f-doc-number"
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder={docType === 'DNI' ? '8 dígitos' : '11 dígitos'}
                  maxLength={docType === 'DNI' ? 8 : docType === 'RUC' ? 11 : 20}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
                />
                <button
                  type="button"
                  disabled
                  title="Consulta externa habilitada en Sprint 9 (APIINTI)"
                  className="px-3 py-2 rounded-lg border border-border bg-muted/50 text-muted-foreground text-xs flex items-center gap-1.5 cursor-not-allowed opacity-60"
                >
                  <Search className="w-3.5 h-3.5" /> <span>Validar</span>
                </button>
              </div>
            </FormField>
          </div>
        </div>

        <PersonFormFields
          personType={personType}
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          secondLastName={secondLastName}
          setSecondLastName={setSecondLastName}
          legalName={legalName}
          setLegalName={setLegalName}
          tradeName={tradeName}
          setTradeName={setTradeName}
          errors={errors}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
          <FormField id="f-email" label="Correo Electrónico" error={errors.email}>
            <input
              id="f-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@ejemplo.pe"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            />
          </FormField>
          <FormField id="f-phone" label="Teléfono / Celular" error={errors.phone}>
            <input
              id="f-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="987654321"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            />
          </FormField>
        </div>

        <FormField id="f-address" label="Dirección Domiciliaria / Fiscal" error={errors.address}>
          <input
            id="f-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Av. Larco 123, Miraflores, Lima"
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-card text-foreground text-xs hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Registrar Persona'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
