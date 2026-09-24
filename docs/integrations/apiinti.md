# Integración APIINTI — Consulta DNI y RUC

**Propósito:** Especificación de la API de APIINTI para consultas de identidad en el motor documental (`engine`).
**Ámbito:** Implementación en Sprint 9 (Integraciones).

> **Seguridad:** La API key NUNCA debe commitearse en el repositorio ni incluirse en el frontend. Se configura exclusivamente en la variable de entorno `APIINTI_API_KEY` en Render y en `.env.local` ignorado por Git.

---

## 1. Configuración Base

- **Base URL:** `https://app.apiinti.dev/api/v1`
- **Autenticación:** Header `Authorization: Bearer <APIINTI_API_KEY>` o `x-api-key: <APIINTI_API_KEY>` (según header del proveedor).

---

## 2. Endpoints

### 2.1 Consulta RUC
- **Método:** `GET`
- **Ruta:** `/ruc/{numero}`
- **Parámetro:** `{numero}` (string, 11 dígitos, RUC)
- **Esquema de Respuesta (`RucData`):**
  - `ruc` (string, required): Número de RUC consultado.
  - `razonSocial` (string, required): Razón social o nombre completo del contribuyente.
  - `estado` (enum, required): `ACTIVO`, `BAJA DE OFICIO`, `BAJA PROVISIONAL`, `SUSPENSION TEMPORAL`, `BAJA DEFINITIVA`.
  - `condicion` (enum, required): `HABIDO`, `NO HABIDO`, `NO HALLADO`.
  - `direccion` (string): Dirección fiscal registrada.
  - `departamento` (string): Departamento geográfico.
  - `provincia` (string): Provincia geográfica.
  - `distrito` (string): Distrito geográfico.
  - `tipo` (string): Tipo de contribuyente (ej. `SOCIEDAD ANONIMA CERRADA`).

### 2.2 Consulta DNI
- **Método:** `GET`
- **Ruta:** `/dni/{numero}`
- **Parámetro:** `{numero}` (string, 8 dígitos, DNI)
- **Esquema de Respuesta (`DniData`):**
  - `dni` (string, required): Número de DNI consultado.
  - `nombres` (string, required): Nombres de pila.
  - `apellidoPaterno` (string, required): Primer apellido.
  - `apellidoMaterno` (string, required): Segundo apellido.
  - `nombreCompleto` (string, required): Nombre formateado (`APELLIDO_P APELLIDO_M NOMBRES`).

### 2.3 Manejo de Errores
- **Esquema de Error:**
  - `success` (boolean, required): `false`
  - `error` (object, required): Objeto de detalle del error retornado por la API.
