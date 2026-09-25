'use client';

import React, { useState } from 'react';
import { Check, AlertCircle, Sparkles, Sun, Moon, Building2, Palette } from 'lucide-react';
import { PRESET_THEMES, isWcagAaCompliant, type ThemeColors } from '@workflow/shared';

interface ThemePickerProps {
  initialTheme?: string;
  initialColors?: ThemeColors;
  onSave?: (theme: string, colors: ThemeColors) => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({
  initialTheme = 'light',
  initialColors = PRESET_THEMES.light!.colors,
  onSave,
}) => {
  const [currentTheme, setCurrentTheme] = useState<string>(initialTheme);
  const [colors, setColors] = useState<ThemeColors>(initialColors);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Validación de contraste WCAG AA entre texto primario y fondo de tarjetas
  const contrastCheck = isWcagAaCompliant(colors.foreground, colors.card);
  // Validación entre botón primario y texto blanco
  const buttonContrastCheck = isWcagAaCompliant('#ffffff', colors.primary);

  const handleSelectPreset = (key: string) => {
    setCurrentTheme(key);
    if (PRESET_THEMES[key]) {
      setColors(PRESET_THEMES[key].colors);
    }
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setCurrentTheme('custom');
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!contrastCheck.compliant || !buttonContrastCheck.compliant) {
      return;
    }
    // Aplicar al DOM
    document.documentElement.setAttribute('data-theme', currentTheme === 'dark' ? 'dark' : 'light');
    onSave?.(currentTheme, colors);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* 1. Selector de Temas Predefinidos */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Modo y Paleta Base</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Claro */}
          <button
            type="button"
            onClick={() => handleSelectPreset('light')}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
              currentTheme === 'light'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <Sun className="w-6 h-6 text-amber-500 mb-2" />
            <span className="text-xs font-semibold text-foreground">Claro</span>
            <span className="text-[10px] text-muted-foreground">Luminoso y formal</span>
          </button>

          {/* Oscuro */}
          <button
            type="button"
            onClick={() => handleSelectPreset('dark')}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
              currentTheme === 'dark'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <Moon className="w-6 h-6 text-indigo-400 mb-2" />
            <span className="text-xs font-semibold text-foreground">Oscuro</span>
            <span className="text-[10px] text-muted-foreground">Descanso visual</span>
          </button>

          {/* Corporativo */}
          <button
            type="button"
            onClick={() => handleSelectPreset('corporate')}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
              currentTheme === 'corporate'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <Building2 className="w-6 h-6 text-teal-600 mb-2" />
            <span className="text-xs font-semibold text-foreground">Corporativo</span>
            <span className="text-[10px] text-muted-foreground">Notarial / Institucional</span>
          </button>

          {/* Personalizado */}
          <button
            type="button"
            onClick={() => setCurrentTheme('custom')}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
              currentTheme === 'custom'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <Palette className="w-6 h-6 text-pink-500 mb-2" />
            <span className="text-xs font-semibold text-foreground">Personalizado</span>
            <span className="text-[10px] text-muted-foreground">Paleta libre con AA</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 2. Editor de Colores */}
        <div className="lg:col-span-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Colores Principales</h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <label className="block font-medium text-foreground">Color Primario</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.primary}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="w-8 h-8 rounded border border-input cursor-pointer"
                />
                <input
                  type="text"
                  value={colors.primary}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-input text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <label className="block font-medium text-foreground">Color Fondo</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.background}
                  onChange={(e) => handleColorChange('background', e.target.value)}
                  className="w-8 h-8 rounded border border-input cursor-pointer"
                />
                <input
                  type="text"
                  value={colors.background}
                  onChange={(e) => handleColorChange('background', e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-input text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <label className="block font-medium text-foreground">Fondo de Tarjetas</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.card}
                  onChange={(e) => handleColorChange('card', e.target.value)}
                  className="w-8 h-8 rounded border border-input cursor-pointer"
                />
                <input
                  type="text"
                  value={colors.card}
                  onChange={(e) => handleColorChange('card', e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-input text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <label className="block font-medium text-foreground">Texto Principal</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors.foreground}
                  onChange={(e) => handleColorChange('foreground', e.target.value)}
                  className="w-8 h-8 rounded border border-input cursor-pointer"
                />
                <input
                  type="text"
                  value={colors.foreground}
                  onChange={(e) => handleColorChange('foreground', e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-input text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. Indicador de Validación de Contraste WCAG AA */}
          <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Validación de Accesibilidad (WCAG 2.1 AA)
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                  contrastCheck.compliant && buttonContrastCheck.compliant
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {contrastCheck.compliant && buttonContrastCheck.compliant
                  ? 'Cumple WCAG AA'
                  : 'No Cumple WCAG AA'}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Contraste Texto / Tarjeta:</span>
                <span className="font-mono font-medium">
                  {contrastCheck.ratio}:1 (Mínimo {contrastCheck.minRequired}:1)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Contraste Botón Primario / Blanco:</span>
                <span className="font-mono font-medium">
                  {buttonContrastCheck.ratio}:1 (Mínimo {buttonContrastCheck.minRequired}:1)
                </span>
              </div>
            </div>

            {(!contrastCheck.compliant || !buttonContrastCheck.compliant) && (
              <div className="flex items-start gap-2 pt-2 text-destructive text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  La combinación de colores seleccionada no cumple con el ratio de contraste mínimo.
                  Ajuste los tonos para garantizar legibilidad.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Vista Previa en Vivo (Mockup 7: "Mi Empresa") */}
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Vista Previa en Vivo</h3>

          <div
            className="p-6 rounded-2xl border border-border shadow-md transition-all space-y-4"
            style={{ backgroundColor: colors.background }}
          >
            {/* Cabecera miniatura */}
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: colors.primary }}
                >
                  W
                </div>
                <div>
                  <h4
                    className="text-xs font-bold leading-tight"
                    style={{ color: colors.foreground }}
                  >
                    Mi Empresa
                  </h4>
                  <p className="text-[10px] text-muted-foreground">Gestión Sucesoria</p>
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded text-xs font-medium text-white shadow-sm transition-all"
                style={{ backgroundColor: colors.primary }}
              >
                Nuevo Caso
              </button>
            </div>

            {/* Tarjeta de muestra */}
            <div
              className="p-4 rounded-xl border border-border/60 shadow-sm space-y-2"
              style={{ backgroundColor: colors.card }}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  En Trámite
                </span>
                <span className="text-[10px] text-muted-foreground">2026-000142</span>
              </div>
              <h5 className="text-xs font-semibold" style={{ color: colors.foreground }}>
                Sucesión Intestada — Causante Carlos Medina
              </h5>
              <p className="text-[11px] text-muted-foreground">
                Cliente: Constructora Lima SAC · Notaría Gómez
              </p>
              <div className="pt-2 flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground">Avance: 60%</span>
                <span className="font-semibold" style={{ color: colors.primary }}>
                  Ver Detalle →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {savedSuccess ? (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Tema y apariencia guardados con éxito
          </span>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!contrastCheck.compliant || !buttonContrastCheck.compliant}
          className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Guardar Cambios de Apariencia
        </button>
      </div>
    </div>
  );
};
