const {
	response,
	OK,
	NOT_FOUND,
	NO_CONTENT
} = require('@triyogagp/backend-common/utils/response.utils');
const { 
	_buildResponseUser,
	_buildResponseAdmin,
	_buildResponseStruktural,
	_buildResponseSiswaSiswi
} = require('../utils/build-response');
const { encrypt, decrypt } = require('@triyogagp/backend-common/utils/helper.utils');
const { Op } = require('sequelize')
const sequelize = require('sequelize')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const _ = require('lodash');
const { logger } = require('../configs/db.winston')
const nodeGeocoder = require('node-geocoder');
const { sequelizeInstance } = require('../configs/db.config');
const dotenv = require('dotenv');
dotenv.config();
const BASE_URL = process.env.BASE_URL

function login (models) {
  return async (req, res, next) => {
		let { username, password } = req.body
    try {
			if(!username){ return NOT_FOUND(res, 'Username tidak boleh kosong !') }
			if(!password){ return NOT_FOUND(res, 'Kata Sandi tidak boleh kosong !') }

      const data = await models.Admin.findOne({
				where: {
					statusAdmin: true,
					username: username,
				},
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{
						model: models.RoleAdmin,
						attributes: ['namaRole']
					},
				]
			});

			if(!data){ return NOT_FOUND(res, 'data tidak di temukan !') }

			const match = await bcrypt.compare(password, data.password);
			if(!match) return NOT_FOUND(res, 'Kata Sandi tidak sesuai !');
			const dataJWT = {
				userID: data.idAdmin,
				consumerType: data.consumerType,
				wilayah: data.wilayah,
				namaRole: data.RoleAdmin.namaRole,
				username: data.username,
				nama: data.nama,
			}
			const accessToken = jwt.sign(dataJWT, process.env.ACCESS_TOKEN_SECRET, {
					expiresIn: '12h'
			});
			const refreshToken = jwt.sign(dataJWT, process.env.REFRESH_TOKEN_SECRET, {
					expiresIn: '1d'
			});

			let result = await _buildResponseUser(data, refreshToken, accessToken)

			return OK(res, result, `Selamat Datang ${result.nama} sebagai ${result.namaRole}`)
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function forgotPass (models) {
  return async (req, res, next) => {
		let { email } = req.body
    try {
			const data = await models.User.findOne({
				where: {
					statusAktif: true,
					email: email
				},
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
			});

			if(!data){ return NOT_FOUND(res, 'data tidak di temukan !') }

			let transporter = nodemailer.createTransport({
				service: 'gmail',
				auth: {
					user: 'triyoga.ginanjar.p@gmail.com',
					pass: 'edyqlenfqxgtmeat' //26122020CBN
				}
			});

			let html = `<h1>Data Informasi Akun</h1>
			<ul>`;
			html += `<li>Nama Lengkap : ${data.nama}</li>
				<li>Alamat Email : ${data.email}</li>
				<li>Username : ${data.username}</li>
				<li>Kata Sandi : ${decrypt(data.kataSandi)}</li>
			</ul>
			Harap informasi ini jangan di hapus karena informasi ini penting adanya. Terimakasih. <br>Jika Anda memiliki pertanyaan, silakan balas email ini`;
			
			let mailOptions = {
				from: process.env.EMAIL,
				to: email,
				subject: 'Konfirmasi Lupa Kata Sandi',
				// text: `Silahkan masukan kode verifikasi akun tersebut`
				html: html,
			};

			transporter.sendMail(mailOptions, (err, info) => {
				if (err) return NOT_FOUND(res, 'Gagal mengirim data ke alamat email anda, cek lagi email yang di daftarkan!.')
			});

			return OK(res, data, 'Kata Sandi sudah di kirimkan ke email anda, silahkan periksa email anda ..')
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function ubahKataSandi (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
    try {
			const { userID } = req.JWTDecoded
			let user = await models.Admin.findOne({where: { idAdmin: userID }})
			if(body.passwordLama != decrypt(user.kataSandi)) return NOT_FOUND(res, 'Kata Sandi Lama tidak cocok !')
			if(body.passwordBaru != body.passwordConfBaru) return NOT_FOUND(res, 'Kata Sandi Baru tidak cocok dengan Konfirmasi Kata Sandi Baru !')
			let salt = await bcrypt.genSalt();
			let hashPassword = await bcrypt.hash(body.passwordBaru, salt);
			let kirimdata = {
				password: hashPassword,
				kataSandi: encrypt(body.passwordBaru),
				updateBy: userID,
			}
			await models.Admin.update(kirimdata, { where: { idAdmin: userID } })
			return OK(res, user);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function ubahProfile (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
    try {
			const { userID } = req.JWTDecoded
			let kirimdataUser = {
				wilayah: body.wilayah,
				nama: body.nama,
				username: body.username,
				updateBy: userID,
			}
			await models.Admin.update(kirimdataUser, { where: { idAdmin: userID } })
			return OK(res, body);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function profile (models) {
  return async (req, res, next) => {
    try {
			const { userID } = req.JWTDecoded
			let dataProfile = await models.Admin.findOne({
				where: { idAdmin: userID },
				include: [
					{ 
						model: models.RoleAdmin,
						attributes: ['namaRole'],
						where: { statusRole: true }
					},
				],
			});

			return OK(res, await _buildResponseAdmin(models, dataProfile));
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function authToken (models) {
  return async (req, res, next) => {
    try {
			return OK(res, req.JWTDecoded);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

module.exports = {
  login,
	forgotPass,
  ubahKataSandi,
  ubahProfile,
  profile,
  authToken,
}