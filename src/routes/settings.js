const { Router } = require('express');
const {
  updateFile,
  updateBerkas,
  getUID,
  getEncrypt,
  getDecrypt,
  getMenu,
  crudMenu,
  getSequenceMenu,
  crudSequenceMenu,
  getRole,
  crudRole,
  getRoleMenu,
  crudRoleMenu,
  getKategoriNotifikasi,
  getNotifikasi,
  getCountNotifikasi,
  crudNotifikasi,
  getCMSSetting,
  crudCMSSetting,
  getKomisarisWilayah,
  crudKomisarisWilayah,
  getWilayahPanjaitan,
  crudWilayahPanjaitan,
  getBerkas,
  crudBerkas,
  optionsMenu,
  optionsAnak,
  optionsOmpu,
  optionsKomisarisWilayah,
  optionsWilayahPanjaitan,
  optionsWilayah,
  optionsWilayah2023,
  optionsBerkas,
  getUserBroadcast,
  getWilayah,
  crudWilayah,
  getWilayah2023,
  crudWilayah2023,
  testing,
} = require('../controllers/settings.controler')
const { uploadFile } = require('../middleware/uploadFile')
const { uploadBerkas } = require('../middleware/uploadBerkas')
const { verifyToken } = require('../middleware/VerifyToken');

module.exports = models => {
  const route = Router();
  route.route('/getUID').get(getUID())
  route.route('/encryptPass').get(verifyToken, getEncrypt())
  route.route('/decryptPass').get(verifyToken, getDecrypt())
  route.route('/optionsMenu').get(verifyToken, optionsMenu(models))
  route.route('/optionsAnak').get(verifyToken, optionsAnak(models))
  route.route('/optionsOmpu').get(optionsOmpu(models))
  route.route('/optionsKomisarisWilayah').get(optionsKomisarisWilayah(models))
  route.route('/optionsWilayahPanjaitan').get(optionsWilayahPanjaitan(models))
  route.route('/optionsWilayah').get(optionsWilayah(models))
  route.route('/optionsWilayah2023').get(optionsWilayah2023(models))
  route.route('/optionsBerkas').get(optionsBerkas(models))
  
  route.route('/updateFile').post(uploadFile, updateFile(models))
  route.route('/updateBerkas').post(uploadBerkas, updateBerkas(models))
  
  route.route('/kategoriNotifikasi')
    .get(verifyToken, getKategoriNotifikasi(models))
  route.route('/dataUserBroadcast')
    .get(verifyToken, getUserBroadcast(models))
  route.route('/Notifikasi')
    .get(verifyToken, getNotifikasi(models))
    .post(verifyToken, crudNotifikasi(models))
  route.route('/countNotifikasi')
      .get(verifyToken, getCountNotifikasi(models))
  route.route('/Menu')
    .get(verifyToken, getMenu(models))
    .post(crudMenu(models))
  route.route('/SequenceMenu')
    .get(verifyToken, getSequenceMenu(models))
    .post(crudSequenceMenu(models))
  route.route('/Role')
    .get(verifyToken, getRole(models))
    .post(crudRole(models))
  route.route('/RoleMenu')
    .get(verifyToken, getRoleMenu(models))
    .post(crudRoleMenu(models))
  route.route('/cmssetting')
    .get(getCMSSetting(models))
    .put(crudCMSSetting(models))
  route.route('/KomisarisWilayah')
    .get(verifyToken, getKomisarisWilayah(models))
    .post(crudKomisarisWilayah(models))
  route.route('/WilayahPanjaitan')
    .get(verifyToken, getWilayahPanjaitan(models))
    .post(crudWilayahPanjaitan(models))
  route.route('/Berkas')
    .get(verifyToken, getBerkas(models))
    .post(crudBerkas(models))

  route.route('/wilayah')
    .get(getWilayah(models))
    .post(crudWilayah(models))
  route.route('/wilayah2023')
    .get(getWilayah2023(models))
    .post(crudWilayah2023(models))

  route.route('/testing').get(testing(models))
  
  return route;
}