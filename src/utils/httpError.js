class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const badRequest = (code, msg) => new HttpError(400, code, msg);
const unauthorized = (code, msg) => new HttpError(401, code, msg);
const conflict = (code, msg) => new HttpError(409, code, msg);
const internal = (msg='Internal error') => new HttpError(500, 'INTERNAL_ERROR', msg);
module.exports = { HttpError, badRequest, unauthorized, conflict, internal };
