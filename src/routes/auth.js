const { Router } = require('express');
const { verifyToken } = require('../middleware/VerifyToken');
const {
  login,
  forgotPass,
  ubahKataSandi,
  ubahProfile,
  profile,
  authToken,
} = require('../controllers/auth.controller')

module.exports = models => {
  const route = Router();

  route.route('/login').post(login(models))
  route.route('/profile').put(verifyToken, profile(models))
  route.route('/authToken').get(verifyToken, authToken(models))

  route.route('/forgotpass').post(verifyToken, forgotPass(models))
  route.route('/ubah-katasandi').post(verifyToken, ubahKataSandi(models))
  route.route('/ubah-profile').post(verifyToken, ubahProfile(models))
  
  return route;
}