const { Router } = require('express');
const {
  getDashboard,
  getDashboardTwo,
  getAdmin,
  getAdminbyUid,
  postAdmin,
  getBiodata,
  getBiodatabyUid,
  postBiodata,
  getIuran,
  postIuran,
  getDataMeninggal,
  postDataMeninggal,
  getDataMenikah,
  postDataMenikah,
  getPenanggungJawab,
  postPenanggungJawab,
  getTugas,
  postTugas,
  optionsWilayahPanjaitan,
  optionsKomisarisWilayah,
  downloadTemplate,
  importExcel,
  exportExcel,
  pdfCreate,
  pdfCreateRaport,
  testing,
} = require('../controllers/user.controller')
const { uploadFile } = require('../middleware/uploadFile')
const { verifyToken } = require('../middleware/VerifyToken');


module.exports = models => {
  const route = Router();

  route.route('/dashboard')
    .get(verifyToken, getDashboard(models))
  route.route('/dashboardTwo')
    .get(verifyToken, getDashboardTwo(models))
  
  route.route('/admin')
    .get(verifyToken, getAdmin(models))
    .post(verifyToken, postAdmin(models))
  route.route('/admin/:uid')
    .get(verifyToken, getAdminbyUid(models))
  
  route.route('/biodata')
    .get(verifyToken, getBiodata(models))
    .post(verifyToken, postBiodata(models))
  route.route('/biodata/:uid')
    .get(verifyToken, getBiodatabyUid(models))
    
  route.route('/iuran')
    .get(verifyToken, getIuran(models))
    .post(verifyToken, postIuran(models))
 
  route.route('/data-meninggal')
    .get(verifyToken, getDataMeninggal(models))
    .post(verifyToken, postDataMeninggal(models))
 
  route.route('/data-menikah')
    .get(verifyToken, getDataMenikah(models))
    .post(verifyToken, postDataMenikah(models))
 
  route.route('/data-penanggungjawab')
    .get(verifyToken, getPenanggungJawab(models))
    .post(verifyToken, postPenanggungJawab(models))
 
  route.route('/data-tugas')
    .get(verifyToken, getTugas(models))
    .post(verifyToken, postTugas(models))

  route.route('/optionsWilayahPanjaitan')
    .get(verifyToken, optionsWilayahPanjaitan(models))

  route.route('/optionsKomisarisWilayah')
    .get(verifyToken, optionsKomisarisWilayah(models))

  route.route('/template/:wilayah')
    .get(downloadTemplate(models))
  route.route('/importexcel')
    .post(uploadFile, importExcel(models))
  route.route('/exportexcel')
    .get(verifyToken, exportExcel(models))
  // route.route('/pdfcreate/:uid')
  //   .get(verifyToken, pdfCreate(models))
  // route.route('/pdfcreate-raport/:uid')
  //   .get(verifyToken, pdfCreateRaport(models))

  route.route('/testing')
    .get(testing(models))
  
  return route;
}