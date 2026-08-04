/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/firebase/index.js
Función o funciones:
- Exponer la configuración y el servicio de sincronización con Firebase.
========================================================= */
"use strict";

module.exports = {
  ...require("./firebase.config"),
  ...require("./firebase-sync.service")
};
