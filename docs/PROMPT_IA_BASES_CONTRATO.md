# Instrucción para IA: extraer bases de contrato a ALEMSI Simple

Lee íntegramente las bases administrativas, técnicas, anexos de materiales y aclaraciones que te adjunte.

Tu única salida debe ser un JSON válido que siga EXACTAMENTE la estructura del archivo `ficha-contrato-ejemplo.json`, sin comentarios ni Markdown.

Reglas:
1. NO inventes RUT, razón social, direcciones, región, comuna, número de instalaciones, códigos, cantidades, periodicidades, precios o referencias.
2. Distingue a la entidad contratante del proveedor adjudicado y de la unidad administradora. En `cliente` registra la entidad a la que se prestará el servicio y cuya identidad jurídica está confirmada. Si las bases no aclaran quién será el cliente contractual, deja el campo vacío y anótalo en `datos_no_encontrados`.
3. Un contrato es independiente de otro aunque pertenezcan al mismo cliente/RUT. Transcribe el código o referencia formal; no uses la región como sustituto.
4. Incluye TODAS las instalaciones expresamente identificadas en las bases. No generes instalaciones ficticias a partir de una cantidad total: si solo se informa “12 instalaciones”, anota la incertidumbre en `observaciones` y deja la lista únicamente con las identificables.
5. Materiales: por instalación, identifica nombres, códigos, unidades, cantidades y periodicidad. Si la tabla de materiales es global al contrato y no permite asignar cantidades por instalación, NO distribuyas ni dupliques cantidades; coloca el dato en `observaciones` y señala que se requiere distribución manual.
6. `presupuesto_neto_clp` representa únicamente cuota de materiales explícitamente identificada SIN IVA; nunca infieras ese importe a partir del monto global del contrato de servicios. Usa null si falta.
7. Cada dato sensible al circuito (RUT, monto, cantidad, instalación) debe poder justificarse indicando documento/página o sección en `fuentes`; nunca copies pasajes extensos.
8. Usa fecha ISO AAAA-MM-DD cuando esté explícita. Si no consta, deja una cadena vacía.
9. Para “SCO”, insumos de higiene, entrega de elementos y otros términos, conserva exactamente el término que figura en las bases y añádelo a `contrato.requisitos`; no supongas qué significa una sigla.
10. Cuando las bases son ambiguas o contradictorias, registra ambos hechos en `observaciones` y no elijas arbitrariamente uno.
11. No incluyas contraseñas, RUT personales de trabajadores ni datos privados innecesarios.

El JSON se carga en **Clientes → Importar ficha de bases (IA)** de ALEMSI Simple. La aplicación debe mostrar la vista previa y exigir aprobación humana antes de guardar. Los materiales solo pueden asignarse cuando corresponden exactamente a un material existente en el catálogo.
