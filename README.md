# Control de Materiales — Next.js v0.1

Primera versión funcional editable del sistema.

## Modelo
Empresa → Cliente → Contrato → Presupuesto global 4 meses → Instalaciones → Revisión física/remanente → Solicitud → consumo global.

## Incluye ahora
- 8 clientes y base presupuestaria inicial importada del Excel maestro.
- 51 productos del maestro inicial.
- Presupuesto global de 4 meses editable por contrato.
- Alta/desactivación de instalaciones.
- Solicitud por instalación.
- Confirmación obligatoria de revisión física.
- Registro de remanente por producto.
- Valorización y bloqueo si supera saldo global.
- Persistencia local en navegador para pruebas (localStorage).

## Próxima conexión
La capa de persistencia está aislada en `src/lib/storage.ts`. En la siguiente etapa se reemplaza por Firebase/Firestore sin rehacer las pantallas.

## Ejecutar
```bash
npm install
npm run dev
```
Abrir http://localhost:3000

## Despliegue objetivo
Firebase App Hosting o Vercel. La app Next.js es portable entre ambos.

## Importante
No se inventaron instalaciones. Se agregan desde la interfaz hasta que se cargue la base real de sucursales/oficinas.
