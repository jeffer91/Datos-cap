# Firebase · Datos-cap

La aplicación usa `jeff-2f92d` como respaldo automático. La base local continúa siendo la fuente principal y abre sin esperar a internet.

## Activación única

1. En Firebase Console, abre **Authentication → Sign-in method** y activa **Correo electrónico/contraseña**.
2. En **Authentication → Users**, crea el usuario que utilizará la aplicación.
3. En **Firestore → Reglas**, publica el contenido de `firestore.rules`.
4. En la aplicación, abre **Base → Nube**, escribe ese correo y contraseña, y pulsa **Guardar**.

La contraseña se cifra con `safeStorage` de Electron y no se guarda en Firebase ni en el repositorio.

## Funcionamiento

- La aplicación carga primero la base local.
- Firebase inicia después, en segundo plano.
- Solo se suben las colecciones que cambiaron.
- Se ejecuta una sincronización al iniciar y otra diaria a las 19:00 mientras la app esté abierta.
- Un Firebase vacío nunca reemplaza ni elimina la información local.
- La configuración de IA y las credenciales de Firebase no se suben.

## Despliegue opcional por Firebase CLI

```bash
firebase deploy --only firestore:rules
```
