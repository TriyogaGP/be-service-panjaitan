const { Router } = require('express');
const {
  getAnggota,
  getWilayahPanjaitan,
  getKomisarisWilayah,
} = require('../controllers/apirest.controller')
const { verifyToken } = require('../middleware/VerifyToken');


module.exports = models => {
  const route = Router();

  route.route('/anggota')
    .get(verifyToken, getAnggota(models))
  route.route('/list-wilayah-panjaitan')
    .get(verifyToken, getWilayahPanjaitan(models))
  route.route('/list-komisaris-wilayah/:kodeWilayah')
    .get(verifyToken, getKomisarisWilayah(models))

  return route;
}