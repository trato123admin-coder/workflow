import { describe, it, expect } from 'vitest';
import { validatePeruvianDni, validatePeruvianRuc, CreatePersonSchema } from '../persons.js';

describe('Peruvian DNI & RUC Validators', () => {
  it('validates correct 8-digit DNI', () => {
    expect(validatePeruvianDni('12345678')).toBe(true);
    expect(validatePeruvianDni('44556677')).toBe(true);
  });

  it('rejects invalid DNIs', () => {
    expect(validatePeruvianDni('1234567')).toBe(false); // 7 digits
    expect(validatePeruvianDni('123456789')).toBe(false); // 9 digits
    expect(validatePeruvianDni('1234567a')).toBe(false); // letters
    expect(validatePeruvianDni('')).toBe(false);
  });

  it('validates official SUNAT RUC using Modulo 11', () => {
    // SUNAT official RUC: 20131312955
    expect(validatePeruvianRuc('20131312955')).toBe(true);
  });

  it('rejects RUC with invalid length, prefix or checksum', () => {
    expect(validatePeruvianRuc('20131312950')).toBe(false); // wrong checksum
    expect(validatePeruvianRuc('30131312955')).toBe(false); // invalid prefix (30)
    expect(validatePeruvianRuc('2013131295')).toBe(false); // 10 digits
    expect(validatePeruvianRuc('201313129555')).toBe(false); // 12 digits
  });
});

describe('CreatePersonSchema', () => {
  it('validates a valid natural person with DNI', () => {
    const input = {
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: '44556677',
      first_name: 'Carlos',
      last_name: 'Quispe',
      email: 'carlos@example.com',
    };
    const result = CreatePersonSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails if natural person is missing first name or last name', () => {
    const input = {
      person_type: 'NATURAL',
      identity_document_type: 'DNI',
      identity_document_number: '44556677',
      first_name: '',
      last_name: 'Quispe',
    };
    const result = CreatePersonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('validates a valid legal person with RUC', () => {
    const input = {
      person_type: 'JURIDICA',
      identity_document_type: 'RUC',
      identity_document_number: '20131312955',
      legal_name: 'Superintendencia Nacional de Aduanas y de Administración Tributaria',
    };
    const result = CreatePersonSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails if legal person is missing legal name', () => {
    const input = {
      person_type: 'JURIDICA',
      identity_document_type: 'RUC',
      identity_document_number: '20131312955',
      legal_name: '',
    };
    const result = CreatePersonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
