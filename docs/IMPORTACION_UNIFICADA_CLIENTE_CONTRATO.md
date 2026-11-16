# Importación única de cliente, contratos e instalaciones

Esta guía explica cómo cargar en ALEMSI un cliente completo (cliente, contratos, instalaciones y materiales contractuales) desde un solo CSV generado a partir del contrato. También está disponible dentro del sistema, en **Clientes e instalaciones → Importar cliente, contratos e instalaciones → Guía de uso**, con botón **Imprimir / Guardar PDF**.

## 1. Descargar la plantilla

En el módulo **Clientes e instalaciones**, abre **Importar cliente, contratos e instalaciones** y pulsa **Descargar plantilla CSV**.

Columnas de la plantilla, en orden:

```
cliente_nombre;cliente_rut;cliente_correo;cliente_telefono;contrato_nombre;contrato_codigo;presupuesto_neto_clp;instalacion_nombre;region;comuna;direccion;contacto_entrega;correo_entrega;periodicidad_contrato;material_codigo;material_nombre;cantidad_asignada;unidad;ciudad;material_presentacion;alcance_cantidad
```

Las 18 primeras columnas mantienen la plantilla histórica. Al final se agregan `ciudad`, `material_presentacion` y `alcance_cantidad`.

## 2. Copiar el prompt

Pulsa **Copiar prompt para IA**. El portapapeles recibe el prompt completo, sin recortes. También puedes abrir **Ver prompt** y copiarlo manualmente.

## 3. Entregar contrato y prompt a una IA

Adjunta el contrato, bases, anexos o listados en Meta AI, Gemini o ChatGPT y pega el prompt. La IA debe:

- extraer solo información de los documentos adjuntos;
- identificar cliente, RUT, contratos y códigos;
- listar todas las instalaciones;
- identificar materiales, presentación, unidad y cantidades documentadas;
- dejar vacío lo desconocido y no inventar datos;
- no duplicar clientes, contratos, instalaciones ni materiales;
- respetar exactamente los nombres y el orden de las columnas;
- entregar CSV válido, no JSON ni tabla Markdown;
- informar las ambigüedades en una sección separada.

## 4. Guardar el CSV

Guarda solo el bloque CSV en un archivo **UTF-8** con separador **punto y coma (;)**. No incluyas la sección **AMBIGÜEDADES** dentro del archivo. Una planilla de cálculo puede cambiar el separador o los acentos: verifica antes de cargar.

## 5. Cargar el archivo en ALEMSI

Pulsa **Seleccionar CSV único**. El sistema valida:

- columnas obligatorias (`cliente_nombre`, `cliente_rut`, `contrato_nombre`);
- RUT chileno con dígito verificador para clientes nuevos;
- nombres, códigos, presupuestos y cantidades;
- relaciones cliente → contrato → instalación → material.

Nada se guarda en este paso.

## 6. Interpretar la vista previa

| Resultado | Significado |
|---|---|
| **NUEVO** | Se creará al confirmar. |
| **EXISTE** | Ya está registrado; se conserva sin sobrescribir. |
| **CONFLICTO** | Dato incompleto, inválido o contradictorio; no se importará. |
| **DUPLICADO** | Fila repetida dentro del archivo; se procesará una sola vez. |

La vista previa muestra fila, nivel (Cliente, Contrato, Instalación o Material), elemento, resultado y detalle. Puedes filtrar solo conflictos y duplicadas.

## 7. Revisar conflictos

Los conflictos y duplicados no se importan. Corrige el CSV y vuelve a cargarlo. Casos habituales:

- RUT inválido o cliente con el mismo RUT y otro nombre;
- contrato homónimo sin `contrato_codigo`;
- instalación con dirección distinta a la ya registrada (no se sobrescribe);
- material que no existe en el maestro (la importación no crea materiales);
- código de material que apunta a un material distinto del nombre;
- cantidad negativa o no numérica;
- máxima ya configurada con un valor distinto (no se modifica automáticamente);
- cantidad por instalación sin `instalacion_nombre`.

## 8. Confirmar la importación

Pulsa **Confirmar importación** una sola vez.

- Cliente existente: se conserva.
- Contrato existente: no se sobrescribe.
- Instalación existente: no se duplica ni se sobrescribe.
- Material existente: no se duplica en el maestro.
- Cantidad máxima ya configurada: no se modifica.
- Registro nuevo y válido: se agrega.
- Si una operación falla, se revierten los registros creados en esa ejecución.
- Reimportar el mismo CSV no genera duplicados.

## Cantidades y alcance

- `alcance_cantidad=instalacion`: el documento indica un máximo para esa instalación. Se guarda como máximo de esa instalación.
- `alcance_cantidad=contrato`: el documento indica un total contractual sin desglose. Se autoriza el material a nivel contractual, pero **la cantidad no se reparte entre instalaciones**; queda registrada en la observación.
- Sin cantidad documentada: deja `cantidad_asignada` vacío. No se inventa un máximo.
- Si `alcance_cantidad` está vacío y hay `instalacion_nombre`, se interpreta `instalacion`; si no hay instalación, se interpreta `contrato`.

## Límites

- Máximo 4 MB y 2.000 filas por archivo.
- Los materiales deben existir previamente en el maestro.
- La importación no crea campañas, despachos, inventario ni documentos tributarios.
- El nombre del PDF descargado depende de la configuración local de Chrome/Windows; ALEMSI define el título y el contenido.
