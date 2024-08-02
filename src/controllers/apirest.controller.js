const {
	response,
	OK,
	NOT_FOUND,
	NO_CONTENT,
	UNAUTHORIZED
} = require('@triyogagp/backend-common/utils/response.utils');
const {
	request
} = require('@triyogagp/backend-common/utils/request.utils');
const {
	encrypt,
	decrypt,
	setNum,
	shuffleArray,
	getRandomArray,
	makeRandom,
	dateconvert,
	convertDate,
	convertDate3,
	convertDateTime2,
	convertDateTime3,
	splitTime,
	createKSUID,
	pembilang,
	makeRandomAngka,
	uppercaseLetterFirst,
	uppercaseLetterFirst2,
	buildMysqlResponseWithPagination,
	paginate,
	buildOrderQuery,
} = require('@triyogagp/backend-common/utils/helper.utils');
const {
	_allOption,
	_anakOption,
	_wilayahpanjaitanOption,
	_ompuOption,
	_komisariswilayahOption,
	_wilayah2023Option,
	_wilayah2023Cetak,
	_iuranAllData,
	_penanggungjawabAllData,
	_tugasAllData,
} = require('./helper.service')
const { 
	_buildResponseAdmin,
} = require('../utils/build-response');
const { Op } = require('sequelize')
const sequelize = require('sequelize')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const excel = require("exceljs");
const ejs = require("ejs");
const pdf = require("html-pdf");
const path = require("path");
const fs = require('fs');
const _ = require('lodash');
const { DateTime } = require('luxon')
const { logger } = require('../configs/db.winston')
const nodeGeocoder = require('node-geocoder');
const readXlsxFile = require('read-excel-file/node');
const { sequelizeInstance } = require('../configs/db.config');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const id = require('dayjs/locale/id');
const dotenv = require('dotenv');
dotenv.config();
const BASE_URL = process.env.BASE_URL

dayjs.extend(utc);
dayjs.extend(timezone);

function getAnggota (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 20, keyword } = req.query
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ namaLengkap : { [Op.like]: `%${keyword}%` }},
					{ nik : { [Op.like]: `%${keyword}%` }},
					{ '$WilayahPanjaitan.label$' : { [Op.like]: `%${keyword}%` }},
					{ '$KomisarisWilayah.nama_komisaris$' : { [Op.like]: `%${keyword}%` }},
					{ '$Ompu.label$' : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const { count, rows: dataBiodata } = await models.Biodata.findAndCountAll({
				where: whereKey,
				include: [
					{ 
						model: models.KomisarisWilayah,
					},
					{ 
						model: models.WilayahPanjaitan,
					},
					{ 
						model: models.Ompu,
					},
				],
				order: [['createdAt', 'DESC']],
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const getResult = await Promise.all(dataBiodata.map(async val => {
				return {
					idBiodata: val.idBiodata,
					nik: val.nik,
					namaLengkap: val.namaLengkap,
					tempatSuami: val.tempatSuami,
					tanggalLahirSuami: val.tanggalLahirSuami,
					alamat: val.alamat,
					provinsi: val.provinsi ? await _wilayah2023Option({ models, kode: val.provinsi, bagian: 'provinsi' }) : null,
					kabKota: val.kabKota ? await _wilayah2023Option({ models, kode: val.kabKota, bagian: 'kabkota' }) : null,
					kecamatan: val.kecamatan ? await _wilayah2023Option({ models, kode: val.kecamatan, bagian: 'kecamatan' }) : null,
					kelurahan: val.kelurahan ? await _wilayah2023Option({ models, kode: val.kelurahan, bagian: 'keldes' }) : null,
					kodePos: val.kodePos,
					pekerjaanSuami: val.pekerjaanSuami,
					telp: val.telp,
					namaIstri: val.namaIstri,
					tempatIstri: val.tempatIstri,
					tanggalLahirIstri: val.tanggalLahirIstri,
					pekerjaanIstri: val.pekerjaanIstri,
					telpIstri: val.telpIstri,
					anak: await _anakOption({ models, idBiodata: val.idBiodata }),
					jabatanPengurus: val.jabatanPengurus,
					wilayah: val.WilayahPanjaitan,
					komisarisWilayah: await _komisariswilayahOption({ models, kodeKomisarisWilayah: val.komisarisWilayah }),
					ompu: val.Ompu,
					generasi: val.generasi,
					fotoProfil: val.fotoProfil ? `${BASE_URL}image/${val.fotoProfil}` : `${BASE_URL}bahan/user.png`,
					statusSuami: val.statusSuami,
					tanggalWafatSuami: val.tanggalWafatSuami,
					statusIstri: val.statusIstri,
					tanggalWafatIstri: val.tanggalWafatIstri,
					statusBiodata: val.statusBiodata,
				}
			}))

			const responseData = buildMysqlResponseWithPagination(
				getResult,
				{ limit, page, total: count }
			)

			return OK(res, responseData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

module.exports = {
  getAnggota,
}