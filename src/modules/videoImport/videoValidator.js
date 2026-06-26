function validateVideoImportPayload(payload = {}) {
  return {
    ok: true,
    errors: [],
    cleanPayload: payload,
    extension: null
  };
}

module.exports = { validateVideoImportPayload };
