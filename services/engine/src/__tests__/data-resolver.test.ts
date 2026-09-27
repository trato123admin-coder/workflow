/**
 * Tests for data-resolver.ts — template field resolution from data snapshots.
 */

import { describe, it, expect } from 'vitest';
import { resolveTemplateData, type TemplateFieldInput } from '../services/data-resolver.js';

function makeField(
  placeholder: string,
  sourcePath: string,
  isRequired = false,
  defaultValue: string | null = null,
): TemplateFieldInput {
  return {
    placeholder,
    is_required: isRequired,
    document_field: {
      code: placeholder,
      source_path: sourcePath,
      is_required: isRequired,
      default_value: defaultValue,
    },
  };
}

describe('resolveTemplateData', () => {
  it('resolves a simple flat field', () => {
    const fields = [makeField('client_name', 'case.client_name')];
    const input = { case: { client_name: 'Juan Pérez' } };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.data.client_name).toBe('Juan Pérez');
    expect(result.missing).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
  });

  it('resolves nested dot-path fields', () => {
    const fields = [makeField('heir_name', 'parties.causante.spouse_name')];
    const input = { parties: { causante: { spouse_name: 'Rosa María' } } };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.data.heir_name).toBe('Rosa María');
  });

  it('reports missing required fields', () => {
    const fields = [
      makeField('client_name', 'case.client_name', true),
      makeField('optional_note', 'case.notes', false),
    ];
    const input = { case: {} };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.missing).toEqual(['client_name']);
    expect(result.data.client_name).toBe('');
    expect(result.data.optional_note).toBe('');
  });

  it('uses default_value when field is missing', () => {
    const fields = [makeField('city', 'case.city', true, 'Lima')];
    const input = { case: {} };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.data.city).toBe('Lima');
    expect(result.missing).toHaveLength(0);
  });

  it('does not use default when field has a value', () => {
    const fields = [makeField('city', 'case.city', true, 'Lima')];
    const input = { case: { city: 'Arequipa' } };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.data.city).toBe('Arequipa');
  });

  it('handles multiple fields in one call', () => {
    const fields = [
      makeField('name', 'client.name', true),
      makeField('doc_number', 'client.doc_number', true),
      makeField('email', 'client.email', false),
    ];
    const input = { client: { name: 'Juan', doc_number: '12345678' } };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.data.name).toBe('Juan');
    expect(result.data.doc_number).toBe('12345678');
    expect(result.data.email).toBe('');
    expect(result.missing).toHaveLength(0);
  });

  it('returns empty string for null/undefined values (non-required)', () => {
    const fields = [makeField('notes', 'case.notes')];
    const input = { case: { notes: null } };

    const result = resolveTemplateData({
      templateFields: fields,
      inputData: input as unknown as Record<string, unknown>,
    });

    expect(result.data.notes).toBe('');
  });

  it('handles empty input data gracefully', () => {
    const fields = [
      makeField('name', 'client.name', true),
    ];

    const result = resolveTemplateData({ templateFields: fields, inputData: {} });

    expect(result.missing).toEqual(['name']);
    expect(result.data.name).toBe('');
  });

  it('preserves numeric and boolean values', () => {
    const fields = [
      makeField('amount', 'case.amount'),
      makeField('is_urgent', 'case.is_urgent'),
    ];
    const input = { case: { amount: 3500.50, is_urgent: true } };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.data.amount).toBe(3500.50);
    expect(result.data.is_urgent).toBe(true);
  });

  it('treats empty string as missing for required fields', () => {
    const fields = [makeField('name', 'client.name', true)];
    const input = { client: { name: '  ' } };

    const result = resolveTemplateData({ templateFields: fields, inputData: input });

    expect(result.missing).toEqual(['name']);
  });
});
