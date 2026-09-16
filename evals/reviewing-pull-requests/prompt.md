# Pull Request

## Resumen

Añade expiración de sesiones: `validate_session` rechaza sesiones con `expires_at` en el pasado.

## Trazabilidad

- Issue o requerimiento: SES-12
- Spec: docs/specs/session-expiry.md
- Plan o ADR: n/a

## Cambios

- Incluido: check de expiración en `validate_session` y tests.
- Fuera de alcance: `refresh_session`.

## Verificación

| Comando o evidencia | Resultado |
| --- | --- |
| `python3 -m unittest` | OK, 4 tests |

## Riesgos y operación

- Seguridad o datos sensibles: ninguno
- Dependencias o migraciones: ninguna
- Despliegue: normal
- Rollback: revert del commit
- Riesgos restantes: ninguno

## Checklist

- [x] Cumple la spec y los criterios de aceptación.
- [x] El diff está limitado al alcance declarado.
- [x] Formato, lint, tipos, tests y build aplicables pasan.
- [x] Seguridad y privacidad fueron revisadas.
- [x] Documentación y contratos están actualizados.
- [x] La evidencia fue generada después del último cambio.
- [x] No quedan hallazgos bloqueantes.
- [x] Existe aprobación humana para merge y producción.
