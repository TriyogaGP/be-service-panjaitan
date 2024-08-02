const { Router } = require('express');
const {
  getAnggota,
} = require('../controllers/apirest.controller')
const { verifyToken } = require('../middleware/VerifyToken');


module.exports = models => {
  const route = Router();

  route.route('/anggota')
    .get(verifyToken, getAnggota(models))

  return route;
}