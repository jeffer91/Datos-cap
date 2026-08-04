/* =========================================================
Nombre completo: firebase.config.js
Ruta o ubicación: /src/firebase/firebase.config.js
Función o funciones:
- Centralizar la configuración pública del proyecto Firebase jeff-2f92d.
- Identificar la app web personal sin incluir credenciales de usuario.
- Mantener Firebase separado de la lógica de la base local.
========================================================= */
"use strict";

const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyAJgkVqr7p_GKnYFTSHybvBLyFGHplE_uc",
  authDomain: "jeff-2f92d.firebaseapp.com",
  projectId: "jeff-2f92d",
  storageBucket: "jeff-2f92d.firebasestorage.app",
  messagingSenderId: "337984443748",
  appId: "1:337984443748:web:86e7019aa4a5559c3b9671",
  measurementId: "G-PMQ5N15D5Y"
});

const FIREBASE_APP_NAME = "datos-cap-sync";
const FIREBASE_ROOT_COLLECTION = "datos_cap_usuarios";

module.exports = {
  FIREBASE_CONFIG,
  FIREBASE_APP_NAME,
  FIREBASE_ROOT_COLLECTION
};
