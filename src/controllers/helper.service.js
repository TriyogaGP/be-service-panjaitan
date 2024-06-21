const {
	response,
	OK,
	NOT_FOUND,
	NO_CONTENT
} = require('@triyogagp/backend-common/utils/response.utils');
const {
	encrypt,
	decrypt,
	createKSUID,
	buildMysqlResponseWithPagination
} = require('@triyogagp/backend-common/utils/helper.utils');
const { Op } = require('sequelize')
const sequelize = require('sequelize')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const { logger } = require('../configs/db.winston')
const nodeGeocoder = require('node-geocoder');
const { sequelizeInstance } = require('../configs/db.config');
const dotenv = require('dotenv');
dotenv.config();
const BASE_URL = process.env.BASE_URL

async function _allOption(params) {
	const { table, where, order } = params
	const data = await table.findAll({ where, order })
	return data
}

async function _anakOption(params) {
	const { models, idBiodata } = params
	const anak = await models.Anak.findAll({ where: { idBiodata }, attributes: ['idAnak', 'kategoriAnak', 'namaAnak', 'tanggalLahir', 'statusAnak', 'tanggalWafatAnak'], order: [['tanggalLahir', 'ASC']] })
	return anak
}

async function _wilayahpanjaitanOption(params) {
	const { models, kode } = params
	const wilayahpanjaitan = await models.WilayahPanjaitan.findOne({ where: { kode }, attributes: ['kode', 'label', 'lambang'] })
	return wilayahpanjaitan
}

async function _ompuOption(params) {
	const { models, kode } = params
	const ompu = await models.Ompu.findOne({ where: { kode }, attributes: ['kode', 'label'] })
	return ompu
}

async function _komisariswilayahOption(params) {
	const { models, kodeKomisarisWilayah } = params
	const komisarisWilayah = await models.KomisarisWilayah.findOne({ where: { kodeKomisarisWilayah } })
	return komisarisWilayah
}

async function _wilayah2023Option(params) {
	const { models, kode, bagian } = params
	let attributes = ['idLocation', [sequelize.fn('LEFT', sequelize.col('kode'), kode.length), 'kode']]
	if(bagian === 'provinsi') { attributes.push(['nama_prov', 'nama']) }
	if(bagian === 'kabkota') { attributes.push('jenisKabKota', ['nama_kabkota', 'nama']) }
	if(bagian === 'kecamatan') { attributes.push(['nama_kec', 'nama']) }
	if(bagian === 'keldes') { attributes.push('jenisKelDes', ['nama_keldes', 'nama'], 'kodePos') }
	const wilayah = await models.Wilayah2023.findOne({ where: { kode: { [Op.like]: `${kode}%`} }, attributes, order: [['kode', 'ASC']] })
	return wilayah
}

async function _wilayah2023Cetak(params) {
	const { models, bagian, KodeWilayah } = params
	let jmlString = bagian == 'provinsi' ? 2 : bagian == 'kabkotaOnly' ? 5 : bagian == 'kecamatanOnly' ? 8 : bagian == 'kelurahanOnly' ? 13 : KodeWilayah.length
	let whereChar = bagian === 'kabkota' || bagian === 'kecamatan' || bagian === 'kelurahan' ? (jmlString == 2 ? 5 : (jmlString == 5 ? 8 : 13)) : jmlString
	let where = {}
	let attributes = ['idLocation', [sequelize.fn('LEFT', sequelize.col('kode'), whereChar), 'kode']]
	if(bagian === 'kabkota' || bagian === 'kecamatan' || bagian === 'kelurahan')
	where = { 
		kode: { [Op.like]: `${KodeWilayah}%` },
		statusAktif: true,
	}
	if(bagian === 'provinsi') { attributes.push(['nama_prov', 'nama']) }
	if(bagian === 'kabkotaOnly' || bagian === 'kabkota') { attributes.push('jenisKabKota', ['nama_kabkota', 'nama']) }
	if(bagian === 'kecamatanOnly' || bagian === 'kecamatan') { attributes.push(['nama_kec', 'nama']) }
	if(bagian === 'kelurahanOnly' || bagian === 'kelurahan') { attributes.push('jenisKelDes', ['nama_keldes', 'nama'], 'kodePos') }
	const dataWilayah = await models.Wilayah2023.findAll({
		where,
		attributes,
		order: [['kode', 'ASC']],
		group: [sequelize.fn('LEFT', sequelize.col('kode'), whereChar)]
	});
	
	let wilayahResult = [];
	if(bagian === 'provinsi'){
		await dataWilayah.map(val => {
			if(val.kode === '31' || val.kode === '32' || val.kode === '36') {
				wilayahResult.push({
					kode: val.dataValues.kode,
					namaWilayah: val.dataValues.nama,
				});
			}
		})
	}else if(bagian === 'kabkota'){
		await dataWilayah.map(val => {
			if(KodeWilayah === '31'){
				if(val.kode !== '31.01') {
					wilayahResult.push({
						kode: val.dataValues.kode,
						namaWilayah: `${val.dataValues.jenisKabKota} ${val.dataValues.nama}`,
					});
				}
			}else if(KodeWilayah === '32'){
				if(val.kode === '32.01' || val.kode === '32.16' || val.kode === '32.71' || val.kode === '32.75' || val.kode === '32.76') {
					wilayahResult.push({
						kode: val.dataValues.kode,
						namaWilayah: `${val.dataValues.jenisKabKota} ${val.dataValues.nama}`,
					});
				}
			}else if(KodeWilayah === '36'){
				if(val.kode === '36.03' || val.kode === '36.71') {
					wilayahResult.push({
						kode: val.dataValues.kode,
						namaWilayah: `${val.dataValues.jenisKabKota} ${val.dataValues.nama}`,
					});
				}
			}
		})
	}else if(bagian === 'kecamatan'){
		wilayahResult = await dataWilayah.map(val => {
			return {
				kode: val.dataValues.kode,
				namaWilayah: val.dataValues.nama,
			}
		});
	}else if(bagian === 'kelurahan'){
		wilayahResult = await dataWilayah.map(val => {
			return {
				kode: val.dataValues.kode,
				namaWilayah: `${val.dataValues.jenisKelDes} ${val.dataValues.nama}`,
				kodePos: val.dataValues.kodePos,
			}
		});
	}
	return wilayahResult
}

module.exports = {
	_allOption,
	_anakOption,
	_wilayahpanjaitanOption,
	_ompuOption,
	_komisariswilayahOption,
	_wilayah2023Option,
	_wilayah2023Cetak,
}