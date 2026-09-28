# ADR-005: Caja Chica, Libro Diario Inmutable, Control Dual en Arqueos y Gastos por Caso (M9)

- **Estado:** Aceptado
- **Fecha:** 2026-09-28
- **Contexto:** Sprint 11 — Caja chica: Libro inmutable, solicitudes, arqueo y cierre

---

## 1. Contexto del Problema
Los trámites notariales, judiciales y registrales de sucesiones intestadas conllevan gastos operativos en efectivo y fondos fijos (derechos registrales SUNARP, aranceles notariales, publicaciones de edictos, movilidades y copias certificadas). Se requiere:
1. Registro contable riguroso y transparente sin posibilidad de manipulación o alteración retrospectiva de asientos.
2. Cumplimiento de la regla de auditoría contable: los errores se corrigen con asientos de contrapartida (reversos), nunca sobreescribiendo o borrando registros.
3. Segregación de funciones (control dual / cuatro ojos) en el arqueo y cierre periódico de caja: quien realiza el conteo físico no puede autorizar su propio arqueo ni dar conformidad a sus discrepancias.
4. Vinculación directa de desembolsos a los expedientes sucesorios (hito M9) para control de rentabilidad y liquidación con clientes, sin mezclar fondos fijos de caja general con la rendición por caso.
5. Control de umbrales según normas internas: sustento documental obligatorio a partir de S/ 50.00 y autorización jerárquica con segundo factor (MFA) para montos mayores a S/ 300.00.

---

## 2. Decisiones de Arquitectura

### 2.1 Inmutabilidad Estricta a Nivel Base de Datos (`trg_cash_movements_immutable`)
- La tabla `cash_movements` rechaza cualquier operación `UPDATE` o `DELETE` mediante un trigger `BEFORE UPDATE OR DELETE`:
  ```sql
  create or replace function private.tg_cash_movements_prevent_modification()
  returns trigger language plpgsql security definer as $$
  begin
    raise exception 'CASH_LEDGER_IMMUTABLE: El libro diario de caja es inmutable. No se permite modificar ni eliminar movimientos. Para corregir, genere un asiento de tipo REVERSAL.';
  end;
  $$;
  ```
- Este bloqueo aplica sin excepción, incluso para el rol `service_role` o superusuarios. Las correcciones exigen un asiento de contrapartida (`movement_type = 'REVERSAL'`) referenciando obligatoriamente a `reversal_of`.

### 2.2 Control Dual en Arqueo y Cierre (`trg_cash_reconciliation_dual_control`)
- Para evitar fraudes y auto-aprobaciones, la base de datos valida en la transición a `APPROVED`:
  ```sql
  create or replace function private.tg_cash_reconciliation_validate()
  returns trigger language plpgsql security definer as $$
  begin
    if new.status = 'APPROVED' and new.approved_by = new.opened_by then
      raise exception 'DUAL_CONTROL_VIOLATION: Quien realiza el arqueo no puede aprobarlo. Se requiere un usuario distinto con rol de aprobación.';
    end if;
    return new;
  end;
  $$;
  ```

### 2.3 Cálculo Dinámico de Saldos por Vista Agregada (`cash_account_balances`)
- Para evitar inconsistencias por condiciones de carrera o saldos estáticos desincronizados, el saldo actual se calcula en tiempo real mediante la vista relacional `cash_account_balances`, sumando movimientos con `direction = 'IN'` y restando `direction = 'OUT'`.

### 2.4 Control por Períodos Contables (`trg_cash_movements_check_period`)
- Todo movimiento valida que la fecha del desembolso o ingreso no pertenezca a un período cerrado (`status = 'CLOSED'`), protegiendo la coherencia histórica de los ejercicios finalizados.

### 2.5 Aislamiento de Almacenamiento y Protección de Datos
- Los comprobantes de sustento se almacenan en el bucket privado `cash-support` con acceso restringido y descargas exclusivamente por URL firmada temporal generada por el backend.
- Cuentas bancarias asociadas solo guardan los últimos 4 dígitos.

---

## 3. Consecuencias
- **Positivas:** Trazabilidad contable total certificada; imposibilidad de manipular libros contables; cumplimiento de control dual en arqueos; integración nativa de costos directos en el expediente sucesorio (M9).
- **A tener en cuenta:** Los usuarios deben familiarizarse con la emisión de asientos de reverso para corregir errores tipográficos en lugar de editar asientos pasados.
