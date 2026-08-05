# Datos-cap

Aplicación de escritorio en Electron para organizar información de planes docentes y acuerdos de patrocinio.

## Planes docentes

El flujo principal de planes utiliza tablas TSV para evitar errores de OCR:

1. Pulsar **Copiar prompt**.
2. Subir los PDF a ChatGPT y pegar el prompt.
3. Copiar la tabla TSV generada.
4. Pegarla en Datos-cap y pulsar **Procesar tabla**.
5. Revisar y corregir los campos marcados en rojo.

La aplicación agrupa varias filas del mismo código como un solo plan y crea una capacitación por fila. El tiempo de dedicación se fija automáticamente como `Tiempo Completo`.

## Acuerdos de patrocinio

La pantalla de acuerdos conserva la carga de PDF y la lectura híbrida de documentos digitales o escaneados.

## Desarrollo

```bash
npm install
npm run verify
npm start
```
