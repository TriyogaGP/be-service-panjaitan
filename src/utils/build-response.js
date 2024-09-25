const { decrypt, convertDateTime, dateconvert, convertDate, uppercaseLetterFirst3 } = require('@triyogagp/backend-common/utils/helper.utils');
// const { } = require('../controllers/helper.service')
const dotenv = require('dotenv');
dotenv.config();
const BASE_URL = process.env.BASE_URL

async function _buildResponseUser(dataUser, refreshToken, accessToken, models) {
	let datawilayah = null
	if(dataUser.wilayah !== '00'){
		datawilayah = await models.WilayahPanjaitan.findOne({
			where: { kode: dataUser.wilayah },
			attributes: ['kode', 'label'],
		});
	}
	return {
		idAdmin: dataUser.idAdmin,
		consumerType: dataUser.consumerType,
		kodeWilayah: dataUser.wilayah !== '00' ? datawilayah.kode : dataUser.wilayah ,
		namaWilayah: dataUser.wilayah !== '00' ? datawilayah.label : 'tidak memiliki wilayah' ,
		namaRole: dataUser.RoleAdmin.namaRole,
		nama: uppercaseLetterFirst3(dataUser.nama),
		username: dataUser.username,
		password: dataUser.password,
		kataSandi: dataUser.kataSandi,
		fotoProfil: dataUser.fotoProfil ? `${BASE_URL}image/${dataUser.fotoProfil}` : `${BASE_URL}bahan/user.png`,
		statusAdmin: dataUser.statusAdmin,
		refreshToken,
		accessToken
	}
}

async function _buildResponseAdmin(models, dataUser) {
	let datawilayah = null
	if(dataUser.wilayah !== '00'){
		datawilayah = await models.WilayahPanjaitan.findOne({
			where: { kode: dataUser.wilayah },
			attributes: ['kode', 'label'],
		});
	}
	return {
		idAdmin: dataUser.idAdmin,
		consumerType: dataUser.consumerType,
		kodeWilayah: dataUser.wilayah !== '00' ? datawilayah.kode : dataUser.wilayah ,
		namaWilayah: dataUser.wilayah !== '00' ? datawilayah.label : 'tidak memiliki wilayah' ,
		namaRole: dataUser.RoleAdmin.namaRole,
		nama: uppercaseLetterFirst3(dataUser.nama),
		username: dataUser.username,
		password: dataUser.password,
		kataSandi: dataUser.kataSandi,
		fotoProfil: dataUser.fotoProfil ? `${BASE_URL}image/${dataUser.fotoProfil}` : `${BASE_URL}bahan/user.png`,
		statusAdmin: dataUser.statusAdmin,
		flag: dataUser.deleteBy !== null || dataUser.deletedAt !== null,
	}
}

module.exports = {
  _buildResponseUser,
  _buildResponseAdmin,
}