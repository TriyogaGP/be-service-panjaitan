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
	convertDateForDay,
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
	uppercaseLetterFirst3,
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
} = require('../controllers/helper.service')
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

function getDashboard (models) {
  return async (req, res, next) => {
    try {
			const { consumerType, wilayah } = req.JWTDecoded
			const dataWilayah = await _allOption({ table: models.WilayahPanjaitan })
			const responseData = await Promise.all(dataWilayah.map(async val => {
				const count = await models.Biodata.count({where: { wilayah: val.kode }});
				const dataBiodata = await models.Biodata.findAll({where: { wilayah: val.kode }});
				const countObj = dataBiodata.reduce((acc, curr) => {
					const tmp = acc
					const { statusSuami, statusIstri } = curr
					if(statusSuami === 'Hidup') tmp.suami += 1
					if(statusIstri === 'Hidup') tmp.istri += 1
					return tmp
				}, {
					suami: 0,
					istri: 0,
				});

				const databiodata = await models.Biodata.findAll({where: { wilayah: val.kode }, attributes: ['idBiodata']});
				const anak = await _anakOption({ models, idBiodata: databiodata.map(str => str.idBiodata) })
				let obj = {
					kode: val.kode,
					label: val.label,
					jml: count,
					totalJiwa: anak.length + countObj.suami + countObj.istri,
				}
				return obj;
			}))

			// return OK(res, consumerType === 1 || consumerType === 2 ? { responseData, total } : responseData.filter(val => val.kode === wilayah));
			return OK(res, consumerType === 1 || consumerType === 2 ? responseData : responseData.filter(val => val.kode === wilayah));
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDashboardTwo (models) {
  return async (req, res, next) => {
		let { kodeWilayah } = req.query
    try {
			const { consumerType, wilayah } = req.JWTDecoded
			const dataKomisarisWilayah = await _allOption({ table: models.KomisarisWilayah, where: { kodeWilayah: kodeWilayah ? kodeWilayah : wilayah, statusKomisaris: true } })
			const responseData = await Promise.all(dataKomisarisWilayah.map(async val => {
				const count = await models.Biodata.count({where: { komisarisWilayah: val.kodeKomisarisWilayah }});
				const dataBiodata = await models.Biodata.findAll({where: { komisarisWilayah: val.kodeKomisarisWilayah }});
				const countObj = dataBiodata.reduce((acc, curr) => {
					const tmp = acc
					const { statusSuami, statusIstri } = curr
					if(statusSuami === 'Hidup') tmp.suami += 1
					if(statusIstri === 'Hidup') tmp.istri += 1
					return tmp
				}, {
					suami: 0,
					istri: 0,
				});

				const databiodata = await models.Biodata.findAll({where: { komisarisWilayah: val.kodeKomisarisWilayah }, attributes: ['idBiodata']});
				const anak = await _anakOption({ models, idBiodata: databiodata.map(str => str.idBiodata) })
				let obj = {
					kodeKomisarisWilayah: val.kodeKomisarisWilayah,
					kodeWilayah: val.kodeWilayah,
					namaKomisaris: val.namaKomisaris,
					daerah: val.daerah,
					jml: count,
					totalJiwa: anak.length + countObj.suami + countObj.istri,
				}
				return obj;
			}))
			return OK(res, responseData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getAdmin (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 20, sort = '', keyword } = req.query
    let where = {}
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ nama : { [Op.like]: `%${keyword}%` }},
					{ username : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const mappingSortField = [
				'nama',
				['namaRole', sequelize.literal('`RoleAdmin.namaRole`')],
				'statusAdmin',
			]
			const orders = buildOrderQuery(sort, mappingSortField)
			
			if(orders.length === 0){
				orders.push(['createdAt', 'DESC'])
			}

			where = whereKey;

      const { count, rows: dataAdmin } = await models.Admin.findAndCountAll({
				where,
				// attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{ 
						model: models.RoleAdmin,
						attributes: ['namaRole'],
						where: { statusRole: true }
					},
				],
				order: orders,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			// return OK(res, dataAdmin)
			const getResult = await Promise.all(dataAdmin.map(async val => {
				return await _buildResponseAdmin(models, val)
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

function getAdminbyUid (models) {
  return async (req, res, next) => {
		let { uid } = req.params
    try {
      const dataAdmin = await models.Admin.findOne({
				where: { idAdmin: uid },
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{ 
						model: models.RoleAdmin,
						attributes: ['namaRole'],
						where: { statusRole: true }
					},
				],
			});

			return OK(res, await _buildResponseAdmin(models, dataAdmin))
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function postAdmin (models) {
  return async (req, res, next) => {
		let body = req.body
		let where = {}
    try {
			const { userID } = req.JWTDecoded
			let salt, hashPassword, kirimdataUser;
			if(body.jenis == 'ADD'){
				where = { 
					statusAdmin: true,
					username: body.username,
				}
				const count = await models.Admin.count({where});
				if(count) return NOT_FOUND(res, 'data sudah di gunakan !')
				// const ksuid = await createKSUID()
				salt = await bcrypt.genSalt();
				hashPassword = await bcrypt.hash(body.password, salt);
				kirimdataUser = {
					idAdmin: body.idAdmin,
					consumerType: body.consumerType,
					wilayah: body.wilayah,
					nama: body.nama,
					username: body.username,
					password: hashPassword,
					kataSandi: encrypt(body.password),
					statusAdmin: 1,
					createBy: userID,
				}
				await models.Admin.create(kirimdataUser)
			}else if(body.jenis == 'EDIT'){
				if(await models.Admin.findOne({where: {username: body.username, [Op.not]: [{idAdmin: body.idAdmin}]}})) return NOT_FOUND(res, 'Username sudah di gunakan !')
				const data = await models.Admin.findOne({where: {idAdmin: body.idAdmin}});
				salt = await bcrypt.genSalt();
				let decryptPass = data.kataSandi != body.password ? body.password : decrypt(body.password)
				hashPassword = await bcrypt.hash(decryptPass, salt);
				kirimdataUser = {
					consumerType: body.consumerType,
					wilayah: body.wilayah,
					nama: body.nama,
					username: body.username,
					password: hashPassword,
					kataSandi: data.kataSandi == body.password ? body.password : encrypt(body.password),
					statusAdmin: 1,
					updateBy: userID,
				}
				await models.Admin.update(kirimdataUser, { where: { idAdmin: body.idAdmin } })
			}else if(body.jenis == 'DELETESOFT'){
				kirimdataUser = {
					statusAdmin: 0,
					deleteBy: userID,
					deletedAt: new Date(),
				}
				await models.Admin.update(kirimdataUser, { where: { idAdmin: body.idAdmin } })	
			}else if(body.jenis == 'DELETEHARD'){
				await sequelizeInstance.transaction(async trx => {
					const datauser = await models.Admin.findOne({
						where: { idAdmin: body.idAdmin },
					}, { transaction: trx });
					const { fotoProfil } = datauser
					if(fotoProfil){
						let path_dir = path.join(__dirname, `../public/image/${body.idAdmin}`);
						fs.readdirSync(path_dir, { withFileTypes: true });
						fs.rm(path_dir, { recursive: true, force: true }, (err) => {
							if (err) {
								console.log(err);
							}
						});
					}
					await models.Admin.destroy({ where: { idAdmin: body.idAdmin } }, { transaction: trx });
				})
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdataUser = { 
					statusAdmin: body.kondisi, 
					updateBy: userID
				}
				await models.Admin.update(kirimdataUser, { where: { idAdmin: body.idAdmin } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getBiodata (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 20, sort = '', filter = '', keyword } = req.query
    let where = {}
    let where2 = {}
    try {
			const { consumerType, wilayah } = req.JWTDecoded
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			if(filter){
				let splitFilter = filter.split('-')
				if(splitFilter[0] === 'Status') {
					where2.statusSuami = splitFilter[1]
				}else if(splitFilter[0] === 'Wilayah') {
					let textSplit = splitFilter.length > 2 ? `${splitFilter[1]}-${splitFilter[2]}` : `${splitFilter[1]}`
					where2 = { '$WilayahPanjaitan.label$' : { [Op.like]: `%${textSplit}%` }}
				}else if(splitFilter[0] === 'Komisaris') {
					// where2 = { '$KomisarisWilayah.nama_komisaris$' : { [Op.like]: `%${splitFilter[1]}%` }}
					where2 = { komisarisWilayah : { [Op.like]: `%${splitFilter[1]}%` }}
				}
			}

			const whereKey = keyword ? {
				[Op.or]: [
					{ namaLengkap : { [Op.like]: `%${keyword}%` }},
					{ namaIstri : { [Op.like]: `%${keyword}%` }},
					{ nik : { [Op.like]: `%${keyword}%` }},
					{ '$WilayahPanjaitan.label$' : { [Op.like]: `%${keyword}%` }},
					consumerType !== 3 && { '$KomisarisWilayah.nama_komisaris$' : { [Op.like]: `%${keyword}%` }},
					{ '$Ompu.label$' : { [Op.like]: `%${keyword}%` }},
					// { statusSuami : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const mappingSortField = [
				['nama', 'namaLengkap'],
				'nik',
				['wilayah', sequelize.literal('`WilayahPanjaitan.label`')],
				['ompu', sequelize.literal('`Ompu.label`')],
				['statusAktif', 'statusBiodata'],
			]

			const orders = buildOrderQuery(sort, mappingSortField)
			
			if(orders.length === 0){
				orders.push(['createdAt', 'DESC'])
			}

			where = consumerType !== 3 ? { ...whereKey, ...where2 } : { ...whereKey, ...where2, wilayah }

			const { count, rows: dataBiodata } = await models.Biodata.findAndCountAll({
				where,
				// attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'updatedAt', 'deletedAt'] },
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
				order: orders,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			// return OK(res, dataBiodata)
			const getResult = await Promise.all(dataBiodata.map(async val => {
				return {
					idBiodata: val.idBiodata,
					nik: val.nik,
					namaLengkap: val.namaLengkap ? uppercaseLetterFirst3(val.namaLengkap) : null,
					tempatSuami: val.tempatSuami ? uppercaseLetterFirst3(val.tempatSuami) : null,
					tanggalLahirSuami: val.tanggalLahirSuami,
					alamat: val.alamat ? uppercaseLetterFirst3(val.alamat) : '',
					provinsi: val.provinsi ? await _wilayah2023Option({ models, kode: val.provinsi, bagian: 'provinsi' }) : null,
					kabKota: val.kabKota ? await _wilayah2023Option({ models, kode: val.kabKota, bagian: 'kabkota' }) : null,
					kecamatan: val.kecamatan ? await _wilayah2023Option({ models, kode: val.kecamatan, bagian: 'kecamatan' }) : null,
					kelurahan: val.kelurahan ? await _wilayah2023Option({ models, kode: val.kelurahan, bagian: 'keldes' }) : null,
					kodePos: val.kodePos,
					pekerjaanSuami: val.pekerjaanSuami,
					telp: val.telp,
					namaIstri: val.namaIstri ? uppercaseLetterFirst3(val.namaIstri) : null,
					tempatIstri: val.tempatIstri ? uppercaseLetterFirst3(val.tempatIstri) : null,
					tanggalLahirIstri: val.tanggalLahirIstri,
					pekerjaanIstri: val.pekerjaanIstri,
					telpIstri: val.telpIstri,
					anak: await _anakOption({ models, idBiodata: val.idBiodata }),
					jabatanPengurus: val.jabatanPengurus ? uppercaseLetterFirst3(val.jabatanPengurus) : null,
					// wilayah: await _wilayahpanjaitanOption({ models, kode: val.wilayah }),
					wilayah: val.WilayahPanjaitan,
					komisarisWilayah: await _komisariswilayahOption({ models, kodeKomisarisWilayah: val.komisarisWilayah }),
					// ompu: await _ompuOption({ models, kode: val.ompu }),
					ompu: val.Ompu,
					generasi: val.generasi,
					fotoProfil: val.fotoProfil ? `${BASE_URL}image/${val.fotoProfil}` : `${BASE_URL}bahan/user.png`,
					statusSuami: val.statusSuami,
					tanggalWafatSuami: val.tanggalWafatSuami,
					statusIstri: val.statusIstri,
					tanggalWafatIstri: val.tanggalWafatIstri,
					statusBiodata: val.statusBiodata,
					flag: val.deleteBy !== null && val.deletedAt === null && !val.statusBiodata,
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

function getBiodatabyUid (models) {
  return async (req, res, next) => {
		let { uid } = req.params
    try {
      const dataBiodata = await models.Biodata.findOne({
				where: { idBiodata: uid },
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'updatedAt', 'deletedAt'] },
			});

			// return OK(res, dataBiodata)
			return OK(res, {
				idBiodata: dataBiodata.idBiodata,
					nik: dataBiodata.nik,
					namaLengkap: dataBiodata.namaLengkap,
					tempatSuami: dataBiodata.tempatSuami,
					tempatSuami: dataBiodata.tempatSuami,
					tanggalLahirSuami: dataBiodata.tanggalLahirSuami,
					alamat: dataBiodata.alamat,
					provinsi: dataBiodata.provinsi ? await _wilayah2023Option({ models, kode: dataBiodata.provinsi, bagian: 'provinsi' }) : null,
					kabKota: dataBiodata.kabKota ? await _wilayah2023Option({ models, kode: dataBiodata.kabKota, bagian: 'kabkota' }) : null,
					kecamatan: dataBiodata.kecamatan ? await _wilayah2023Option({ models, kode: dataBiodata.kecamatan, bagian: 'kecamatan' }) : null,
					kelurahan: dataBiodata.kelurahan ? await _wilayah2023Option({ models, kode: dataBiodata.kelurahan, bagian: 'keldes' }) : null,
					kodePos: dataBiodata.kodePos,
					pekerjaanSuami: dataBiodata.pekerjaanSuami,
					telp: dataBiodata.telp,
					namaIstri: dataBiodata.namaIstri,
					tempatIstri: dataBiodata.tempatIstri,
					tanggalLahirIstri: dataBiodata.tanggalLahirIstri,
					pekerjaanIstri: dataBiodata.pekerjaanIstri,
					telpIstri: dataBiodata.telpIstri,
					anak: await _anakOption({ models, idBiodata: dataBiodata.idBiodata }),
					jabatanPengurus: dataBiodata.jabatanPengurus,
					wilayah: await _wilayahpanjaitanOption({ models, kode: dataBiodata.wilayah }),
					komisarisWilayah: await _komisariswilayahOption({ models, kodeKomisarisWilayah: dataBiodata.komisarisWilayah }),
					ompu: await _ompuOption({ models, kode: dataBiodata.ompu }),
					generasi: dataBiodata.generasi,
					fotoProfil: dataBiodata.fotoProfil ? `${BASE_URL}image/${dataBiodata.fotoProfil}` : `${BASE_URL}bahan/user.png`,
					statusSuami: dataBiodata.statusSuami,
					tanggalWafatSuami: dataBiodata.tanggalWafatSuami,
					statusIstri: dataBiodata.statusIstri,
					tanggalWafatIstri: dataBiodata.tanggalWafatIstri,
					statusBiodata: dataBiodata.statusBiodata,
			})
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function postBiodata (models) {
  return async (req, res, next) => {
		let body = req.body
    try {
			const { userID, consumerType, nama } = req.JWTDecoded
			let kirimdataUser, kirimdataAnak = [];

			const pengecekanNik = async (body) => {
				const { wilayah, komisarisWilayah, ompu, generasi } = body
				let nik;
				const data = await models.Biodata.findOne({
					where: { wilayah, komisarisWilayah },
					attributes: ["nik"],
					order: [
						['createdAt', 'DESC'],
					],
				});

				if(data){
					let text = data.nik.split('.')[4]
					nik = `${wilayah}.${komisarisWilayah}.${ompu}${generasi}.${(parseInt(text.substr(2))+1).toString().padStart(4, '0')}`
				}else{
					nik = `${wilayah}.${komisarisWilayah}.${ompu}${generasi}.0001`
				}
				return nik;
			}

			if(body.jenis == 'ADD'){
				kirimdataUser = {
					idBiodata: body.idBiodata,
					nik: await pengecekanNik(body),
					namaLengkap: body.namaLengkap,
					tempatSuami: body.tempatSuami,
					tanggalLahirSuami: body.tanggalLahirSuami,
					alamat: body.alamat,
					provinsi: body.provinsi,
					kabKota: body.kabKota,
					kecamatan: body.kecamatan,
					kelurahan: body.kelurahan,
					kodePos: body.kodePos,
					pekerjaanSuami: body.pekerjaanSuami,
					telp: body.telp,
					namaIstri: body.namaIstri,
					tempatIstri: body.tempatIstri,
					tanggalLahirIstri: body.tanggalLahirIstri,
					pekerjaanIstri: body.pekerjaanIstri,
					telpIstri: body.telpIstri,
					jabatanPengurus: body.jabatanPengurus,
					wilayah: body.wilayah,
					komisarisWilayah: body.komisarisWilayah,
					ompu: body.ompu,
					generasi: body.generasi,
					statusSuami: body.statusSuami,
					tanggalWafatSuami: body.tanggalWafatSuami,
					statusIstri: body.statusIstri,
					tanggalWafatIstri: body.tanggalWafatIstri,
					statusBiodata: 1,
					createBy: userID,
				}

				body.anak.map(val => {
					kirimdataAnak.push({
						idAnak: makeRandom(10),
						idBiodata: body.idBiodata,
						kategoriAnak: val.kategoriAnak,
						namaAnak: val.namaAnak,
						tanggalLahir: val.tanggalLahir,
						statusAnak: val.statusAnak,
					})
				})

				let dataIuran = []
				let tahun = dayjs().format('YYYY')
				for (let index = 2024; index <= Number(tahun); index++) {
					dataIuran.push({
						tahun: String(index),
						iuran: {
							januari: 0,
							februari: 0,
							maret: 0,
							april: 0,
							mei: 0,
							juni: 0,
							juli: 0,
							agustus: 0,
							september: 0,
							oktober: 0,
							november: 0,
							desember: 0,
							total: 0,
						}
					})
				}

				await sequelizeInstance.transaction(async trx => {
					let kirimdataIuran = {
						idIuran: makeRandom(10),
						idBiodata: body.idBiodata,
						komisarisWilayah: body.komisarisWilayah,
						iuran: JSON.stringify(dataIuran),
						totalIuran: 0
					}
					await models.Biodata.create(kirimdataUser, { transaction: trx })
					await models.Iuran.create(kirimdataIuran, { transaction: trx })
					await models.Anak.bulkCreate(kirimdataAnak, { transaction: trx })
				})
			}else if(body.jenis == 'EDIT'){
				const cek = await models.Biodata.findOne({
					where: { idBiodata: body.idBiodata },
					attributes: ["wilayah", "nik", "komisarisWilayah"],
				});
				let nik;
				if(body.wilayah === cek.wilayah) {
					if(body.komisarisWilayah !== cek.komisarisWilayah) {
						nik = await pengecekanNik(body)
					}else{
						let nourut = cek.nik.split('.')[4]
						nik = `${body.wilayah}.${body.komisarisWilayah}.${body.ompu}${body.generasi}.${nourut}`
					}
				}else{
					nik = await pengecekanNik(body)
				}

				kirimdataUser = {
					idBiodata: body.idBiodata,
					nik,
					namaLengkap: body.namaLengkap,
					tempatSuami: body.tempatSuami,
					tanggalLahirSuami: body.tanggalLahirSuami,
					alamat: body.alamat,
					provinsi: body.provinsi,
					kabKota: body.kabKota,
					kecamatan: body.kecamatan,
					kelurahan: body.kelurahan,
					kodePos: body.kodePos,
					pekerjaanSuami: body.pekerjaanSuami,
					telp: body.telp,
					namaIstri: body.namaIstri,
					tempatIstri: body.tempatIstri,
					tanggalLahirIstri: body.tanggalLahirIstri,
					pekerjaanIstri: body.pekerjaanIstri,
					telpIstri: body.telpIstri,
					jabatanPengurus: body.jabatanPengurus,
					wilayah: body.wilayah,
					komisarisWilayah: body.komisarisWilayah,
					ompu: body.ompu,
					generasi: body.generasi,
					statusSuami: body.statusSuami,
					tanggalWafatSuami: body.tanggalWafatSuami,
					statusIstri: body.statusIstri,
					tanggalWafatIstri: body.tanggalWafatIstri,
					statusBiodata: 1,
					updateBy: userID,
				}

				body.anak.map(val => {
					kirimdataAnak.push({
						idAnak: makeRandom(10),
						idBiodata: body.idBiodata,
						kategoriAnak: val.kategoriAnak,
						namaAnak: val.namaAnak,
						tanggalLahir: val.tanggalLahir,
						statusAnak: val.statusAnak,
					})
				})

				await sequelizeInstance.transaction(async trx => {
					if(consumerType === 3){
						const dataAdmin = await models.Admin.findAll({
							where: { consumerType: { [Op.in]: [1, 2] } },
							attributes: ['idAdmin'],
						});

						let bodydata = {
							idAdmin: JSON.stringify(dataAdmin.map(val => val.idAdmin)),//id admin pusat
							jenis: 'Update',
							dataTemporary: JSON.stringify({
								title: `Request Update Record`,
								message: `Permintaan perubahan data oleh <strong>${nama}</strong><br />`,
								payload: { kirimdataUser, kirimdataAnak },
								reason: body.reason,
							}),
							imageTemporary: null,
							createBy: userID,
							statusExecute: 'Menunggu Persetujuan Permohonan',
							executedAt: dayjs().add(2, 'day').toDate(),
						}
						await models.TemporaryData.create(bodydata, { transaction: trx })
					}else{
						await models.Anak.destroy({ where: { idBiodata: body.idBiodata } }, { transaction: trx });
						await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } }, { transaction: trx })
						await models.Anak.bulkCreate(kirimdataAnak, { transaction: trx })
					}
				})
			}else if(body.jenis == 'DELETESOFT'){
				kirimdataUser = {
					statusBiodata: 0,
					deleteBy: userID,
					deletedAt: new Date(),
				}
				if(consumerType === 3){
					const dataAdmin = await models.Admin.findAll({
						where: { consumerType: { [Op.in]: [1, 2] } },
						attributes: ['idAdmin'],
					});

					let bodydata = {
						idAdmin: JSON.stringify(dataAdmin.map(val => val.idAdmin)),//id admin pusat
						jenis: 'Delete',
						dataTemporary: JSON.stringify({
							title: `Request Delete Record`,
							message: `Permintaan penghapusan data oleh <strong>${nama}</strong><br />`,
							payload: { kirimdataUser },
						}),
						imageTemporary: null,
						createBy: userID,
						executedAt: dayjs().add(2, 'day').toDate(),
					}
					await models.TemporaryData.create(bodydata)
				}else{
					await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } })
				}
			}else if(body.jenis == 'DELETEHARD'){
				await sequelizeInstance.transaction(async trx => {
					const datauser = await models.Biodata.findOne({
						where: { idBiodata: body.idBiodata },
					}, { transaction: trx });
					const { fotoProfil, namaLengkap, nik } = datauser
					if(consumerType === 3){
						const dataAdmin = await models.Admin.findAll({
							where: { consumerType: { [Op.in]: [1, 2] } },
							attributes: ['idAdmin'],
						});
	
						let bodydata = {
							idAdmin: JSON.stringify(dataAdmin.map(val => val.idAdmin)),//id admin pusat
							jenis: 'Delete',
							dataTemporary: JSON.stringify({
								title: `Request Delete Record`,
								message: `Permintaan penghapusan data oleh <strong>${nama}</strong> atas nama <strong>${namaLengkap}</strong> dan nik <strong>${nik}</strong><br />`,
								payload: { kirimdataUser: { idBiodata: body.idBiodata, namaLengkap, nik } },
								reason: body.reason,
							}),
							imageTemporary: null,
							createBy: userID,
							statusExecute: 'Menunggu Persetujuan Permohonan',
							executedAt: dayjs().add(2, 'day').toDate(),
						}
						kirimdataUser = {
							statusBiodata: 0,
							deleteBy: userID,
							// deletedAt: new Date(),
						}
						await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } })
						await models.TemporaryData.create(bodydata, { transaction: trx })
					}else{
						if(fotoProfil){
							let path_dir = path.join(__dirname, `../public/image/${body.idBiodata}`);
							fs.readdirSync(path_dir, { withFileTypes: true });
							fs.rm(path_dir, { recursive: true, force: true }, (err) => {
								if (err) {
									console.log(err);
								}
							});
						}
						await models.Biodata.destroy({ where: { idBiodata: body.idBiodata } }, { transaction: trx });
						await models.Iuran.destroy({ where: { idBiodata: body.idBiodata } }, { transaction: trx });
						await models.Anak.destroy({ where: { idBiodata: body.idBiodata } }, { transaction: trx });
					}
				})
			}else if(body.jenis == 'DELETESELECTEDHARD'){
				await sequelizeInstance.transaction(async trx => {
					if(consumerType === 3){
						const dataAdmin = await models.Admin.findAll({
							where: { consumerType: { [Op.in]: [1, 2] } },
							attributes: ['idAdmin'],
						});

						let dataUser = [];
						kirimdataUser = {
							statusBiodata: 0,
							deleteBy: userID,
							// deletedAt: new Date(),
						}

						let message = `Permintaan penghapusan data oleh <strong>${nama}</strong> atas nama : <ol style='padding-left:15px;'>`
						await Promise.all(body.idBiodata.map(async str => {
							const datauser = await models.Biodata.findOne({
								where: { idBiodata: str },
								attributes: ['nik', 'namaLengkap']
							}, { transaction: trx });
							const { namaLengkap, nik } = datauser

							dataUser.push({ idBiodata: str, nik, namaLengkap })
							message += `<li>${namaLengkap} (${nik})</li>`
							await models.Biodata.update(kirimdataUser, { where: { idBiodata: str } })
						}))
						message += `</ol>`
						
						let bodydata = {
							idAdmin: JSON.stringify(dataAdmin.map(val => val.idAdmin)),//id admin pusat
							jenis: 'DeleteAll',
							dataTemporary: JSON.stringify({
								title: `Request Delete Record`,
								message,
								payload: { kirimdataUser: dataUser },
								reason: body.reason,
							}),
							imageTemporary: null,
							createBy: userID,
							statusExecute: 'Menunggu Persetujuan Permohonan',
							executedAt: dayjs().add(2, 'day').toDate(),
						}
						await models.TemporaryData.create(bodydata, { transaction: trx })
					}else{
						await Promise.all(body.idBiodata.map(async str => {
							const datauser = await models.Biodata.findOne({
								where: { idBiodata: str },
							}, { transaction: trx });
							const { fotoProfil } = datauser
							if(fotoProfil){
								let path_dir = path.join(__dirname, `../public/image/${str}`);
								fs.readdirSync(path_dir, { withFileTypes: true });
								fs.rm(path_dir, { recursive: true, force: true }, (err) => {
									if (err) {
										console.log(err);
									}
								});
							}
							await models.Biodata.destroy({ where: { idBiodata: str } }, { transaction: trx });
							await models.Iuran.destroy({ where: { idBiodata: str } }, { transaction: trx });
							await models.Anak.destroy({ where: { idBiodata: str } }, { transaction: trx });
						}))
					}
				})
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdataUser = { 
					statusBiodata: body.kondisi, 
					updateBy: userID 
				}
				await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } })
				// if(consumerType === 3){
				// 	const dataAdmin = await models.Admin.findAll({
				// 		where: { consumerType: { [Op.in]: [1, 2] } },
				// 		attributes: ['idAdmin'],
				// 	});

				// 	let bodydata = {
				// 		idAdmin: JSON.stringify(dataAdmin.map(val => val.idAdmin)),//id admin pusat
				// 		jenis: 'Delete',
				// 		dataTemporary: JSON.stringify({
				// 			title: `Request Delete Record`,
				// 			message: `Permintaan penghapusan data oleh <strong>${nama}</strong>`,
				// 			payload: { kirimdataUser },
				// 		}),
				// 		imageTemporary: null,
				// 		createBy: userID,
				// 		executedAt: dayjs().add(2, 'day').toDate(),
				// 	}
				// 	await models.TemporaryData.create(bodydata)
				// }else{
				// 	await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } })
				// }
			}else if(body.jenis == 'STATUSMENINGGAL'){
				if(body.untuk === 'SUAMI'){
					kirimdataUser = { 
						statusSuami: body.statusMeninggal,
						tempatSuami: '',
						tanggalLahirSuami: null,
						pekerjaanSuami: '',
						telp : '',
						tanggalWafatSuami: body.statusMeninggal === 'Meninggal' ? body.tanggal_wafat : null,
						updateBy: userID
					}
					await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idStatus } })
				}else if(body.untuk === 'ISTRI'){
					kirimdataUser = { 
						statusIstri: body.statusMeninggal, 
						tempatIstri: null,
						tanggalLahirIstri: null,
						pekerjaanIstri: null,
						telpIstri: null,
						tanggalWafatIstri: body.statusMeninggal === 'Meninggal' ? body.tanggal_wafat : null,
						updateBy: userID
					}
					await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idStatus } })
				}else if(body.untuk === 'TANGGUNGAN'){
					kirimdataUser = { 
						statusAnak: body.statusMeninggal, 
						tanggalWafatAnak: body.statusMeninggal === 'Meninggal' ? body.tanggal_wafat : null,
					}
					await models.Anak.update(kirimdataUser, { where: { idAnak: body.idStatus } })
				}
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getIuran (models) {
	return async (req, res, next) => {
		let { komisaris_wilayah, tahun, keyword } = req.query
		let where = {}
		try {
			// let tahun = dayjs().format('YYYY')
			const whereKey = keyword ? {
				[Op.or]: [
					{ namaLengkap : { [Op.like]: `%${keyword}%` }},
					{ nik : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			where = { ...whereKey, komisarisWilayah: komisaris_wilayah }

			const dataBiodata = await models.Biodata.findAll({
				where,
				attributes: ['idBiodata', 'nik', 'namaLengkap', 'komisarisWilayah'],
				include: [
					{ 
						attributes: ['idIuran', 'iuran', 'totalIuran'],
						where: { komisarisWilayah: komisaris_wilayah },
						model: models.Iuran,
					},
				],
				order: [['createdAt', 'ASC']],
			});

			let result = await Promise.all(dataBiodata.map(str => {
				let iuran = JSON.parse(str.Iuran.iuran)
				let dataIuran = iuran.filter(val => val.tahun === tahun)
				// console.log(dataIuran);
				return {
					idBiodata: str.idBiodata,
					idIuran: str.Iuran.idIuran,
					nik: str.nik,
					namaLengkap: str.namaLengkap,
					komisarisWilayah: str.komisarisWilayah,
					iuran: dataIuran.length ? dataIuran[0].iuran : null,
					totalIuran: str.Iuran.totalIuran,
				}
			}))

			const dataTotal = await _iuranAllData({ models, tahun, komisaris_wilayah })

			// console.log(dataTotal);
			return OK(res, {
				result: result.length ? [...result, dataTotal.dataIuran] : [],
				totalKeseluruhanIuran: dataTotal.totalKeseluruhanIuran,
				totalKeseluruhanIuranPerTahun: dataTotal.totalKeseluruhanIuranPerTahun,
			})
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function postIuran (models) {
  return async (req, res, next) => {
		let body = req.body
    try {
			// const { userID } = req.JWTDecoded
			const dataIuran = await models.Iuran.findOne({ where: { idIuran: body.idIuran, idBiodata: body.idBiodata } })
			let hasil = JSON.parse(dataIuran.iuran)
			let dataiuran = hasil.filter(str => str.tahun !== body.tahun)
			let obj = dataiuran.length ? [ ...dataiuran, body.iuran ] : [ body.iuran ]
			const totalIuran = obj.reduce((acc, curr) => {
				const { iuran } = curr
				return {
					total: acc.total + iuran.total,
				};
			}, {
				total: 0,
			});
			let kirimdataIuran = {
				iuran: JSON.stringify(obj),
				totalIuran: totalIuran.total,
			}
			await models.Iuran.update(kirimdataIuran, { where: { idIuran: body.idIuran, idBiodata: body.idBiodata } })

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDataMeninggal (models) {
	return async (req, res, next) => {
		let { page = 1, limit = 20, sort = '', startdate, enddate, keyword } = req.query
		let where = {}
		try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			startdate = startdate ? startdate : DateTime.local().plus({ month: -1 }).toISODate(),
			enddate = enddate ? enddate : DateTime.local().toISODate()

			const whereKey = keyword ? {
				[Op.or]: [
					{ '$WilayahPanjaitan.label$' : { [Op.like]: `%${keyword}%` }},
					{ kategori : { [Op.like]: `%${keyword}%` }},
					{ nama : { [Op.like]: `%${keyword}%` }},
					{ yangDitinggal : { [Op.like]: `%${keyword}%` }},
					{ rumahDuka : { [Op.like]: `%${keyword}%` }},
					{ acaraAdat : { [Op.like]: `%${keyword}%` }},
					{ penanggungJawab : { [Op.like]: `%${keyword}%` }},
					{ yangMemberiSumbangan : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const mappingSortField = [
				'wilayah', 'tanggal', 'kategori'
			]
			const orders = buildOrderQuery(sort, mappingSortField)
			
			if(orders.length === 0){
				orders.push(['createdAt', 'DESC'])
			}
			
			where = {  ...whereKey, tanggal: { [Op.between]: [startdate, enddate] } }

			const { count, rows: dataMeninggal } = await models.RekapMeninggal.findAndCountAll({
				where,
				include: [
					{ 
						model: models.WilayahPanjaitan,
					},
				],
				order: orders,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const responseData = buildMysqlResponseWithPagination(
				dataMeninggal,
				{ limit, page, total: count }
			)

			return OK(res, responseData)
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function postDataMeninggal (models) {
  return async (req, res, next) => {
		let body = req.body
    try {
			let kirimdata;
			const { userID } = req.JWTDecoded
			if(body.jenis == 'ADD'){
				kirimdata = {
					idRekap: makeRandom(10),
					wilayah: body.wilayah,
					tanggal: body.tanggal,
					kategori: body.kategori,
					nama: body.nama,
					yangDitinggal: body.yangDitinggal,
					rumahDuka: body.rumahDuka,
					acaraAdat: body.acaraAdat,
					penanggungJawab: body.penanggungJawab,
					yangMemberiSumbangan: body.yangMemberiSumbangan,
					keterangan: body.keterangan,
					createBy: userID,
				}
				await models.RekapMeninggal.create(kirimdata)
			}else if(body.jenis == 'EDIT'){
				kirimdata = {
					wilayah: body.wilayah,
					tanggal: body.tanggal,
					kategori: body.kategori,
					nama: body.nama,
					yangDitinggal: body.yangDitinggal,
					rumahDuka: body.rumahDuka,
					acaraAdat: body.acaraAdat,
					penanggungJawab: body.penanggungJawab,
					yangMemberiSumbangan: body.yangMemberiSumbangan,
					keterangan: body.keterangan,
					createBy: userID,
				}
				await models.RekapMeninggal.update(kirimdata, { where: { idRekap: body.idRekap } })
			}else if(body.jenis == 'DELETE'){
				await models.RekapMeninggal.destroy({ where: { idRekap: body.idRekap } })	
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDataMenikah (models) {
	return async (req, res, next) => {
		let { page = 1, limit = 20, sort = '', startdate, enddate, keyword } = req.query
		let where = {}
		try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			startdate = startdate ? startdate : DateTime.local().plus({ month: -1 }).toISODate(),
			enddate = enddate ? enddate : DateTime.local().toISODate()

			const whereKey = keyword ? {
				[Op.or]: [
					{ '$WilayahPanjaitan.label$' : { [Op.like]: `%${keyword}%` }},
					{ kategori : { [Op.like]: `%${keyword}%` }},
					{ nama : { [Op.like]: `%${keyword}%` }},
					{ orangTuaMenantu : { [Op.like]: `%${keyword}%` }},
					{ pemberkatan : { [Op.like]: `%${keyword}%` }},
					{ penanggungJawab : { [Op.like]: `%${keyword}%` }},
					{ yangMemberiSumbangan : { [Op.like]: `%${keyword}%` }},
					{ pemberiUlos : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const mappingSortField = [
				'wilayah', 'tanggal', 'kategori'
			]
			const orders = buildOrderQuery(sort, mappingSortField)
			
			if(orders.length === 0){
				orders.push(['createdAt', 'DESC'])
			}
			
			where = {  ...whereKey, tanggal: { [Op.between]: [startdate, enddate] } }

			const { count, rows: dataMenikah } = await models.RekapMenikah.findAndCountAll({
				where,
				include: [
					{ 
						model: models.WilayahPanjaitan,
					},
				],
				order: orders,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const responseData = buildMysqlResponseWithPagination(
				dataMenikah,
				{ limit, page, total: count }
			)

			return OK(res, responseData)
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function postDataMenikah (models) {
  return async (req, res, next) => {
		let body = req.body
    try {
			let kirimdata;
			const { userID } = req.JWTDecoded
			if(body.jenis == 'ADD'){
				kirimdata = {
					idRekap: makeRandom(10),
					wilayah: body.wilayah,
					tanggal: body.tanggal,
					kategori: body.kategori,
					nama: body.nama,
					orangTuaMenantu: body.orangTuaMenantu,
					pemberkatan: body.pemberkatan,
					penanggungJawab: body.penanggungJawab,
					yangMemberiSumbangan: body.yangMemberiSumbangan,
					pemberiUlos: body.pemberiUlos,
					keterangan: body.keterangan,
					createBy: userID,
				}
				await models.RekapMenikah.create(kirimdata)
			}else if(body.jenis == 'EDIT'){
				kirimdata = {
					wilayah: body.wilayah,
					tanggal: body.tanggal,
					kategori: body.kategori,
					nama: body.nama,
					orangTuaMenantu: body.orangTuaMenantu,
					pemberkatan: body.pemberkatan,
					penanggungJawab: body.penanggungJawab,
					yangMemberiSumbangan: body.yangMemberiSumbangan,
					pemberiUlos: body.pemberiUlos,
					keterangan: body.keterangan,
					createBy: userID,
				}
				await models.RekapMenikah.update(kirimdata, { where: { idRekap: body.idRekap } })
			}else if(body.jenis == 'DELETE'){
				await models.RekapMenikah.destroy({ where: { idRekap: body.idRekap } })	
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getManagePenanggungJawab (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 20, keyword } = req.query
    let where = {}
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ nama : { [Op.like]: `%${keyword}%` }},
					{ kategori : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			where = whereKey;

      const { count, rows: dataRekapPenanggungJawab } = await models.RekapPenanggungJawab.findAndCountAll({
				where,
				order: [['kategori', 'ASC']],
				limit: parseInt(limit),
				offset: OFFSET,
			});

			// return OK(res, dataRekapPenanggungJawab)
			const getResult = await Promise.all(dataRekapPenanggungJawab.map(async val => {
				return {
					idRekap: val.idRekap,
					kategori: val.kategori,
					nama: val.nama,
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

function getPenanggungJawab (models) {
	return async (req, res, next) => {
		let { tahun, kategori, keyword } = req.query
		let where = {}
		try {
			where = keyword ? { nama : { [Op.like]: `%${keyword}%` }} : {}

			const dataRekapPenanggungJawab = await models.RekapPenanggungJawab.findAll({
				where,
				order: [['nama', 'ASC']],
			});

			let result = await Promise.all(dataRekapPenanggungJawab.map(str => {
				let penanggungjawab = kategori === 'menikah' ? JSON.parse(str.menikah) : JSON.parse(str.meninggal)
				let dataPenanggungJawab = penanggungjawab.filter(val => val.tahun === tahun)

				return {
					idRekap: str.idRekap,
					kategori: str.kategori,
					nama: str.nama,
					penanggungjawab: dataPenanggungJawab.length ? kategori === 'menikah' ? dataPenanggungJawab[0].menikah : dataPenanggungJawab[0].meninggal : null,
					totalPenanggungJawab: kategori === 'menikah' ? str.totalMenikah : str.totalMeninggal,
				}
			}))

			if(result.filter(val => val.penanggungjawab === null).length) return OK(res)
			const totalPenanggungJawab = await _penanggungjawabAllData({ models, tahun, kategori })

			return OK(res, { 
				result: [{
					idRekap: '',
					kategori: 'Bidang Adat',
					nama: '',
					penanggungjawab: null,
					totalPenanggungJawab: 0,
				}, ...result.filter(str => str.kategori === 'Bidang Adat'),
				{
					idRekap: '',
					kategori: 'Penasehat Tetap / Ketua Bidang / Ketua Wilayah',
					nama: '',
					penanggungjawab: null,
					totalPenanggungJawab: 0,
				}, ...result.filter(str => str.kategori === 'Penasehat Tetap / Ketua Bidang / Ketua Wilayah'), totalPenanggungJawab.dataPenanggungJawab],
				totalKeseluruhanPenanggungJawab: totalPenanggungJawab.totalKeseluruhanPenanggungJawab,
				totalKeseluruhanPenanggungJawabPerTahun: totalPenanggungJawab.totalKeseluruhanPenanggungJawabPerTahun,
			})
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function postPenanggungJawab (models) {
  return async (req, res, next) => {
		let body = req.body
    try {
			// const { userID } = req.JWTDecoded
			if(body.jenis === 'ubahnilai'){
				const dataPenanggungJawab = await models.RekapPenanggungJawab.findOne({ where: { idRekap: body.idRekap } })
				let hasil = body.kategori === 'menikah' ? JSON.parse(dataPenanggungJawab.menikah) : JSON.parse(dataPenanggungJawab.meninggal)
				let datapenangungjawab = hasil.filter(str => str.tahun !== body.tahun)
				let obj = datapenangungjawab.length ? [ ...datapenangungjawab, body.kategori === 'menikah' ? {
					tahun: body.penanggungjawab.tahun,
					menikah: body.penanggungjawab.penanggungjawab
				} : {
					tahun: body.penanggungjawab.tahun,
					meninggal: body.penanggungjawab.penanggungjawab
				} ] : [ body.kategori === 'menikah' ? {
					tahun: body.penanggungjawab.tahun,
					menikah: body.penanggungjawab.penanggungjawab
				} : {
					tahun: body.penanggungjawab.tahun,
					meninggal: body.penanggungjawab.penanggungjawab
				} ]
				const totalPenanggungJawab = obj.reduce((acc, curr) => {
					const { menikah, meninggal } = curr
					const totalData = body.kategori === 'menikah' ? menikah.total : meninggal.total
					return {
						total: acc.total + totalData,
					};
				}, {
					total: 0,
				});
				let kirimdataPenanggungJawab = body.kategori === 'menikah' ? {
					menikah: JSON.stringify(obj),
					totalMenikah: totalPenanggungJawab.total,
				} : {
					meninggal: JSON.stringify(obj),
					totalMeninggal: totalPenanggungJawab.total,
				}
				await models.RekapPenanggungJawab.update(kirimdataPenanggungJawab, { where: { idRekap: body.idRekap } })
			}else if(body.jenis === 'ubahdata'){
				if(body.type === 'ADD'){
					let dataMenikah = [], dataMeninggal = []
					for (let index = 2024; index <= 2030; index++) {
						dataMenikah.push({
							tahun: String(index),
							menikah: {
								januari: 0,
								februari: 0,
								maret: 0,
								april: 0,
								mei: 0,
								juni: 0,
								juli: 0,
								agustus: 0,
								september: 0,
								oktober: 0,
								november: 0,
								desember: 0,
								total: 0,
							}
						})
						dataMeninggal.push({
							tahun: String(index),
							meninggal: {
								januari: 0,
								februari: 0,
								maret: 0,
								april: 0,
								mei: 0,
								juni: 0,
								juli: 0,
								agustus: 0,
								september: 0,
								oktober: 0,
								november: 0,
								desember: 0,
								total: 0,
							}
						})
					}

					let kirimdata = {
						idRekap: makeRandom(10),
						kategori: body.kategori,
						nama: body.nama,
						menikah: JSON.stringify(dataMenikah),
						meninggal: JSON.stringify(dataMeninggal),
						totalMenikah: '0',
						totalMeninggal: '0',
					}

					await models.RekapPenanggungJawab.create(kirimdata)
				}else if(body.type === 'EDIT'){
					let kirimdata = {
						kategori: body.kategori,
						nama: body.nama,
					}

					await models.RekapPenanggungJawab.update(kirimdata, { where: { idRekap: body.idRekap } })
				}else if(body.type === 'DELETE'){
					await models.RekapPenanggungJawab.destroy({ where: { idRekap: body.idRekap } })
				}
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getTugas (models) {
	return async (req, res, next) => {
		// , kategori
		let { tahun, bulan, keyword } = req.query
		let where = {}
		try {
			// let tahun = dayjs().format('YYYY')
			where = keyword ? { '$WilayahPanjaitan.label$' : { [Op.like]: `%${keyword}%` }} : {}

			const dataRekapTugas = await models.RekapTugas.findAll({
				where,
				include: [
					{ 
						model: models.WilayahPanjaitan,
					},
				],
				order: [['wilayah', 'ASC']],
			});

			let result = await Promise.all(dataRekapTugas.map(str => {
				let tugasMenikah = JSON.parse(str.menikah)
				let tugasMeninggal = JSON.parse(str.meninggal)
				let datatugasMenikahTemp = tugasMenikah.filter(val => val.tahun === tahun)
				let datatugasMeninggalTemp = tugasMeninggal.filter(val => val.tahun === tahun)
				let wadahMenikah = datatugasMenikahTemp.length ? datatugasMenikahTemp[0].menikah : []
				let wadahMeninggal = datatugasMeninggalTemp.length ? datatugasMeninggalTemp[0].meninggal : []
				let dataTugasMenikah = wadahMenikah.filter(val => val.bulan === parseInt(bulan))
				let dataTugasMeninggal = wadahMeninggal.filter(val => val.bulan === parseInt(bulan))
				let gabungTemp = Object.assign(dataTugasMenikah.length && dataTugasMenikah[0].data, dataTugasMeninggal.length && dataTugasMeninggal[0].data)
				let gabung = gabungTemp !== 0 ? Object.assign(gabungTemp, {total: gabungTemp ? gabungTemp.totalmenikah + gabungTemp.totalmeninggal : 0}) : null
				return {
					idRekap: str.idRekap,
					wilayahKode: str.WilayahPanjaitan.kode,
					wilayahNama: str.WilayahPanjaitan.label,
					bulan,
					tugas: gabung,
					totalTugas: gabung.total,
				}
			}))

			// if(result.filter(val => val.tugas === null).length) return OK(res)
			const totalTugas = await _tugasAllData({ models, tahun, bulan })
			
			// console.log(totalTugas);
			return OK(res, { 
				result: [...result,
					totalTugas.dataTugasBulanIni,
					totalTugas.dataTugasSampaiBulanSebelumnya,
					totalTugas.dataTugasSampaiBulanIni,
				],
				totalKeseluruhanTugas: totalTugas.totalKeseluruhanTugas,
				totalKeseluruhanTugasPerTahun: totalTugas.totalKeseluruhanTugasPerTahun,
			})
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function postTugas (models) {
  return async (req, res, next) => {
		let body = req.body
    try {
			// const { userID } = req.JWTDecoded
			const dataTugas = await models.RekapTugas.findOne({ where: { idRekap: body.idRekap, wilayah: body.wilayah } })
			let hasilMenikah = JSON.parse(dataTugas.menikah)
			let hasilMeninggal = JSON.parse(dataTugas.meninggal)
			let datatugasMenikah_Tampung = hasilMenikah.filter(str => str.tahun !== body.tahun)
			let datatugasMeninggal_Tampung = hasilMeninggal.filter(str => str.tahun !== body.tahun)
			
			let datatugasMenikahTemp = hasilMenikah.filter(str => str.tahun === body.tahun)
			datatugasMenikahTemp = datatugasMenikahTemp.length ? datatugasMenikahTemp[0].menikah.filter(val => val.bulan !== body.bulan) : []
			datatugasMenikahTemp = _.sortBy([ ...datatugasMenikahTemp, body.menikah ], ['bulan'])

			let datatugasMeninggalTemp = hasilMeninggal.filter(str => str.tahun === body.tahun)
			datatugasMeninggalTemp = datatugasMeninggalTemp.length ? datatugasMeninggalTemp[0].meninggal.filter(val => val.bulan !== body.bulan) : []
			datatugasMeninggalTemp = _.sortBy([ ...datatugasMeninggalTemp, body.meninggal ], ['bulan'])

			datatugasMenikah_Tampung = _.sortBy([ ...datatugasMenikah_Tampung, { tahun: body.tahun, menikah: datatugasMenikahTemp}], ['tahun'])
			datatugasMeninggal_Tampung = _.sortBy([ ...datatugasMeninggal_Tampung, { tahun: body.tahun, meninggal: datatugasMeninggalTemp}], ['tahun'])

			const totalMenikah = datatugasMenikahTemp.reduce((acc, curr) => {
				return { totalmenikah: acc.totalmenikah + curr.data.totalmenikah };
			}, { totalmenikah: 0 });
			
			const totalMeninggal = datatugasMeninggalTemp.reduce((acc, curr) => {
				return { totalmeninggal: acc.totalmeninggal + curr.data.totalmeninggal };
			}, { totalmeninggal: 0 });

			let kirimdataTugas = {
				menikah: JSON.stringify(datatugasMenikah_Tampung),
				meninggal: JSON.stringify(datatugasMeninggal_Tampung),
				totalMenikah: totalMenikah.totalmenikah,
				totalMeninggal: totalMeninggal.totalmeninggal,
			}
			await models.RekapTugas.update(kirimdataTugas, { where: { idRekap: body.idRekap, wilayah: body.wilayah } })

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsWilayahPanjaitan (models) {
  return async (req, res, next) => {
		let { keyword } = req.query
    try {
			let totalKeseluruhanIuranWilayah = 0
			const where = keyword ? { label : { [Op.like]: `%${keyword}%` }} : {}
      const dataWilayahPanjaitan = await models.WilayahPanjaitan.findAll({
				where,
			});

			const result = await Promise.all(dataWilayahPanjaitan.map(async val => {
				const dataKomisarisWilayah = await models.KomisarisWilayah.findAll({
					attributes: ['kodeKomisarisWilayah'],
					where: { kodeWilayah: val.dataValues.kode, statusKomisaris: true },
				});
				let dataSearch = dataKomisarisWilayah.map(str => str.kodeKomisarisWilayah)
				const dataIuran = await models.Iuran.findAll({
					attributes: [
						[sequelize.fn('SUM', sequelize.col('total_iuran')), 'totalKeseluruhan'],
					],
					where: { komisarisWilayah: dataSearch },
					raw: true,
				});
				let { totalKeseluruhan } = dataIuran[0]
				totalKeseluruhanIuranWilayah += totalKeseluruhan
				return {
					...val.dataValues,
					lambang: val.dataValues.lambang ? `${BASE_URL}bahan/${val.dataValues.lambang}` : `${BASE_URL}bahan/No_Image_Available.jpg`, 
					totalIuran: totalKeseluruhan ? totalKeseluruhan : 0
				}
			}))
			
			return OK(res, { result, totalKeseluruhanIuranWilayah });
    } catch (err) {
			console.log(err);
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsKomisarisWilayah (models) {
  return async (req, res, next) => {
    let { kodeWilayah, keyword } = req.query
		let where = {}
    try {
			if(kodeWilayah){
				where = { kodeWilayah }
			}

			const whereKey = keyword ? {
				[Op.or]: [
					{ kodeKomisarisWilayah : { [Op.like]: `%${keyword}%` }},
					{ namaKomisaris : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

      const dataKomisarisWilayah = await models.KomisarisWilayah.findAll({
				where: { ...where, ...whereKey, statusKomisaris: true },
				include: [
					{ 
						model: models.WilayahPanjaitan,
					}
				],
			});

			const result = await Promise.all(dataKomisarisWilayah.map(async str => {
				const dataIuran = await models.Iuran.findAll({
					attributes: [
						[sequelize.fn('SUM', sequelize.col('total_iuran')), 'totalKeseluruhan'],
					],
					where: { komisarisWilayah: str.dataValues.kodeKomisarisWilayah },
					raw: true,
				});
				let { totalKeseluruhan } = dataIuran[0]
				return {
					idKomisaris: str.idKomisaris,
					kodeKomisarisWilayah: str.kodeKomisarisWilayah,
					kodeWilayah: str.kodeWilayah,
					namaWilayah: str.WilayahPanjaitan.label,
					namaKomisaris: str.namaKomisaris,
					daerah: str.daerah,
					totalIuran: totalKeseluruhan ? totalKeseluruhan : 0
				}
			}))

			return OK(res, result);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function downloadTemplate (models) {
	return async (req, res, next) => {
		let { wilayah, kategori } = req.query
	  try {
			if(kategori === 'datakeanggotaan'){
				let workbook = new excel.Workbook();
				let worksheetBiodata = workbook.addWorksheet("Biodata");
				let worksheetAnak = workbook.addWorksheet("Anak");
				let worksheetStatus = workbook.addWorksheet("Status");
				let worksheetOmpu = workbook.addWorksheet("Ompu");
				let worksheetWilayahPanjaitan = workbook.addWorksheet("Wilayah");
				let worksheetKomisarisWilayah = workbook.addWorksheet("Komisaris");
				let worksheetProvinsi = workbook.addWorksheet("Provinsi");
				let worksheetKabKota = workbook.addWorksheet("Kabupaten - Kota");
				let worksheetKecamatan = workbook.addWorksheet("Kecamatan");
				let worksheetKelurahan = workbook.addWorksheet("Kelurahan");

				//Data Keanggotaan
				worksheetBiodata.columns = [
					{ header: "triggerbiodata", key: "triggerBiodata", width: 20 },
					{ header: "NAMA SUAMI", key: "namaSuami", width: 35 },
					{ header: "TANGGAL LAHIR SUAMI", key: "tanggalLahirSuami", width: 30 },
					{ header: "TEMPAT SUAMI", key: "tempatSuami", width: 25 },
					{ header: "ALAMAT", key: "alamat", width: 45 },
					{ header: "PROVINSI", key: "provinsi", width: 20 },
					{ header: "KABUPATEN / KOTA", key: "kabKota", width: 25 },
					{ header: "KECAMATAN", key: "kecamatan", width: 20 },
					{ header: "KELURAHAN", key: "kelurahan", width: 20 },
					{ header: "KODE POS", key: "kodePos", width: 15 },
					{ header: "PEKERJAAN SUAMI", key: "pekerjaanSuami", width: 25 },
					{ header: "TELEPON SUAMI", key: "telp", width: 20 },
					{ header: "NAMA ISTRI", key: "namaIstri", width: 35 },
					{ header: "TEMPAT ISTRI", key: "tempatIstri", width: 25 },
					{ header: "TANGGAL LAHIR ISTRI", key: "tanggalLahirIstri", width: 30 },
					{ header: "PEKERJAAN ISTRI", key: "pekerjaanIstri", width: 25 },
					{ header: "TELEPON ISTRI", key: "telpIstri", width: 20 },
					{ header: "JABATAN PENGURUS", key: "jabatanPengurus", width: 25 },
					{ header: "WILAYAH", key: "wilayah", width: 15 },
					{ header: "KOMISARIS WILAYAH", key: "komisarisWilayah", width: 25 },
					{ header: "OMPU", key: "ompu", width: 10 },
					{ header: "GENERASI", key: "generasi", width: 15 },
					{ header: "STATUS SUAMI", key: "statusSuami", width: 20 },
					{ header: "STATUS ISTRI", key: "statusIstri", width: 20 },
				];

				// const date = new Date();
				// const formatter = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
				// const formattedDate = formatter.format(date);

				worksheetBiodata.addRows([{
					triggerBiodata: '1', 
					namaSuami: 'nama Suami', 
					tanggalLahirSuami: new Date(),
					tempatSuami: 'Bogor',
					alamat: 'Bogor', 
					provinsi: '32', 
					kabKota: '32.01', 
					kecamatan: '32.01.01', 
					kelurahan: '32.01.01.1002', 
					kodePos: '16913',
					pekerjaanSuami: 'Karyawan Swasta', 
					telp: '123456789', 
					namaIstri: 'nama Istri', 
					tempatIstri: 'Bogor',
					tanggalLahirIstri: new Date(),
					pekerjaanIstri: 'Guru', 
					telpIstri: '123456789', 
					jabatanPengurus: 'Ketua', 
					wilayah: wilayah === '00' ? '01' : wilayah, 
					komisarisWilayah: 'JakPus.001', 
					ompu: 'M', 
					generasi: '16', 
					statusSuami: 'Hidup', 
					statusIstri: 'Hidup', 
				}]);

				worksheetBiodata.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
							row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(13).alignment = { vertical: 'middle', horizontal: 'left' };
							row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(16).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(17).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(18).alignment = { vertical: 'middle', horizontal: 'center'};
							row.getCell(19).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(20).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(21).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(22).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(23).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(24).alignment = { vertical: 'middle', horizontal: 'center' };
						}
					});
				});

				//Data Anak
				worksheetAnak.columns = [
					{ header: "triggeranak", key: "triggerAnak", width: 17 },
					{ header: "NAMA ANAK", key: "namaAnak", width: 35 },
					{ header: "KATEGORI ANAK", key: "kategoriAnak", width: 20 },
					{ header: "TANGGAL LAHIR", key: "tanggalLahir", width: 20 },
					{ header: "STATUS ANAK", key: "statusAnak", width: 20 },
				];
				worksheetAnak.addRows([
					{
						triggerAnak: '1', 
						namaAnak: 'nama Anak 1', 
						kategoriAnak: 'Boru', 
						tanggalLahir: new Date(),
						statusAnak: 'Hidup', 
					},
					{
						triggerAnak: '1', 
						namaAnak: 'nama Anak 2', 
						kategoriAnak: 'Anak', 
						tanggalLahir: new Date(),
						statusAnak: 'Hidup', 
					},
				]);
				worksheetAnak.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
							row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
						}
					});
				});
				
				//Pil Status
				worksheetStatus.columns = [
					{ header: "KODE", key: "kode", width: 7 },
					{ header: "LABEL", key: "label", width: 11 }
				];
				worksheetStatus.addRows([
					{
						kode: 0,
						label: 'Hidup',
					},
					{
						kode: 1,
						label: 'Meninggal',
					},
				]);
				worksheetStatus.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							// cell.alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});
				
				//Pil Ompu
				worksheetOmpu.columns = [
					{ header: "KODE", key: "kode", width: 7 },
					{ header: "LABEL", key: "label", width: 17 }
				];
				worksheetOmpu.addRows(await _allOption({ table: models.Ompu }));
				worksheetOmpu.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							// cell.alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});

				//Pil WilayahPanjaitan
				worksheetWilayahPanjaitan.columns = [
					{ header: "KODE", key: "kode", width: 7 },
					{ header: "LABEL", key: "label", width: 25 }
				];
				let WilayahPanjaitan = await _allOption({ table: models.WilayahPanjaitan })
				if(wilayah === '00'){
					worksheetWilayahPanjaitan.addRows(WilayahPanjaitan);
				}else{
					worksheetWilayahPanjaitan.addRows(WilayahPanjaitan.filter(val => val.kode === wilayah));
				}
				worksheetWilayahPanjaitan.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							// cell.alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});
				
				//Pil KomisarisWilayah
				worksheetKomisarisWilayah.columns = [
					{ header: "KODE KOMISARIS WILAYAH", key: "kodeKomisarisWilayah", width: 30 },
					{ header: "KODE WILAYAH", key: "kodeWilayah", width: 20 },
					{ header: "NAMA KOMISARIS", key: "namaKomisaris", width: 50 },
					{ header: "DAERAH", key: "daerah", width: 50 }
				];
				let KomisarisWilayah = await _allOption({ table: models.KomisarisWilayah, where: { statusKomisaris: true }, order: [['kodeWilayah', 'ASC'], ['kodeKomisarisWilayah', 'ASC']] })
				if(wilayah === '00'){
					worksheetKomisarisWilayah.addRows(KomisarisWilayah);
				}else{
					worksheetKomisarisWilayah.addRows(KomisarisWilayah.filter(val => val.kodeWilayah === wilayah));
				}
				worksheetKomisarisWilayah.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
							row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
						}
					});
				});

				//Pil Provinsi
				worksheetProvinsi.columns = [
					{ header: "KODE", key: "kode", width: 20 },
					{ header: "NAMA PROVINSI", key: "namaWilayah", width: 30 },
				];

				let provinsi = await _wilayah2023Cetak({ models, bagian: 'provinsi', KodeWilayah: '' })
				worksheetProvinsi.addRows(provinsi);
				worksheetProvinsi.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});

				//Pil Kabupaten / Kota
				worksheetKabKota.columns = [
					{ header: "KODE", key: "kode", width: 20 },
					{ header: "NAMA KABUPATEN / KOTA", key: "namaWilayah", width: 45 },
				];

				let kabkota = []
				await Promise.all(provinsi.map(async val => {
					let prov = await _wilayah2023Cetak({ models, bagian: 'kabkota', KodeWilayah: val.kode })
					await prov.map(str => {
						kabkota.push(str)
						return kabkota
					})
					return kabkota
				}))

				worksheetKabKota.addRows(_.sortBy(kabkota, [function(o) { return o.kode; }]));
				worksheetKabKota.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});

				//Pil Kecamatan
				worksheetKecamatan.columns = [
					{ header: "KODE", key: "kode", width: 20 },
					{ header: "NAMA KECAMATAN", key: "namaWilayah", width: 35 },
				];

				let kecamatan = []
				await Promise.all(kabkota.map(async val => {
					let kabkot = await _wilayah2023Cetak({ models, bagian: 'kecamatan', KodeWilayah: val.kode })
					await kabkot.map(str => {
						kecamatan.push(str)
						return kecamatan
					})
					return kecamatan
				}))

				worksheetKecamatan.addRows(_.sortBy(kecamatan, [function(o) { return o.kode; }]));
				worksheetKecamatan.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});

				//Pil Kelurahan
				worksheetKelurahan.columns = [
					{ header: "KODE", key: "kode", width: 20 },
					{ header: "NAMA KELURAHAN", key: "namaWilayah", width: 35 },
					{ header: "KODE POS", key: "kodePos", width: 20 },
				];

				let kelurahan = []
				await Promise.all(kecamatan.map(async val => {
					let kec = await _wilayah2023Cetak({ models, bagian: 'kelurahan', KodeWilayah: val.kode })
					await kec.map(str => {
						kelurahan.push(str)
						return kelurahan
					})
					return kelurahan
				}))

				worksheetKelurahan.addRows(_.sortBy(kelurahan, [function(o) { return o.kode; }]));
				worksheetKelurahan.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
							row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
						}
					});
				});

				res.setHeader(
					"Content-Disposition",
					"attachment; filename=TemplateDataSiswa.xlsx"
				);

				res.setHeader(
					"Content-Type",
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				);
		
				return workbook.xlsx.write(res).then(function () {
					res.status(200).end();
				});
			}else if(kategori === 'rekapmenikah'){
				let workbook = new excel.Workbook();
				let worksheetDataRekap = workbook.addWorksheet("DataRekap");
				let worksheetWilayahPanjaitan = workbook.addWorksheet("Wilayah");

				//Data Rekap
				worksheetDataRekap.columns = [
					{ header: "WILAYAH", key: "wilayah", width: 20 },
					{ header: "TANGGAL", key: "tanggal", width: 20 },
					{ header: "GOAR NI ULAON", key: "kategori", width: 35 },
					{ header: "GOAR NI NAMARHASOHOTAN", key: "nama", width: 40 },
					{ header: "GOAR NI HASUHUTON", key: "orangTuaMenantu", width: 40 },
					{ header: "GEREJA PAMASUMASUON DOHOT ALAMAN PARPESTAAN", key: "pemberkatan", width: 65 },
					{ header: "PROTOKOL", key: "penanggungJawab", width: 35 },
					{ header: "RAJA PARHATA / PARSINABUL", key: "yangMemberiSumbangan", width: 40 },
					{ header: "HASAHATAN NI ULOS NAMARHADOHOAN / PANANDAION TU PENGURUS", key: "pemberiUlos", width: 85 },
					{ header: "KETERANGAN", key: "keterangan", width: 50 },
				];

				worksheetDataRekap.addRows([{
					wilayah: '03',
					tanggal: new Date(),
					kategori: '2M',
					nama: 'Serma TNI Johan Panjaitan dohot Sapmi Susanti br.Siahaan,SE',
					orangTuaMenantu: 'Jamiston Panjaitan/ br.Siahaan,S.Pd',
					pemberkatan: 'Paainton Pukul 09.00 WIB, simpul Paainthon diuduti ma Marhusip dohot Martonggo Raja, Inganan Prumpung Sawah V Rt.014/04 Cipinang Besar Utara Jakarta Timur',
					penanggungJawab: 'Ketua Wilayah Jakarta Barat',
					yangMemberiSumbangan: 'Ketua Wilayah Jakarta Barat',
					pemberiUlos: '-',
					keterangan: '2M',
				}]);

				worksheetDataRekap.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(4).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(7).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(8).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(9).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(10).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
						}
					});
				});

				//Pil WilayahPanjaitan
				worksheetWilayahPanjaitan.columns = [
					{ header: "KODE", key: "kode", width: 7 },
					{ header: "LABEL", key: "label", width: 25 }
				];
				let WilayahPanjaitan = await _allOption({ table: models.WilayahPanjaitan })
				worksheetWilayahPanjaitan.addRows(WilayahPanjaitan);
				worksheetWilayahPanjaitan.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							// cell.alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});

				res.setHeader(
					"Content-Disposition",
					"attachment; filename=TemplateDataSiswa.xlsx"
				);

				res.setHeader(
					"Content-Type",
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				);
		
				return workbook.xlsx.write(res).then(function () {
					res.status(200).end();
				});
			}else if(kategori === 'rekapmeninggal'){
				let workbook = new excel.Workbook();
				let worksheetDataRekap = workbook.addWorksheet("DataRekap");
				let worksheetWilayahPanjaitan = workbook.addWorksheet("Wilayah");

				//Data Rekap
				worksheetDataRekap.columns = [
					{ header: "WILAYAH", key: "wilayah", width: 20 },
					{ header: "TANGGAL", key: "tanggal", width: 20 },
					{ header: "NAMONDING", key: "kategori", width: 35 },
					{ header: "GOAR NI NAMONDING", key: "nama", width: 40 },
					{ header: "HASUHUTON / NAMANGHABALUHON", key: "yangDitinggal", width: 50 },
					{ header: "INGANAN", key: "rumahDuka", width: 40 },
					{ header: "TONGGO RAJA / PASADA TAHI / ADAT PARTUATNA", key: "acaraAdat", width: 60 },
					{ header: "PROTOKOL", key: "penanggungJawab", width: 40 },
					{ header: "RAJA ARHATA / PARSINABUL / NAMANGULUHON", key: "yangMemberiSumbangan", width: 70 },
					{ header: "KETERANGAN", key: "keterangan", width: 50 },
				];

				worksheetDataRekap.addRows([{
					wilayah: '05',
					tanggal: new Date(),
					kategori: 'Monding Ina',
					nama: 'Purnama br.Napitupulu (Op.Eunike boru) 72 tahun',
					yangDitinggal: 'Pdt.Mangontang SM.Panjaitan (Op.Eunike doli)',
					rumahDuka: 'Rumah Duka RS UKI Jakarta Timur',
					acaraAdat: 'Martonggo Raja Rabu, 03/07/24 Pukul 19.00 WIB, Ulaon Adat Partuatna Kamis, 04/07/24 Disuathon di Bona Pasogit Pintu Batu Silaen Toba',
					penanggungJawab: 'Ketua Wilayah Jakarta Timur-2',
					yangMemberiSumbangan: 'St.Westerling Panjaitan/br.Manurung (Op.Debora)',
					keterangan: 'Tanda Duka Cita Rp.500.000,-',
				}]);

				worksheetDataRekap.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(4).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(7).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(8).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(9).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
							row.getCell(10).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
						}
					});
				});

				//Pil WilayahPanjaitan
				worksheetWilayahPanjaitan.columns = [
					{ header: "KODE", key: "kode", width: 7 },
					{ header: "LABEL", key: "label", width: 25 }
				];
				let WilayahPanjaitan = await _allOption({ table: models.WilayahPanjaitan })
				worksheetWilayahPanjaitan.addRows(WilayahPanjaitan);
				worksheetWilayahPanjaitan.eachRow({ includeEmpty: true }, function(row, rowNumber){
					row.eachCell(function(cell, colNumber){
						if (rowNumber === 1) {
							row.height = 25;
							cell.font = { name: 'Times New Normal', size: 11, bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
						}
						if (rowNumber > 1) {
							cell.font = { name: 'Times New Normal', size: 10, bold: false };
							// cell.alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
							row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
						}
					});
				});

				res.setHeader(
					"Content-Disposition",
					"attachment; filename=TemplateDataSiswa.xlsx"
				);

				res.setHeader(
					"Content-Type",
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				);
		
				return workbook.xlsx.write(res).then(function () {
					res.status(200).end();
				});
			}
	  } catch (err) {
			  return NOT_FOUND(res, err.message)
	  }
	}  
}

function importExcel (models) {
	return async (req, res, next) => {
		const dir = req.files[0];
		let body = req.body
	  try {
			if(body.kategori === 'datakeanggotaan'){
				let jsonDataInsert = [];
				let jsonDataAvailable = [];
				let jsonDataAvailableAnak = [];
				let jsonBiodata = [];
				let jsonAnak = [];

				readXlsxFile(dir.path, { sheet: 'Biodata' }).then(async(rows) => {
					rows.shift();
					rows.map(async (row) => {
						// let tglSuami = row[2].split('/')
						// let tglIstri = row[13].split('/')
						let data = {
							idBiodata: await createKSUID(),
							triggerBiodata: String(row[0]), 
							namaSuami: row[1], 
							tanggalLahirSuami: row[2],
							// tanggalLahirSuami: convertDate(row[2]),
							// tanggalLahirSuami: dayjs(`${tglSuami[2]}-${tglSuami[1]}-${tglSuami[0]}`).format('YYYY-MM-DD'),
							tempatSuami: row[3], 
							alamat: row[4], 
							provinsi: row[5], 
							kabKota: row[6], 
							kecamatan: row[7], 
							kelurahan: row[8], 
							kodePos: row[9],
							pekerjaanSuami: row[10], 
							telp: row[11], 
							namaIstri: row[12], 
							tempatIstri: row[13], 
							tanggalLahirIstri: row[14],
							// tanggalLahirIstri: convertDate(row[14]),
							// tanggalLahirIstri: dayjs(`${tglIstri[2]}-${tglIstri[1]}-${tglIstri[0]}`).format('YYYY-MM-DD'),
							pekerjaanIstri: row[15], 
							telpIstri: row[16], 
							jabatanPengurus: row[17], 
							wilayah: row[18], 
							komisarisWilayah: row[19], 
							ompu: row[20], 
							generasi: row[21], 
							statusSuami: row[22], 
							statusIstri: row[23],
						};
						// console.log(row[2], row[14]);
						jsonBiodata.push(data);
					});

					readXlsxFile(dir.path, { sheet: 'Anak' }).then(async(rows) => {
						rows.shift();
						rows.map(async (row) => {
							// let tglAnak = row[3].split('/')
							let data = {
								idAnak: makeRandom(10),
								triggerAnak: String(row[0]), 
								namaAnak: row[1], 
								kategoriAnak: row[2], 
								tanggalLahir: convertDate(row[3]),
								statusAnak: row[4], 
								// tanggalLahir: dayjs(`${tglAnak[2]}-${tglAnak[1]}-${tglAnak[0]}`).format('YYYY-MM-DD'),
							};
							jsonAnak.push(data);
						});

						await Promise.all(jsonBiodata.map(async value => {
							let anak = jsonAnak.filter(f => f.triggerAnak === value.triggerBiodata)

							let where = {
								statusBiodata: true,
								namaLengkap: value.namaSuami,
								namaIstri: value.namaIstri,
							}
							const count = await models.Biodata.count({ where });

							if(count){
								anak.map(val => {
									jsonDataAvailableAnak.push(val)
								})
								jsonDataAvailable.push(value)
							}else{
								jsonDataInsert.push({ ...value, anak })
							}
						}))

						if(jsonDataInsert.length) {
							const promises = jsonDataInsert.map((str, i) =>
								new Promise(resolve =>
									setTimeout(async () => {
										let kirimdataUser, nik, kirimdataAnak = [];
										const data = await models.Biodata.findOne({
											where: { wilayah: str.wilayah, komisarisWilayah: str.komisarisWilayah },
											attributes: ["nik"],
											order: [
												['createdAt', 'DESC'],
											],
										});

										if (data) {
											// console.log(data.nik, new Date());
											let text = data.nik.split('.')[4];
											nik = `${str.wilayah}.${str.komisarisWilayah}.${str.ompu}${str.generasi}.${(parseInt(text.substr(2)) + 1).toString().padStart(4, '0')}`;
										} else {
											nik = `${str.wilayah}.${str.komisarisWilayah}.${str.ompu}${str.generasi}.0001`;
										}

										kirimdataUser = {
											idBiodata: str.idBiodata,
											nik,
											namaLengkap: str.namaSuami,
											tempatSuami: str.tempatSuami ? str.tempatSuami : '',
											tanggalLahirSuami: str.tanggalLahirSuami,
											alamat: str.alamat,
											provinsi: str.provinsi,
											kabKota: str.kabKota,
											kecamatan: str.kecamatan,
											kelurahan: str.kelurahan,
											kodePos: str.kodePos,
											pekerjaanSuami: str.pekerjaanSuami ? str.pekerjaanSuami : '',
											telp: str.telp ? str.telp : '',
											namaIstri: str.namaIstri,
											tempatIstri: str.tempatIstri,
											tanggalLahirIstri: str.tanggalLahirIstri,
											pekerjaanIstri: str.pekerjaanIstri,
											telpIstri: str.telpIstri,
											jabatanPengurus: str.jabatanPengurus === null ? '-' : str.jabatanPengurus,
											wilayah: str.wilayah,
											komisarisWilayah: str.komisarisWilayah,
											ompu: str.ompu.toLowerCase(),
											generasi: str.generasi,
											statusSuami: uppercaseLetterFirst(str.statusSuami),
											tanggalWafatSuami: null,
											statusIstri: uppercaseLetterFirst(str.statusIstri),
											tanggalWafatIstri: null,
											statusBiodata: 1,
											createBy: body.createupdateBy,
										}
				
										str.anak.map(val => {
											kirimdataAnak.push({
												idAnak: val.idAnak,
												idBiodata: str.idBiodata,
												kategoriAnak: uppercaseLetterFirst(val.kategoriAnak),
												namaAnak: val.namaAnak,
												tanggalLahir: val.tanggalLahir,
												statusAnak: uppercaseLetterFirst(val.statusAnak),
											})
										})
										
										let dataIuran = []
										let tahun = dayjs().format('YYYY')
										for (let index = 2024; index <= Number(tahun); index++) {
											dataIuran.push({
												tahun: String(index),
												iuran: {
													januari: 0,
													februari: 0,
													maret: 0,
													april: 0,
													mei: 0,
													juni: 0,
													juli: 0,
													agustus: 0,
													september: 0,
													oktober: 0,
													november: 0,
													desember: 0,
													total: 0,
												}
											})
										}

										let kirimdataIuran = {
											idIuran: makeRandom(10),
											idBiodata: str.idBiodata,
											komisarisWilayah: str.komisarisWilayah,
											iuran: JSON.stringify(dataIuran),
											totalIuran: 0
										}

										await models.Biodata.create(kirimdataUser)
										await models.Iuran.create(kirimdataIuran)
										await models.Anak.bulkCreate(kirimdataAnak)
										// console.log(kirimdataUser);
										

										resolve()
									}, 3000 * jsonDataInsert.length - 3000 * i)
								)
							)
							Promise.all(promises).then(() => console.log('done save'))
						}

						if(jsonDataAvailable.length) {
							let workbook = new excel.Workbook();
							let worksheetBiodata = workbook.addWorksheet("Biodata");
							let worksheetAnak = workbook.addWorksheet("Anak");
							let worksheetStatus = workbook.addWorksheet("Status");
							let worksheetOmpu = workbook.addWorksheet("Ompu");
							let worksheetWilayahPanjaitan = workbook.addWorksheet("Wilayah");
							let worksheetKomisarisWilayah = workbook.addWorksheet("Komisaris");
							let worksheetProvinsi = workbook.addWorksheet("Provinsi");
							let worksheetKabKota = workbook.addWorksheet("Kabupaten - Kota");
							let worksheetKecamatan = workbook.addWorksheet("Kecamatan");
							let worksheetKelurahan = workbook.addWorksheet("Kelurahan");

							//Data Keanggotaan
							worksheetBiodata.columns = [
								{ header: "triggerbiodata", key: "triggerBiodata", width: 20 },
								{ header: "NAMA SUAMI", key: "namaSuami", width: 35 },
								{ header: "TANGGAL LAHIR SUAMI", key: "tanggalLahirSuami", width: 30 },
								{ header: "TEMPAT SUAMI", key: "tempatSuami", width: 25 },
								{ header: "ALAMAT", key: "alamat", width: 45 },
								{ header: "PROVINSI", key: "provinsi", width: 20 },
								{ header: "KABUPATEN / KOTA", key: "kabKota", width: 25 },
								{ header: "KECAMATAN", key: "kecamatan", width: 20 },
								{ header: "KELURAHAN", key: "kelurahan", width: 20 },
								{ header: "KODE POS", key: "kodePos", width: 15 },
								{ header: "PEKERJAAN SUAMI", key: "pekerjaanSuami", width: 25 },
								{ header: "TELEPON", key: "telp", width: 15 },
								{ header: "NAMA ISTRI", key: "namaIstri", width: 35 },
								{ header: "TEMPAT ISTRI", key: "tempatIstri", width: 25 },
								{ header: "TANGGAL LAHIR ISTRI", key: "tanggalLahirIstri", width: 30 },
								{ header: "PEKERJAAN ISTRI", key: "pekerjaanIstri", width: 25 },
								{ header: "JABATAN PENGURUS", key: "jabatanPengurus", width: 25 },
								{ header: "WILAYAH", key: "wilayah", width: 15 },
								{ header: "KOMISARIS WILAYAH", key: "komisarisWilayah", width: 25 },
								{ header: "OMPU", key: "ompu", width: 10 },
								{ header: "GENERASI", key: "generasi", width: 15 },
								{ header: "STATUS SUAMI", key: "statusSuami", width: 20 },
								{ header: "STATUS ISTRI", key: "statusIstri", width: 20 },
							];

							worksheetBiodata.addRows(_.sortBy(jsonDataAvailable, [function(o) { return o.triggerBiodata; }]));

							worksheetBiodata.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
										row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
										row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(13).alignment = { vertical: 'middle', horizontal: 'left' };
										row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(16).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(17).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(18).alignment = { vertical: 'middle', horizontal: 'center'};
										row.getCell(19).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(20).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(21).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(22).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(23).alignment = { vertical: 'middle', horizontal: 'center' };
									}
								});
							});

							//Data Anak
							worksheetAnak.columns = [
								{ header: "triggeranak", key: "triggerAnak", width: 17 },
								{ header: "NAMA ANAK", key: "namaAnak", width: 35 },
								{ header: "KATEGORI ANAK", key: "kategoriAnak", width: 20 },
								{ header: "TANGGAL LAHIR", key: "tanggalLahir", width: 20 },
								{ header: "STATUS ANAK", key: "statusAnak", width: 20 },
							];
							worksheetAnak.addRows(_.sortBy(jsonDataAvailableAnak, [function(o) { return o.triggerAnak; }]));
							worksheetAnak.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
										row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
									}
								});
							});
							
							//Pil Status
							worksheetStatus.columns = [
								{ header: "KODE", key: "kode", width: 7 },
								{ header: "LABEL", key: "label", width: 11 }
							];
							worksheetStatus.addRows([
								{
									kode: 0,
									label: 'Hidup',
								},
								{
									kode: 1,
									label: 'Meninggal',
								},
							]);
							worksheetStatus.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										// cell.alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
									}
								});
							});
							
							//Pil Ompu
							worksheetOmpu.columns = [
								{ header: "KODE", key: "kode", width: 7 },
								{ header: "LABEL", key: "label", width: 17 }
							];
							worksheetOmpu.addRows(await _allOption({ table: models.Ompu }));
							worksheetOmpu.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										// cell.alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
									}
								});
							});

							//Pil WilayahPanjaitan
							worksheetWilayahPanjaitan.columns = [
								{ header: "KODE", key: "kode", width: 7 },
								{ header: "LABEL", key: "label", width: 25 }
							];
							let WilayahPanjaitan = await _allOption({ table: models.WilayahPanjaitan })
							if(body.wilayah === '00'){
								worksheetWilayahPanjaitan.addRows(WilayahPanjaitan);
							}else{
								worksheetWilayahPanjaitan.addRows(WilayahPanjaitan.filter(val => val.kode === body.wilayah));
							}
							worksheetWilayahPanjaitan.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										// cell.alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
									}
								});
							});
							
							//Pil KomisarisWilayah
							worksheetKomisarisWilayah.columns = [
								{ header: "KODE KOMISARIS WILAYAH", key: "kodeKomisarisWilayah", width: 30 },
								{ header: "KODE WILAYAH", key: "kodeWilayah", width: 20 },
								{ header: "NAMA KOMISARIS", key: "namaKomisaris", width: 50 },
								{ header: "DAERAH", key: "daerah", width: 50 }
							];
							let KomisarisWilayah = await _allOption({ table: models.KomisarisWilayah, where: { statusKomisaris: true }, order: [['kodeWilayah', 'ASC'], ['kodeKomisarisWilayah', 'ASC']] })
							if(body.wilayah === '00'){
								worksheetKomisarisWilayah.addRows(KomisarisWilayah);
							}else{
								worksheetKomisarisWilayah.addRows(KomisarisWilayah.filter(val => val.kodeWilayah === body.wilayah));
							}
							worksheetKomisarisWilayah.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
										row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
									}
								});
							});

							//Pil Provinsi
							worksheetProvinsi.columns = [
								{ header: "KODE", key: "kode", width: 20 },
								{ header: "NAMA PROVINSI", key: "namaWilayah", width: 30 },
							];

							let provinsi = await _wilayah2023Cetak({ models, bagian: 'provinsi', KodeWilayah: '' })
							worksheetProvinsi.addRows(provinsi);
							worksheetProvinsi.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
									}
								});
							});

							//Pil Kabupaten / Kota
							worksheetKabKota.columns = [
								{ header: "KODE", key: "kode", width: 20 },
								{ header: "NAMA KABUPATEN / KOTA", key: "namaWilayah", width: 45 },
							];

							let kabkota = []
							await Promise.all(provinsi.map(async val => {
								let prov = await _wilayah2023Cetak({ models, bagian: 'kabkota', KodeWilayah: val.kode })
								await prov.map(str => {
									kabkota.push(str)
									return kabkota
								})
								return kabkota
							}))

							worksheetKabKota.addRows(_.sortBy(kabkota, [function(o) { return o.kode; }]));
							worksheetKabKota.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
									}
								});
							});

							//Pil Kecamatan
							worksheetKecamatan.columns = [
								{ header: "KODE", key: "kode", width: 20 },
								{ header: "NAMA KECAMATAN", key: "namaWilayah", width: 35 },
							];

							let kecamatan = []
							await Promise.all(kabkota.map(async val => {
								let kabkot = await _wilayah2023Cetak({ models, bagian: 'kecamatan', KodeWilayah: val.kode })
								await kabkot.map(str => {
									kecamatan.push(str)
									return kecamatan
								})
								return kecamatan
							}))

							worksheetKecamatan.addRows(_.sortBy(kecamatan, [function(o) { return o.kode; }]));
							worksheetKecamatan.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
									}
								});
							});

							//Pil Kelurahan
							worksheetKelurahan.columns = [
								{ header: "KODE", key: "kode", width: 20 },
								{ header: "NAMA KELURAHAN", key: "namaWilayah", width: 35 },
								{ header: "KODE POS", key: "kodePos", width: 20 },
							];

							let kelurahan = []
							await Promise.all(kecamatan.map(async val => {
								let kec = await _wilayah2023Cetak({ models, bagian: 'kelurahan', KodeWilayah: val.kode })
								await kec.map(str => {
									kelurahan.push(str)
									return kelurahan
								})
								return kelurahan
							}))

							worksheetKelurahan.addRows(_.sortBy(kelurahan, [function(o) { return o.kode; }]));
							worksheetKelurahan.eachRow({ includeEmpty: true }, function(row, rowNumber){
								row.eachCell(function(cell, colNumber){
									if (rowNumber === 1) {
										row.height = 25;
										cell.font = { name: 'Times New Normal', size: 11, bold: true };
										cell.alignment = { vertical: 'middle', horizontal: 'center' };
									}
									if (rowNumber > 1) {
										cell.font = { name: 'Times New Normal', size: 10, bold: false };
										row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
										row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
										row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
									}
								});
							});

							res.setHeader(
								"Content-Disposition",
								"attachment; filename=TemplateDataSiswa.xlsx"
							);

							res.setHeader(
								"Content-Type",
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							);

							return workbook.xlsx.writeFile(path.join(__dirname, '../public/Data Keanggotaan Already Available.xlsx'))
							.then(() => {
								fs.unlinkSync(dir.path);
								return OK(res, {
									dataJsonDataInsert: jsonDataInsert,
									jsonDataInsert: jsonDataInsert.length,
									dataJsonDataAvailable: jsonDataAvailable,
									dataJsonDataAvailableAnak: jsonDataAvailableAnak,
									jsonDataAvailable: jsonDataAvailable.length,
									jsonData: jsonBiodata.length,
									path: `${BASE_URL}Data Keanggotaan Already Available.xlsx`,
								})
							});
						}

						fs.unlinkSync(dir.path);
						return OK(res, {
							dataJsonDataInsert: jsonDataInsert,
							jsonDataInsert: jsonDataInsert.length,
							dataJsonDataAvailable: jsonDataAvailable,
							dataJsonDataAvailableAnak: jsonDataAvailableAnak,
							jsonDataAvailable: jsonDataAvailable.length,
							jsonData: jsonBiodata.length,
						})
					});
				})
			}else if(body.kategori === 'rekapmenikah'){
				let jsonRekapData = []
				readXlsxFile(dir.path, { sheet: 'DataRekap' }).then(async(rows) => {
					rows.shift();
					rows.map(async (row) => {
						let data = {
							idRekap: makeRandom(10),
							wilayah: row[0],
							tanggal: row[1],
							kategori: row[2],
							nama: row[3],
							orangTuaMenantu: row[4],
							pemberkatan: row[5],
							penanggungJawab: row[6],
							yangMemberiSumbangan: row[7],
							pemberiUlos: row[8],
							keterangan: row[9],
						};
						
						jsonRekapData.push(data);
					});

					const promises = jsonRekapData.map((str, i) =>
						new Promise(resolve =>
							setTimeout(async () => {
								let kirimdata = {
									idRekap: str.idRekap,
									wilayah: str.wilayah,
									tanggal: str.tanggal,
									kategori: str.kategori,
									nama: str.nama,
									orangTuaMenantu: str.orangTuaMenantu,
									pemberkatan: str.pemberkatan,
									penanggungJawab: str.penanggungJawab,
									yangMemberiSumbangan: str.yangMemberiSumbangan,
									pemberiUlos: str.pemberiUlos,
									keterangan: str.keterangan,
								}
		
								await models.RekapMenikah.create(kirimdata)
								
								resolve()
							}, 2000 * jsonRekapData.length - 2000 * i)
						)
					)
					Promise.all(promises).then(() => console.log('done save'))

					fs.unlinkSync(dir.path);
					return OK(res, {
						jsonRekapData,
						jsonData: jsonRekapData.length })
				})
			}else if(body.kategori === 'rekapmeninggal'){
				let jsonRekapData = []
				readXlsxFile(dir.path, { sheet: 'DataRekap' }).then(async(rows) => {
					rows.shift();
					rows.map(async (row) => {
						let data = {
							idRekap: makeRandom(10),
							wilayah: row[0],
							tanggal: row[1],
							kategori: row[2],
							nama: row[3],
							yangDitinggal: row[4],
							rumahDuka: row[5],
							acaraAdat: row[6],
							penanggungJawab: row[7],
							yangMemberiSumbangan: row[8],
							keterangan: row[9],
						};

						jsonRekapData.push(data);
					});

					const promises = jsonRekapData.map((str, i) =>
						new Promise(resolve =>
							setTimeout(async () => {
								let kirimdata = {
									idRekap: str.idRekap,
									wilayah: str.wilayah,
									tanggal: str.tanggal,
									kategori: str.kategori,
									nama: str.nama,
									yangDitinggal: str.yangDitinggal,
									rumahDuka: str.rumahDuka,
									acaraAdat: str.acaraAdat,
									penanggungJawab: str.penanggungJawab,
									yangMemberiSumbangan: str.yangMemberiSumbangan,
									keterangan: str.keterangan,
								}
		
								await models.RekapMeninggal.create(kirimdata)
								
								resolve()
							}, 2000 * jsonRekapData.length - 2000 * i)
						)
					)
					Promise.all(promises).then(() => console.log('done save'))

					fs.unlinkSync(dir.path);
					return OK(res, {
						jsonRekapData,
						jsonData: jsonRekapData.length })
				})
			}
	  } catch (err) {
			return NOT_FOUND(res, err.message)
	  }
	}  
}

function exportExcel (models) {
	return async (req, res, next) => {
		let { wilayah, bagian, kategori, startdate, enddate, limit, totalPages } = req.query
	  try {
			if(bagian === 'datakeanggotaan'){
				if(kategori === 'full'){
					let workbook = new excel.Workbook();
					let split = wilayah.split(', ')
					for (let index = 0; index < split.length; index++) {
						let where = {}
						if(wilayah){
							where.wilayah = split[index]
							where.statusBiodata = true
						}
						const dataKeanggotaan = await models.Biodata.findAll({
							where,
							include: [
								{ 
									model: models.Anak,
								},
							],
							order: [['komisarisWilayah', 'ASC'], ['namaLengkap', 'ASC']],
						});
							
						const result = await Promise.all(dataKeanggotaan.map(async val => {
							let ompu = await _ompuOption({ models, kode: val.dataValues.ompu })
							let wilayah = await _wilayahpanjaitanOption({ models, kode: val.dataValues.wilayah })
							let komisaris_wilayah = await _komisariswilayahOption({ models, kodeKomisarisWilayah: val.dataValues.komisarisWilayah })
							let provinsi = val.dataValues.provinsi ? await _wilayah2023Option({ models, kode: val.dataValues.provinsi, bagian: 'provinsi' }) : val.dataValues.provinsi
							let kabkota = val.dataValues.kabKota ? await _wilayah2023Option({ models, kode: val.dataValues.kabKota, bagian: 'kabkota' }) : val.dataValues.kabKota
							let kecamatan = val.dataValues.kecamatan ? await _wilayah2023Option({ models, kode: val.dataValues.kecamatan, bagian: 'kecamatan' }) : val.dataValues.kecamatan
							let kelurahan = val.dataValues.kelurahan ? await _wilayah2023Option({ models, kode: val.dataValues.kelurahan, bagian: 'keldes' }) : val.dataValues.kelurahan
							let anak = val.dataValues.Anaks.length ? val.dataValues.Anaks.filter(str => str.statusAnak === 'Hidup').map(str => `${uppercaseLetterFirst3(str.namaAnak)} - ${str.kategoriAnak} (${str.tanggalLahir ? convertDateTime3(str.tanggalLahir) : '-'})`) : []
							
							return {
								idBiodata: val.dataValues.idBiodata,
								nik: val.dataValues.nik,
								namaSuami: uppercaseLetterFirst3(val.dataValues.namaLengkap),
								tempatSuami: val.dataValues.tempatSuami ? uppercaseLetterFirst3(val.dataValues.tempatSuami) : '-',
								tanggalLahirSuami: val.dataValues.tanggalLahirSuami ? dateconvert(val.dataValues.tanggalLahirSuami) : '-',
								pekerjaanSuami: val.dataValues.pekerjaanSuami ? val.dataValues.pekerjaanSuami : '-',
								telp: val.dataValues.telp ? val.dataValues.telp : '-',
								alamat: val.dataValues.alamat ? uppercaseLetterFirst3(val.dataValues.alamat) : '-',
								provinsi: provinsi ? provinsi.dataValues.nama : '-',
								kabKota: kabkota ? kabkota.dataValues.nama : '-',
								kecamatan: kecamatan ? kecamatan.dataValues.nama : '-',
								kelurahan: kelurahan ? kelurahan.dataValues.nama : '-',
								kodePos: val.dataValues.kodePos ? val.dataValues.kodePos : '-',
								namaIstri: val.dataValues.namaIstri ? uppercaseLetterFirst3(val.dataValues.namaIstri) : '',
								tempatIstri: val.dataValues.tempatIstri ? uppercaseLetterFirst3(val.dataValues.tempatIstri) : '-',
								tanggalLahirIstri: val.dataValues.tanggalLahirIstri ? dateconvert(val.dataValues.tanggalLahirIstri) : '-',
								pekerjaanIstri: val.dataValues.pekerjaanIstri ? val.dataValues.pekerjaanIstri : '-',						
								telpIstri: val.dataValues.telpIstri ? val.dataValues.telpIstri : '-',
								jabatanPengurus: val.dataValues.jabatanPengurus ? uppercaseLetterFirst3(val.dataValues.jabatanPengurus) : '',
								wilayah: wilayah.dataValues.label,
								namaKomisarisWilayah: komisaris_wilayah.dataValues.namaKomisaris,
								daerah: komisaris_wilayah.dataValues.daerah,
								ompu: ompu.dataValues.label,
								generasi: val.dataValues.generasi,
								statusSuami: val.dataValues.statusSuami,
								tanggalWafatSuami: val.dataValues.tanggalWafatSuami ? dateconvert(val.dataValues.tanggalWafatSuami) : '-',
								statusIstri: val.dataValues.statusIstri,
								tanggalWafatIstri: val.dataValues.tanggalWafatIstri ? dateconvert(val.dataValues.tanggalWafatIstri) : '-',
								anak: anak.length ? _.join(anak, '\n') : '-',
							}
						}))
						
						let wilayah_panjaitan = await _wilayahpanjaitanOption({ models, kode: split[index] })
						let nama_wilayah = wilayah_panjaitan.dataValues.label
						let worksheetBiodata = workbook.addWorksheet(`${nama_wilayah}`);
	
						//Data Keanggotaan
						worksheetBiodata.columns = [
							{ header: "idBiodata", key: "idBiodata", width: 30 },
							{ header: "NO. ANGGOTA", key: "nik", width: 20 },
							{ header: "NAMA SUAMI", key: "namaSuami", width: 35 },
							{ header: "TANGGAL LAHIR SUAMI", key: "tanggalLahirSuami", width: 30 },
							{ header: "TEMPAT SUAMI", key: "tempatSuami", width: 20 },
							{ header: "ALAMAT", key: "alamat", width: 30 },
							{ header: "PROVINSI", key: "provinsi", width: 20 },
							{ header: "KABUPATEN / KOTA", key: "kabKota", width: 25 },
							{ header: "KECAMATAN", key: "kecamatan", width: 20 },
							{ header: "KELURAHAN", key: "kelurahan", width: 20 },
							{ header: "KODE POS", key: "kodePos", width: 15 },
							{ header: "PEKERJAAN SUAMI", key: "pekerjaanSuami", width: 25 },
							{ header: "TELEPON SUAMI", key: "telp", width: 20 },
							{ header: "NAMA ISTRI", key: "namaIstri", width: 35 },
							{ header: "TEMPAT ISTRI", key: "tempatIstri", width: 20 },
							{ header: "TANGGAL LAHIR ISTRI", key: "tanggalLahirIstri", width: 30 },
							{ header: "PEKERJAAN ISTRI", key: "pekerjaanIstri", width: 25 },
							{ header: "TELEPON ISTRI", key: "telpIstri", width: 20 },
							{ header: "JABATAN PENGURUS", key: "jabatanPengurus", width: 30 },
							{ header: "WILAYAH", key: "wilayah", width: 20 },
							{ header: "NAMA KOMISARIS WILAYAH", key: "namaKomisarisWilayah", width: 35 },
							{ header: "DAERAH", key: "daerah", width: 30 },
							{ header: "OMPU", key: "ompu", width: 20 },
							{ header: "GENERASI", key: "generasi", width: 15 },
							{ header: "STATUS SUAMI", key: "statusSuami", width: 20 },
							{ header: "TANGGAL WAFAT SUAMI", key: "tanggalWafatSuami", width: 30 },
							{ header: "STATUS ISTRI", key: "statusIstri", width: 20 },
							{ header: "TANGGAL WAFAT ISTRI", key: "tanggalWafatIstri", width: 30 },
							{ header: "TANGGUNGAN", key: "anak", width: 70 },
						];
		
						worksheetBiodata.addRows(result);
		
						worksheetBiodata.eachRow({ includeEmpty: true }, function(row, rowNumber){
							row.eachCell(function(cell, colNumber){
								if (rowNumber === 1) {
									row.height = 25;
									cell.font = { name: 'Times New Normal', size: 11, bold: true };
									cell.alignment = { vertical: 'middle', horizontal: 'center' };
								}
								if (rowNumber > 1) {
									cell.font = { name: 'Times New Normal', size: 10, bold: false };
									row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
									row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(14).alignment = { vertical: 'middle', horizontal: 'left' };
									row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(16).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(17).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(18).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(19).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(20).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(21).alignment = { vertical: 'middle', horizontal: 'left' };
									row.getCell(22).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(23).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(24).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(25).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(26).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(27).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(28).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(29).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
								 }
							});
						});
					
						res.setHeader(
							"Content-Disposition",
							"attachment; filename=ExportSiswa.xlsx"
						);
					}
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);
			
					return workbook.xlsx.write(res).then(function () {
						res.status(200).end();
					});
				}else if(kategori === 'by'){
					let workbook = new excel.Workbook();
					for (let page = 1; page <= parseInt(totalPages); page++) {
						const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined
						let where = {}
						if(wilayah){
							where.wilayah = wilayah
							where.statusBiodata = true
						}
						const dataKeanggotaan = await models.Biodata.findAll({
							where,
							include: [
								{ 
									model: models.Anak,
								},
							],
							order: [['komisarisWilayah', 'ASC'], ['namaLengkap', 'ASC']],
							limit: parseInt(limit),
							offset: OFFSET,
						});
	
						const result = await Promise.all(dataKeanggotaan.map(async val => {
							let ompu = await _ompuOption({ models, kode: val.dataValues.ompu })
							let wilayah = await _wilayahpanjaitanOption({ models, kode: val.dataValues.wilayah })
							let komisaris_wilayah = await _komisariswilayahOption({ models, kodeKomisarisWilayah: val.dataValues.komisarisWilayah })
							let provinsi = val.dataValues.provinsi ? await _wilayah2023Option({ models, kode: val.dataValues.provinsi, bagian: 'provinsi' }) : val.dataValues.provinsi
							let kabkota = val.dataValues.kabKota ? await _wilayah2023Option({ models, kode: val.dataValues.kabKota, bagian: 'kabkota' }) : val.dataValues.kabKota
							let kecamatan = val.dataValues.kecamatan ? await _wilayah2023Option({ models, kode: val.dataValues.kecamatan, bagian: 'kecamatan' }) : val.dataValues.kecamatan
							let kelurahan = val.dataValues.kelurahan ? await _wilayah2023Option({ models, kode: val.dataValues.kelurahan, bagian: 'keldes' }) : val.dataValues.kelurahan
							let anak = val.dataValues.Anaks.length ? val.dataValues.Anaks.filter(str => str.statusAnak === 'Hidup').map(str => `${uppercaseLetterFirst3(str.namaAnak)} - ${str.kategoriAnak} (${str.tanggalLahir ? convertDateTime3(str.tanggalLahir) : '-'})`) : []
							
							return {
								idBiodata: val.dataValues.idBiodata,
								nik: val.dataValues.nik,
								namaSuami: val.dataValues.namaLengkap,
								tempatSuami: val.dataValues.tempatSuami ? uppercaseLetterFirst3(val.dataValues.tempatSuami) : '-',
								tanggalLahirSuami: val.dataValues.tanggalLahirSuami ? dateconvert(val.dataValues.tanggalLahirSuami) : '-',
								pekerjaanSuami: val.dataValues.pekerjaanSuami ? val.dataValues.pekerjaanSuami : '-',
								telp: val.dataValues.telp ? val.dataValues.telp : '-',
								alamat: val.dataValues.alamat ? uppercaseLetterFirst3(val.dataValues.alamat) : '-',
								provinsi: provinsi ? provinsi.dataValues.nama : '-',
								kabKota: kabkota ? kabkota.dataValues.nama : '-',
								kecamatan: kecamatan ? kecamatan.dataValues.nama : '-',
								kelurahan: kelurahan ? kelurahan.dataValues.nama : '-',
								kodePos: val.dataValues.kodePos ? val.dataValues.kodePos : '-',
								namaIstri: val.dataValues.namaIstri ? uppercaseLetterFirst3(val.dataValues.namaIstri) : '',
								tempatIstri: val.dataValues.tempatIstri ? uppercaseLetterFirst3(val.dataValues.tempatIstri) : '-',
								tanggalLahirIstri: val.dataValues.tanggalLahirIstri ? dateconvert(val.dataValues.tanggalLahirIstri) : '-',
								pekerjaanIstri: val.dataValues.pekerjaanIstri ? val.dataValues.pekerjaanIstri : '-',						
								telpIstri: val.dataValues.telpIstri ? val.dataValues.telpIstri : '-',
								jabatanPengurus: val.dataValues.jabatanPengurus ? uppercaseLetterFirst3(val.dataValues.jabatanPengurus) : '',
								wilayah: wilayah.dataValues.label,
								namaKomisarisWilayah: komisaris_wilayah.dataValues.namaKomisaris,
								daerah: komisaris_wilayah.dataValues.daerah,
								ompu: ompu.dataValues.label,
								generasi: val.dataValues.generasi,
								statusSuami: val.dataValues.statusSuami,
								tanggalWafatSuami: val.dataValues.tanggalWafatSuami ? dateconvert(val.dataValues.tanggalWafatSuami) : '-',
								statusIstri: val.dataValues.statusIstri,
								tanggalWafatIstri: val.dataValues.tanggalWafatIstri ? dateconvert(val.dataValues.tanggalWafatIstri) : '-',
								anak: anak.length ? _.join(anak, '\n') : '-',
							}
						}))
			
						let wilayah_panjaitan = await _wilayahpanjaitanOption({ models, kode: wilayah })
						let nama_wilayah = wilayah_panjaitan.dataValues.label
						let worksheetBiodata = workbook.addWorksheet(`${nama_wilayah} - Page ${page}`);
		
						//Data Keanggotaan
						worksheetBiodata.columns = [
							{ header: "idBiodata", key: "idBiodata", width: 30 },
							{ header: "NO. ANGGOTA", key: "nik", width: 20 },
							{ header: "NAMA SUAMI", key: "namaSuami", width: 35 },
							{ header: "TANGGAL LAHIR SUAMI", key: "tanggalLahirSuami", width: 30 },
							{ header: "TEMPAT SUAMI", key: "tempatSuami", width: 20 },
							{ header: "ALAMAT", key: "alamat", width: 30 },
							{ header: "PROVINSI", key: "provinsi", width: 20 },
							{ header: "KABUPATEN / KOTA", key: "kabKota", width: 25 },
							{ header: "KECAMATAN", key: "kecamatan", width: 20 },
							{ header: "KELURAHAN", key: "kelurahan", width: 20 },
							{ header: "KODE POS", key: "kodePos", width: 15 },
							{ header: "PEKERJAAN SUAMI", key: "pekerjaanSuami", width: 25 },
							{ header: "TELEPON SUAMI", key: "telp", width: 20 },
							{ header: "NAMA ISTRI", key: "namaIstri", width: 35 },
							{ header: "TEMPAT ISTRI", key: "tempatIstri", width: 20 },
							{ header: "TANGGAL LAHIR ISTRI", key: "tanggalLahirIstri", width: 30 },
							{ header: "PEKERJAAN ISTRI", key: "pekerjaanIstri", width: 25 },
							{ header: "TELEPON ISTRI", key: "telpIstri", width: 20 },
							{ header: "JABATAN PENGURUS", key: "jabatanPengurus", width: 30 },
							{ header: "WILAYAH", key: "wilayah", width: 20 },
							{ header: "NAMA KOMISARIS WILAYAH", key: "namaKomisarisWilayah", width: 35 },
							{ header: "DAERAH", key: "daerah", width: 30 },
							{ header: "OMPU", key: "ompu", width: 20 },
							{ header: "GENERASI", key: "generasi", width: 15 },
							{ header: "STATUS SUAMI", key: "statusSuami", width: 20 },
							{ header: "TANGGAL WAFAT SUAMI", key: "tanggalWafatSuami", width: 30 },
							{ header: "STATUS ISTRI", key: "statusIstri", width: 20 },
							{ header: "TANGGAL WAFAT ISTRI", key: "tanggalWafatIstri", width: 30 },
							{ header: "TANGGUNGAN", key: "anak", width: 70 },
						];
		
						worksheetBiodata.addRows(result);
		
						worksheetBiodata.eachRow({ includeEmpty: true }, function(row, rowNumber){
							row.eachCell(function(cell, colNumber){
								if (rowNumber === 1) {
									row.height = 25;
									cell.font = { name: 'Times New Normal', size: 11, bold: true };
									cell.alignment = { vertical: 'middle', horizontal: 'center' };
								}
								if (rowNumber > 1) {
									cell.font = { name: 'Times New Normal', size: 10, bold: false };
									row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
									row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(14).alignment = { vertical: 'middle', horizontal: 'left' };
									row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(16).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(17).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(18).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(19).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(20).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(21).alignment = { vertical: 'middle', horizontal: 'left' };
									row.getCell(22).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(23).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(24).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(25).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(26).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(27).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(28).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(29).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
								 }
							});
						});
					
						res.setHeader(
							"Content-Disposition",
							"attachment; filename=ExportSiswa.xlsx"
						);
					}
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);
			
					return workbook.xlsx.write(res).then(function () {
						res.status(200).end();
					});
				}else if(kategori === 'komisaris'){
					let workbook = new excel.Workbook();
					const dataKomisaris = await models.KomisarisWilayah.findAll({
						where: {
							kodeWilayah: wilayah,
							statusKomisaris: true
						},
						order: [['kodeKomisarisWilayah', 'ASC']],
					});
	
					let dataTampung = dataKomisaris.map(val => {
						return {
							kodeKomisarisWilayah: val.kodeKomisarisWilayah,
							namaKomisaris: val.namaKomisaris,
							daerah: val.daerah,
						}
					})
	
					
					for (let index = 0; index < dataTampung.length; index++) {
						const dataAnggota = await models.Biodata.findAll({
							where: { komisarisWilayah: dataTampung[index].kodeKomisarisWilayah },
							include: [
								{ 
									model: models.Anak,
								},
							],
						});
	
						const cekDataAnggota = async (data) => {
							let hasil = await Promise.all(data.map(val => {
								let nikBayangan = val.nik.split('.')[4]
								return { ...val.dataValues, nikBayangan }
							}))
		
							return _.orderBy(hasil, ['nikBayangan'], ['asc']);
						}
	
						const dataKeanggotaan = await cekDataAnggota(dataAnggota);
						const result = await Promise.all(dataKeanggotaan.map(async (val, i) => {
							let provinsi = val.provinsi ? await _wilayah2023Option({ models, kode: val.provinsi, bagian: 'provinsi' }) : val.provinsi
							let kabkota = val.kabKota ? await _wilayah2023Option({ models, kode: val.kabKota, bagian: 'kabkota' }) : val.kabKota
							let kecamatan = val.kecamatan ? await _wilayah2023Option({ models, kode: val.kecamatan, bagian: 'kecamatan' }) : val.kecamatan
							let kelurahan = val.kelurahan ? await _wilayah2023Option({ models, kode: val.kelurahan, bagian: 'keldes' }) : val.kelurahan
							const tanggungan = val.Anaks.length ? _.sortBy(val.Anaks, [function(o) { return o.tanggalLahir; }]) : []
							let anak = tanggungan.length ? tanggungan.filter(str => str.statusAnak === 'Hidup').map((value, i) => `${++i}. ${uppercaseLetterFirst3(value.namaAnak)} - ${value.kategoriAnak} (${value.tanggalLahir ? convertDateTime3(value.tanggalLahir) : '-'})`) : '-'
							
							return {
								nourut: `${setNum(++i)}\n${val.ompu}${val.generasi}`,
								nik: val.nik,
								nama: `1. ${uppercaseLetterFirst3(val.namaLengkap)}${val.statusSuami === 'Meninggal' ? ' (+)' : ''} ${val.tempatSuami || val.tanggalLahirSuami ? `(${uppercaseLetterFirst3(val.tempatSuami)}, ${convertDateTime3(val.tanggalLahirSuami)})` : ''}\n2. ${val.namaIstri ? uppercaseLetterFirst3(val.namaIstri):''}${val.statusIstri === 'Meninggal' ? ' (+)' : ''} ${val.tempatIstri || val.tanggalLahirIstri ? `(${uppercaseLetterFirst3(val.tempatIstri)}, ${convertDateTime3(val.tanggalLahirIstri)})` : ''}`,
								// nama: `${val.namaLengkap}${val.statusSuami === 'Meninggal' ? ' (+)' : ''} (${val.tempatSuami ? val.tempatSuami : '-'}, ${val.tanggalLahirSuami ? convertDateTime3(val.tanggalLahirSuami) : '-'}) / ${val.namaIstri}${val.statusIstri === 'Meninggal' ? ' (+)' : ''} (${val.tempatIstri ? val.tempatIstri : '-'}, ${val.tanggalLahirIstri ? convertDateTime3(val.tanggalLahirIstri) : '-'})`,
								tanggungan: val.Anaks.length ? _.join(anak, '\n') : '-',
								alamat: `${val.alamat ? val.alamat : '-'}${kelurahan ? `, ${kelurahan.dataValues.jenisKelDes} ${kelurahan.dataValues.nama}` : ''}${kecamatan ? `, Kecamatan ${kecamatan.dataValues.nama}` : ''}${kabkota ? `, ${kabkota.dataValues.jenisKabKota} ${kabkota.dataValues.nama}` : ''}${provinsi ? `, ${provinsi.dataValues.nama}` : ''} ${val.kodePos ? val.kodePos : ''}\nTelp: ${val.statusSuami === 'Meninggal' ? val.telpIstri ? val.telpIstri : '-' : val.telp ? val.telp : '-'}`,
							}
						}))
						const data = {
							dataBiodata: result.length ? result : [
								{
									nourut: '',
									nik: '',
									nama: '',
									tanggungan: '',
									alamat: '',
								}
							],
						};
	
						let worksheetBiodata = workbook.addWorksheet(`${dataTampung[index].kodeKomisarisWilayah}`);
	
						worksheetBiodata.getCell('A1').value = 'Komisaris';
						worksheetBiodata.getCell('A1').font = { name: 'Times New Normal', size: 11, bold: true };
						worksheetBiodata.getCell('B1').value = `${dataTampung[index].namaKomisaris}`;
						worksheetBiodata.getCell('B1').font = { name: 'Times New Normal', size: 11, bold: true };
						worksheetBiodata.getCell('A2').value = 'Komisariat';
						worksheetBiodata.getCell('A2').font = { name: 'Times New Normal', size: 11, bold: true };
						worksheetBiodata.getCell('B2').value = `${dataTampung[index].daerah}`;
						worksheetBiodata.getCell('B2').font = { name: 'Times New Normal', size: 11, bold: true };
	
						worksheetBiodata.addRow([]);
						Object.keys(data).forEach(sectionKey => {
							const sectionData = data[sectionKey];
	
							const tableHeader = worksheetBiodata.addRow(Object.keys(sectionData[0]));
							tableHeader.eachCell((cell, colNumber) => {
								cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
								cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
								// cell.font = { bold: true };
								cell.font = { name: 'Times New Normal', size: 11, bold: true };
								cell.alignment = { vertical: 'middle', horizontal: 'center' };
								worksheetBiodata.getRow(4).height = 25;
								worksheetBiodata.getColumn(1).width = 25;
								worksheetBiodata.getColumn(2).width = 25;
								worksheetBiodata.getColumn(3).width = 45;
								worksheetBiodata.getColumn(4).width = 45;
								worksheetBiodata.getColumn(5).width = 50;
	
								worksheetBiodata.getCell('A4').value = 'No. Urut PSO Sundut';
								worksheetBiodata.getCell('B4').value = 'No. Anggota';
								worksheetBiodata.getCell('C4').value = 'Goarni Ama/Ina Panggoaran';
								worksheetBiodata.getCell('D4').value = 'Lanakhon/Tanggungan';
								worksheetBiodata.getCell('E4').value = 'Alamat';
								
							});
	
							sectionData.forEach(item => {
								const rowData = Object.values(item);
								const row = worksheetBiodata.addRow(rowData);
								row.eachCell((cell, colNumber) => {
									cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
									cell.font = { name: 'Times New Normal', size: 10, bold: false };
									if (colNumber >= 3 && colNumber <= 5) {
										cell.alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									}else{
										cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
									}
								});
							});
						});
	
						res.setHeader(
							"Content-Disposition",
							"attachment; filename=ExportSiswa.xlsx"
						);
					}
	
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);
			
					return workbook.xlsx.write(res).then(function () {
						res.status(200).end();
					});
				}
			}else if(bagian === 'rekapmenikah'){
				if(kategori === 'full'){
					let workbook = new excel.Workbook();
					let split = wilayah.split(', ')
					for (let index = 0; index < split.length; index++) {
						const dataRekapMenikah = await models.RekapMenikah.findAll({
							where: { wilayah: split[index] },
							include: [
								{ 
									model: models.WilayahPanjaitan,
								},
							],
							order: [['createdAt', 'DESC']],
						});

						const result = await Promise.all(dataRekapMenikah.map(async val => {
							let wilayah = await _wilayahpanjaitanOption({ models, kode: val.dataValues.wilayah })
							
							return {
								idRekap: val.dataValues.idRekap,
								wilayah: wilayah.dataValues.label,
								tanggal: `${convertDateForDay(val.dataValues.tanggal)}, ${dateconvert(val.dataValues.tanggal)}`,
								kategori: val.dataValues.kategori,
								nama: val.dataValues.nama,
								orangTuaMenantu: val.dataValues.orangTuaMenantu,
								pemberkatan: val.dataValues.pemberkatan,
								penanggungJawab: val.dataValues.penanggungJawab,
								yangMemberiSumbangan: val.dataValues.yangMemberiSumbangan,
								pemberiUlos: val.dataValues.pemberiUlos,
								keterangan: val.dataValues.keterangan,
							}
						}))
						
						let wilayah_panjaitan = await _wilayahpanjaitanOption({ models, kode: split[index] })
						let nama_wilayah = wilayah_panjaitan.dataValues.label
						let worksheetRekapMenikah = workbook.addWorksheet(`${nama_wilayah}`);
	
						//Data Rekap
						worksheetRekapMenikah.columns = [
							{ header: "idRekap", key: "idRekap", width: 20 },
							{ header: "WILAYAH", key: "wilayah", width: 20 },
							{ header: "HARI, TANGGAL", key: "tanggal", width: 25 },
							{ header: "GOAR NI ULAON", key: "kategori", width: 35 },
							{ header: "GOAR NI NAMARHASOHOTAN", key: "nama", width: 40 },
							{ header: "GOAR NI HASUHUTON", key: "orangTuaMenantu", width: 40 },
							{ header: "GEREJA PAMASUMASUON DOHOT ALAMAN PARPESTAAN", key: "pemberkatan", width: 65 },
							{ header: "PROTOKOL", key: "penanggungJawab", width: 35 },
							{ header: "RAJA PARHATA / PARSINABUL", key: "yangMemberiSumbangan", width: 40 },
							{ header: "HASAHATAN NI ULOS NAMARHADOHOAN / PANANDAION TU PENGURUS", key: "pemberiUlos", width: 85 },
							{ header: "KETERANGAN", key: "keterangan", width: 50 },
						];
		
						worksheetRekapMenikah.addRows(result);
		
						worksheetRekapMenikah.eachRow({ includeEmpty: true }, function(row, rowNumber){
							row.eachCell(function(cell, colNumber){
								if (rowNumber === 1) {
									row.height = 25;
									cell.font = { name: 'Times New Normal', size: 11, bold: true };
									cell.alignment = { vertical: 'middle', horizontal: 'center' };
								}
								if (rowNumber > 1) {
									cell.font = { name: 'Times New Normal', size: 10, bold: false };
									row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(7).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(8).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(9).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(10).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(11).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
								 }
							});
						});
					
						res.setHeader(
							"Content-Disposition",
							"attachment; filename=ExportSiswa.xlsx"
						);
					}
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);
			
					return workbook.xlsx.write(res).then(function () {
						res.status(200).end();
					});
				}else if(kategori === 'byfilter'){
					startdate = startdate ? startdate : DateTime.local().plus({ month: -1 }).toISODate(),
					enddate = enddate ? enddate : DateTime.local().toISODate()

					let workbook = new excel.Workbook();
					let split = wilayah.split(', ')
					for (let index = 0; index < split.length; index++) {
						const dataRekapMenikah = await models.RekapMenikah.findAll({
							where: {
								wilayah: split[index],
								tanggal: { [Op.between]: [startdate, enddate] }
							},
							include: [
								{ 
									model: models.WilayahPanjaitan,
								},
							],
							order: [['createdAt', 'DESC']],
						});

						const result = await Promise.all(dataRekapMenikah.map(async val => {
							let wilayah = await _wilayahpanjaitanOption({ models, kode: val.dataValues.wilayah })
							
							return {
								idRekap: val.dataValues.idRekap,
								wilayah: wilayah.dataValues.label,
								tanggal: `${convertDateForDay(val.dataValues.tanggal)}, ${dateconvert(val.dataValues.tanggal)}`,
								kategori: val.dataValues.kategori,
								nama: val.dataValues.nama,
								orangTuaMenantu: val.dataValues.orangTuaMenantu,
								pemberkatan: val.dataValues.pemberkatan,
								penanggungJawab: val.dataValues.penanggungJawab,
								yangMemberiSumbangan: val.dataValues.yangMemberiSumbangan,
								pemberiUlos: val.dataValues.pemberiUlos,
								keterangan: val.dataValues.keterangan,
							}
						}))
						
						let wilayah_panjaitan = await _wilayahpanjaitanOption({ models, kode: split[index] })
						let nama_wilayah = wilayah_panjaitan.dataValues.label
						let worksheetRekapMenikah = workbook.addWorksheet(`${nama_wilayah}`);
	
						//Data Rekap
						worksheetRekapMenikah.columns = [
							{ header: "idRekap", key: "idRekap", width: 20 },
							{ header: "WILAYAH", key: "wilayah", width: 20 },
							{ header: "HARI, TANGGAL", key: "tanggal", width: 25 },
							{ header: "GOAR NI ULAON", key: "kategori", width: 35 },
							{ header: "GOAR NI NAMARHASOHOTAN", key: "nama", width: 40 },
							{ header: "GOAR NI HASUHUTON", key: "orangTuaMenantu", width: 40 },
							{ header: "GEREJA PAMASUMASUON DOHOT ALAMAN PARPESTAAN", key: "pemberkatan", width: 65 },
							{ header: "PROTOKOL", key: "penanggungJawab", width: 35 },
							{ header: "RAJA PARHATA / PARSINABUL", key: "yangMemberiSumbangan", width: 40 },
							{ header: "HASAHATAN NI ULOS NAMARHADOHOAN / PANANDAION TU PENGURUS", key: "pemberiUlos", width: 85 },
							{ header: "KETERANGAN", key: "keterangan", width: 50 },
						];
		
						worksheetRekapMenikah.addRows(result);
		
						worksheetRekapMenikah.eachRow({ includeEmpty: true }, function(row, rowNumber){
							row.eachCell(function(cell, colNumber){
								if (rowNumber === 1) {
									row.height = 25;
									cell.font = { name: 'Times New Normal', size: 11, bold: true };
									cell.alignment = { vertical: 'middle', horizontal: 'center' };
								}
								if (rowNumber > 1) {
									cell.font = { name: 'Times New Normal', size: 10, bold: false };
									row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(7).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(8).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(9).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(10).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(11).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
								 }
							});
						});
					
						res.setHeader(
							"Content-Disposition",
							"attachment; filename=ExportSiswa.xlsx"
						);
					}
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);
			
					return workbook.xlsx.write(res).then(function () {
						res.status(200).end();
					});
				}
			}else if(bagian === 'rekapmeninggal'){
				if(kategori === 'full'){
					let workbook = new excel.Workbook();
					let split = wilayah.split(', ')
					for (let index = 0; index < split.length; index++) {
						const dataRekapMeninggal = await models.RekapMeninggal.findAll({
							where: { wilayah: split[index] },
							include: [
								{ 
									model: models.WilayahPanjaitan,
								},
							],
							order: [['createdAt', 'DESC']],
						});

						const result = await Promise.all(dataRekapMeninggal.map(async val => {
							let wilayah = await _wilayahpanjaitanOption({ models, kode: val.dataValues.wilayah })

							return {
								idRekap: val.dataValues.idRekap,
								wilayah: wilayah.dataValues.label,
								tanggal: `${convertDateForDay(val.dataValues.tanggal)}, ${dateconvert(val.dataValues.tanggal)}`,
								kategori: val.dataValues.kategori,
								nama: val.dataValues.nama,
								yangDitinggal: val.dataValues.yangDitinggal,
								rumahDuka: val.dataValues.rumahDuka,
								acaraAdat: val.dataValues.acaraAdat,
								penanggungJawab: val.dataValues.penanggungJawab,
								yangMemberiSumbangan: val.dataValues.yangMemberiSumbangan,
								keterangan: val.dataValues.keterangan,
							}
						}))
						
						let wilayah_panjaitan = await _wilayahpanjaitanOption({ models, kode: split[index] })
						let nama_wilayah = wilayah_panjaitan.dataValues.label
						let worksheetRekapMeninggal = workbook.addWorksheet(`${nama_wilayah}`);
	
						//Data Rekap
						worksheetRekapMeninggal.columns = [
							{ header: "idRekap", key: "idRekap", width: 20 },
							{ header: "WILAYAH", key: "wilayah", width: 20 },
							{ header: "TANGGAL", key: "tanggal", width: 20 },
							{ header: "NAMONDING", key: "kategori", width: 35 },
							{ header: "GOAR NI NAMONDING", key: "nama", width: 40 },
							{ header: "HASUHUTON / NAMANGHABALUHON", key: "yangDitinggal", width: 50 },
							{ header: "INGANAN", key: "rumahDuka", width: 40 },
							{ header: "TONGGO RAJA / PASADA TAHI / ADAT PARTUATNA", key: "acaraAdat", width: 60 },
							{ header: "PROTOKOL", key: "penanggungJawab", width: 40 },
							{ header: "RAJA ARHATA / PARSINABUL / NAMANGULUHON", key: "yangMemberiSumbangan", width: 70 },
							{ header: "KETERANGAN", key: "keterangan", width: 50 },
						];
		
						worksheetRekapMeninggal.addRows(result);
		
						worksheetRekapMeninggal.eachRow({ includeEmpty: true }, function(row, rowNumber){
							row.eachCell(function(cell, colNumber){
								if (rowNumber === 1) {
									row.height = 25;
									cell.font = { name: 'Times New Normal', size: 11, bold: true };
									cell.alignment = { vertical: 'middle', horizontal: 'center' };
								}
								if (rowNumber > 1) {
									cell.font = { name: 'Times New Normal', size: 10, bold: false };
									row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(7).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(8).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(9).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(10).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(11).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
								 }
							});
						});
					
						res.setHeader(
							"Content-Disposition",
							"attachment; filename=ExportSiswa.xlsx"
						);
					}
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);
			
					return workbook.xlsx.write(res).then(function () {
						res.status(200).end();
					});
				}else if(kategori === 'byfilter'){
					startdate = startdate ? startdate : DateTime.local().plus({ month: -1 }).toISODate(),
					enddate = enddate ? enddate : DateTime.local().toISODate()

					let workbook = new excel.Workbook();
					let split = wilayah.split(', ')
					for (let index = 0; index < split.length; index++) {
						const dataRekapMeninggal = await models.RekapMenikah.findAll({
							where: {
								wilayah: split[index],
								tanggal: { [Op.between]: [startdate, enddate] }
							},
							include: [
								{ 
									model: models.WilayahPanjaitan,
								},
							],
							order: [['createdAt', 'DESC']],
						});

						const result = await Promise.all(dataRekapMenikah.map(async val => {
							let wilayah = await _wilayahpanjaitanOption({ models, kode: val.dataValues.wilayah })
							
							return {
								idRekap: val.dataValues.idRekap,
								wilayah: wilayah.dataValues.label,
								tanggal: `${convertDateForDay(val.dataValues.tanggal)}, ${dateconvert(val.dataValues.tanggal)}`,
								kategori: val.dataValues.kategori,
								nama: val.dataValues.nama,
								yangDitinggal: val.dataValues.yangDitinggal,
								rumahDuka: val.dataValues.rumahDuka,
								acaraAdat: val.dataValues.acaraAdat,
								penanggungJawab: val.dataValues.penanggungJawab,
								yangMemberiSumbangan: val.dataValues.yangMemberiSumbangan,
								keterangan: val.dataValues.keterangan,
							}
						}))
						
						let wilayah_panjaitan = await _wilayahpanjaitanOption({ models, kode: split[index] })
						let nama_wilayah = wilayah_panjaitan.dataValues.label
						let worksheetRekapMeninggal = workbook.addWorksheet(`${nama_wilayah}`);
	
						//Data Rekap
						worksheetRekapMeninggal.columns = [
							{ header: "idRekap", key: "idRekap", width: 20 },
							{ header: "WILAYAH", key: "wilayah", width: 20 },
							{ header: "TANGGAL", key: "tanggal", width: 20 },
							{ header: "NAMONDING", key: "kategori", width: 35 },
							{ header: "GOAR NI NAMONDING", key: "nama", width: 40 },
							{ header: "HASUHUTON / NAMANGHABALUHON", key: "yangDitinggal", width: 50 },
							{ header: "INGANAN", key: "rumahDuka", width: 40 },
							{ header: "TONGGO RAJA / PASADA TAHI / ADAT PARTUATNA", key: "acaraAdat", width: 60 },
							{ header: "PROTOKOL", key: "penanggungJawab", width: 40 },
							{ header: "RAJA ARHATA / PARSINABUL / NAMANGULUHON", key: "yangMemberiSumbangan", width: 70 },
							{ header: "KETERANGAN", key: "keterangan", width: 50 },
						];
		
						worksheetRekapMeninggal.addRows(result);
		
						worksheetRekapMeninggal.eachRow({ includeEmpty: true }, function(row, rowNumber){
							row.eachCell(function(cell, colNumber){
								if (rowNumber === 1) {
									row.height = 25;
									cell.font = { name: 'Times New Normal', size: 11, bold: true };
									cell.alignment = { vertical: 'middle', horizontal: 'center' };
								}
								if (rowNumber > 1) {
									cell.font = { name: 'Times New Normal', size: 10, bold: false };
									row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
									row.getCell(5).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(6).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(7).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(8).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(9).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(10).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
									row.getCell(11).alignment = { vertical: 'middle', horizontal: 'justify', wrapText: true };
								 }
							});
						});
					
						res.setHeader(
							"Content-Disposition",
							"attachment; filename=ExportSiswa.xlsx"
						);
					}
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);
			
					return workbook.xlsx.write(res).then(function () {
						res.status(200).end();
					});
				}
			}
	  } catch (err) {
			console.log(err);
			return NOT_FOUND(res, err.message)
	  }
	}  
}

function pdfCreate (models) {
	return async (req, res, next) => {
		let { uid } = req.params
		try {
			const dataCMS = await models.CMSSetting.findAll();

			const cms_setting = {}
			dataCMS.forEach(str => {
				let eva = JSON.parse(str.setting)
				if(eva.label){
					cms_setting[str.kode] = eva
				}else{
					cms_setting[str.kode] = eva.value
				}
			})
			
			const dataSiswaSiswi = await models.User.findOne({
				where: { idUser: uid },
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{ 
						model: models.Role,
						attributes: ['namaRole'],
						where: { status: true }
					},
					{ 
						model: models.UserDetail,
					},
				],
				order: [
					['createdAt', 'DESC'],
				],
			});
			
			let agama = await _agamaOption({ models, kode: dataSiswaSiswi.UserDetail.agama })
			let hobi = await _hobiOption({ models, kode: dataSiswaSiswi.UserDetail.hobi })
			let cita_cita = await _citacitaOption({ models, kode: dataSiswaSiswi.UserDetail.citaCita })
			let jenjang = await _jenjangsekolahOption({ models, kode: dataSiswaSiswi.UserDetail.jenjang })
			let status_sekolah = await _statussekolahOption({ models, kode: dataSiswaSiswi.UserDetail.statusSekolah })
			let kabkota_sekolah = await _wilayahOption({ models, kode: dataSiswaSiswi.UserDetail.kabkotSekolah })
			let status_ayah = await _statusortuOption({ models, kode: dataSiswaSiswi.UserDetail.statusAyah })
			let status_ibu = await _statusortuOption({ models, kode: dataSiswaSiswi.UserDetail.statusIbu })
			let pendidikan_ayah = await _pendidikanOption({ models, kode: dataSiswaSiswi.UserDetail.pendidikanAyah })
			let pendidikan_ibu = await _pendidikanOption({ models, kode: dataSiswaSiswi.UserDetail.pendidikanIbu })
			let pendidikan_wali = await _pendidikanOption({ models, kode: dataSiswaSiswi.UserDetail.pendidikanWali })
			let pekerjaan_ayah = await _pekerjaanOption({ models, kode: dataSiswaSiswi.UserDetail.pekerjaanAyah })
			let pekerjaan_ibu = await _pekerjaanOption({ models, kode: dataSiswaSiswi.UserDetail.pekerjaanIbu })
			let pekerjaan_wali = await _pekerjaanOption({ models, kode: dataSiswaSiswi.UserDetail.pekerjaanWali })
			let penghasilan = await _penghasilanOption({ models, kode: dataSiswaSiswi.UserDetail.penghasilan })
			let provinsi = await _wilayahOption({ models, kode: dataSiswaSiswi.UserDetail.provinsi })
			let kabkota = await _wilayahOption({ models, kode: dataSiswaSiswi.UserDetail.kabKota })
			let kecamatan = await _wilayahOption({ models, kode: dataSiswaSiswi.UserDetail.kecamatan })
			let kelurahan = await _wilayahOption({ models, kode: dataSiswaSiswi.UserDetail.kelurahan })
			let status_tempat_tinggal = await _statustempattinggalOption({ models, kode: dataSiswaSiswi.UserDetail.statusTempatTinggal })
			let jarak_rumah = await _jarakrumahOption({ models, kode: dataSiswaSiswi.UserDetail.jarakRumah })
			let transportasi = await _transportasiOption({ models, kode: dataSiswaSiswi.UserDetail.transportasi })

			const hasil = {
				url: BASE_URL,
				idUser: dataSiswaSiswi.idUser,
				consumerType: dataSiswaSiswi.consumerType,
				nikSiswa: dataSiswaSiswi.UserDetail.nikSiswa,
				nomorInduk: dataSiswaSiswi.UserDetail.nomorInduk,
				namaRole: dataSiswaSiswi.Role.namaRole,
				nama: uppercaseLetterFirst2(dataSiswaSiswi.nama),
				username: dataSiswaSiswi.username,
				email: dataSiswaSiswi.email,
				password: dataSiswaSiswi.password,
				kataSandi: dataSiswaSiswi.kataSandi,
				tempat: dataSiswaSiswi.UserDetail.tempat,
				tanggalLahir: dateconvert(dataSiswaSiswi.UserDetail.tanggalLahir),
				jenisKelamin: dataSiswaSiswi.UserDetail.jenisKelamin,
				agama: dataSiswaSiswi.UserDetail.agama ? agama.label : null,
				anakKe: dataSiswaSiswi.UserDetail.anakKe,
				jumlahSaudara: dataSiswaSiswi.UserDetail.jumlahSaudara,
				hobi: dataSiswaSiswi.UserDetail.hobi ? hobi.label : null,
				citaCita: dataSiswaSiswi.UserDetail.citaCita ? cita_cita.label : null,
				// dataSekolahSebelumnya: {
					jenjang: dataSiswaSiswi.UserDetail.jenjang ? jenjang.label : null,
					statusSekolah: dataSiswaSiswi.UserDetail.statusSekolah ? status_sekolah.label : null,
					namaSekolah: dataSiswaSiswi.UserDetail.namaSekolah,
					npsn: dataSiswaSiswi.UserDetail.npsn,
					alamatSekolah: dataSiswaSiswi.UserDetail.alamatSekolah,
					kabkotSekolah: dataSiswaSiswi.UserDetail.kabkotSekolah ? uppercaseLetterFirst2(kabkota_sekolah.nama) : null,
					noPesertaUN: dataSiswaSiswi.UserDetail.noPesertaUN,
					noSKHUN: dataSiswaSiswi.UserDetail.noSKHUN,
					noIjazah: dataSiswaSiswi.UserDetail.noIjazah,
					nilaiUN: dataSiswaSiswi.UserDetail.nilaiUN,
				// },
				noKK: dataSiswaSiswi.UserDetail.noKK,
				namaKK: dataSiswaSiswi.UserDetail.namaKK,
				// dataOrangtua: {
				// 	dataAyah: {
						namaAyah: dataSiswaSiswi.UserDetail.namaAyah ? uppercaseLetterFirst2(dataSiswaSiswi.UserDetail.namaAyah) : '-',
						tahunAyah: dataSiswaSiswi.UserDetail.tahunAyah,
						statusAyah: dataSiswaSiswi.UserDetail.statusAyah ? status_ayah.label : null,
						nikAyah: dataSiswaSiswi.UserDetail.nikAyah,
						pendidikanAyah: dataSiswaSiswi.UserDetail.pendidikanAyah ? pendidikan_ayah.label : null,
						pekerjaanAyah: dataSiswaSiswi.UserDetail.pekerjaanAyah ? pekerjaan_ayah.label : null,
						telpAyah: dataSiswaSiswi.UserDetail.telpAyah,
					// },
					// dataIbu: {
						namaIbu: dataSiswaSiswi.UserDetail.namaIbu ? uppercaseLetterFirst2(dataSiswaSiswi.UserDetail.namaIbu) : '-',
						tahunIbu: dataSiswaSiswi.UserDetail.tahunIbu,
						statusIbu: dataSiswaSiswi.UserDetail.statusIbu ? status_ibu.label : null,
						nikIbu: dataSiswaSiswi.UserDetail.nikIbu,
						pendidikanIbu: dataSiswaSiswi.UserDetail.pendidikanIbu ? pendidikan_ibu.label : null,
						pekerjaanIbu: dataSiswaSiswi.UserDetail.pekerjaanIbu ? pekerjaan_ibu.label : null,
						telpIbu: dataSiswaSiswi.UserDetail.telpIbu,
					// },
					// dataWali: {
						namaWali: dataSiswaSiswi.UserDetail.namaWali ? uppercaseLetterFirst2(dataSiswaSiswi.UserDetail.namaWali) : '-',
						tahunWali: dataSiswaSiswi.UserDetail.tahunWali,
						nikWali: dataSiswaSiswi.UserDetail.nikWali,
						pendidikanWali: dataSiswaSiswi.UserDetail.pendidikanWali ? pendidikan_wali.label : null,
						pekerjaanWali: dataSiswaSiswi.UserDetail.pekerjaanWali ? pekerjaan_wali.label : null,
						telpWali: dataSiswaSiswi.UserDetail.telpWali,
				// 	}
				// },
				penghasilan: dataSiswaSiswi.UserDetail.penghasilan ? penghasilan.label : null,
				// dataAlamatOrangtua: {
					telp: dataSiswaSiswi.UserDetail.telp,
					alamat: dataSiswaSiswi.UserDetail.alamat,
					provinsi: dataSiswaSiswi.UserDetail.provinsi ? uppercaseLetterFirst2(provinsi.nama) : null,
					kabKota: dataSiswaSiswi.UserDetail.kabKota ? uppercaseLetterFirst2(kabkota.nama) : null,
					kecamatan: dataSiswaSiswi.UserDetail.kecamatan ? uppercaseLetterFirst2(kecamatan.nama) : null,
					kelurahan: dataSiswaSiswi.UserDetail.kelurahan ? uppercaseLetterFirst2(kelurahan.nama) : null,
					kodePos: dataSiswaSiswi.UserDetail.kodePos,
				// },
				kelas: dataSiswaSiswi.UserDetail.kelas,
				// dataLainnya: {
					statusTempatTinggal: dataSiswaSiswi.UserDetail.statusTempatTinggal ? status_tempat_tinggal.label : null,
					jarakRumah: dataSiswaSiswi.UserDetail.jarakRumah ? jarak_rumah.label : null,
					transportasi: dataSiswaSiswi.UserDetail.transportasi ? transportasi.label : null,
				// },
				fotoProfil: dataSiswaSiswi.UserDetail.fotoProfil,
				// berkas: {
					fcIjazah: dataSiswaSiswi.UserDetail.fcIjazah,
					fcSKHUN: dataSiswaSiswi.UserDetail.fcSKHUN,
					fcKK: dataSiswaSiswi.UserDetail.fcKK,
					fcKTPOrtu: dataSiswaSiswi.UserDetail.fcKTPOrtu,
					fcAktaLahir: dataSiswaSiswi.UserDetail.fcAktaLahir,
					fcSKL: dataSiswaSiswi.UserDetail.fcSKL,
				// },
				validasiAkun: dataSiswaSiswi.validasiAkun,
				statusAktif: dataSiswaSiswi.statusAktif,
			}
			// return OK(res, hasil)
			ejs.renderFile(path.join(__dirname, "../../src/views/viewSiswa.ejs"), { dataSiswa: hasil, cmsSetup: cms_setting }, (err, data) => {
				if (err) {
					console.log(err);
				} else {
					// console.log(data)
					let options = {
						format: "A4",
						orientation: "portrait",
						quality: "10000",
						border: {
							top: "1cm",
							right: "1cm",
							bottom: "1cm",
							left: "1cm"
						},
						// header: {
						// 	height: "12mm",
						// },
						// footer: {
						// 	height: "15mm",
						// },
						httpHeaders: {
							"Content-type": "application/pdf",
						},
						type: "pdf",
					};
					pdf.create(data, options).toStream(function(err, stream){
						stream.pipe(res);
					});
				}
			});
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function pdfCreateRaport (models) {
	return async (req, res, next) => {
		let { uid } = req.params
		try {
			const dataCMS = await models.CMSSetting.findAll();

			const cms_setting = {}
			dataCMS.forEach(str => {
				let eva = JSON.parse(str.setting)
				if(eva.label){
					cms_setting[str.kode] = eva
				}else{
					cms_setting[str.kode] = eva.value
				}
			})
			
			const dataSiswaSiswi = await models.User.findOne({
				where: { idUser: uid },
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{ 
						model: models.Role,
						attributes: ['namaRole'],
						where: { status: true }
					},
					{ 
						model: models.UserDetail,
					},
				],
				order: [
					['createdAt', 'DESC'],
				],
			});

			const jumlahSiswa = await models.User.count({
				where: { mutasiAkun: false },
				include: [
					{ 
						model: models.UserDetail,
						where: { kelas: dataSiswaSiswi.UserDetail.kelas },
					},
				],
			});

			const dataNilai = await models.Nilai.findAll({
				where: { idUser: uid },
				attributes: ['mapel', 'dataNilai', 'dataKehadiran']
			})
			let hasilBayangan = 0
			let kehadiranBayangan = {
				sakit: 0,
				alfa: 0,
				ijin: 0,
			}
			let semester = cms_setting.semester.value === 1 ? 'ganjil' : 'genap'
			let resultNilai = await Promise.all(dataNilai.map(async str => {
				const dataJadwal = await models.JadwalMengajar.findOne({ where: { kelas: dataSiswaSiswi.UserDetail.kelas, mapel: str.mapel, status: true } });
				let jumlahTugas = dataJadwal ? dataJadwal.jumlahTugas : 0
				let kkm = dataJadwal ? dataJadwal.kkm : 0
				let dataStruktural = null
				if(dataJadwal) {
					dataStruktural = await models.User.findOne({ where: { idUser: dataJadwal.idUser } });
				}
				let hasil = JSON.parse(str.dataNilai)
				let hasil2 = JSON.parse(str.dataKehadiran)
				let nilaiData = hasil.filter(str => str.semester === semester)[0].nilai
				let kehadiranData = hasil2.filter(str => str.semester === semester)[0].kehadiran
				let totalNilaiTugas = Number(nilaiData.tugas1) + Number(nilaiData.tugas2) + Number(nilaiData.tugas3) + Number(nilaiData.tugas4) + Number(nilaiData.tugas5) + Number(nilaiData.tugas6) + Number(nilaiData.tugas7) + Number(nilaiData.tugas8) + Number(nilaiData.tugas9) + Number(nilaiData.tugas10)
				let rataRataTugas = totalNilaiTugas === 0 ? 0 : totalNilaiTugas / Number(jumlahTugas)
				let rataRataNilai = (Number(rataRataTugas) + Number(nilaiData.uts) + Number(nilaiData.uas)) / 3
				let hurufNilai = rataRataNilai <= 50 ? 'E' : rataRataNilai <= 65 ? 'D' : rataRataNilai <= 75 ? 'C' : rataRataNilai <= 85 ? 'B' : 'A'
				let hasilakhir = rataRataNilai != 0 ? Math.ceil(rataRataNilai) : 0
				hasilBayangan += hasilakhir
				kehadiranBayangan.sakit += kehadiranData.sakit
				kehadiranBayangan.alfa += kehadiranData.alfa
				kehadiranBayangan.ijin += kehadiranData.ijin
				return {
					mapel: str.mapel,
					nilai: hasilakhir,
					kehadiran: kehadiranData,
					namaGuru: dataStruktural ? dataStruktural.nama : '-',
					kkm,
					hurufNilai,
					pembilang: hasilakhir === 0 ? 'Nol' : pembilang(hasilakhir)
				}
			}))
			
			let hasilAkhir = Math.ceil(hasilBayangan / dataNilai.length)
			let hurufNilai = hasilAkhir <= 50 ? 'E' : hasilAkhir <= 65 ? 'D' : hasilAkhir <= 75 ? 'C' : hasilAkhir <= 85 ? 'B' : 'A'
			const hasil = {
				url: BASE_URL,
				idUser: dataSiswaSiswi.idUser,
				nomorInduk: dataSiswaSiswi.UserDetail.nomorInduk,
				nama: uppercaseLetterFirst2(dataSiswaSiswi.nama),
				kelas: dataSiswaSiswi.UserDetail.kelas,
				peringkat: dataSiswaSiswi.UserDetail.peringkat,
				jumlahSiswa,
				hasilAkhir,
				hurufNilai,
				pembilang: hasilAkhir === 0 ? 'Nol' : pembilang(hasilAkhir),
				dataNilai: resultNilai,
				kehadiran: kehadiranBayangan,
			}
			// return OK(res, hasil)
			ejs.renderFile(path.join(__dirname, "../../src/views/viewRaportSiswa.ejs"), { dataSiswa: hasil, cmsSetup: cms_setting }, (err, data) => {
				if (err) {
					console.log(err);
				} else {
					// console.log(data)
					let options = {
						format: "A4",
						orientation: "portrait",
						quality: "10000",
						border: {
							top: "1cm",
							right: "1cm",
							bottom: "1cm",
							left: "1cm"
						},
						// header: {
						// 	height: "12mm",
						// },
						// footer: {
						// 	height: "15mm",
						// },
						httpHeaders: {
							"Content-type": "application/pdf",
						},
						type: "pdf",
					};
					pdf.create(data, options).toStream(function(err, stream){
						stream.pipe(res);
					});
				}
			});
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

function testing (models) {
	return async (req, res, next) => {
		let { suhu, ph, tds, tahun, bulan, kategori } = req.query
		try {
			// let textInput = "JAWA BARAT"
			// let regex = /[\!\@\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-]/g
			// let cek = regex.test(textInput)
			// textInput = textInput.toLowerCase();
			// var stringArray = ''
			// if(cek){
			// 	stringArray = textInput.split(". ");
			// }else{
			// 	stringArray = textInput.split(/\b(\s)/);
			// }
			// for (var i = 0; i < stringArray.length; i++) {
			// 	stringArray[i] =
			// 		stringArray[i].charAt(0).toUpperCase() +
			// 		stringArray[i].substring(1);
			// }
			// var finalText = cek ? stringArray.join(". ") : stringArray.join("");

			//////////////////////////////////////////////////////////

			// const userEmailArray = [ 'one', 'two', 'three' ]
			// const promises = userEmailArray.map((userEmail, i) =>
			// 	new Promise(resolve =>
			// 		setTimeout(() => {
			// 			console.log(userEmail)
			// 			resolve()
			// 		}, 1000 * userEmailArray.length - 1000 * i)
			// 	)
			// )
			// Promise.all(promises).then(() => console.log('done'))

			/////////////////////////////////////////////////////////

			// let date = new Date();
			// const data = await request({
			// 	url: `https://api.thingspeak.com/update.json`,
			// 	method: 'POST',
			// 	headers: {
			// 		"Content-Type": "application/json"
			// 	},
			// 	data: {
			// 		"api_key": "WXL31YFDLPAHXETO",
			// 		"created_at": date,
			// 		"field1": suhu,
			// 		"field2": ph,
			// 		"field3": tds,
			// 		"latitude": "",
			// 		"longitude": "",
			// 		"status": "Please check in!"
			// 	}
			// })

			// let tahun = dayjs().format('YYYY')
			// for (let index = 2024; index <= Number(tahun); index++) {
			// 	console.log(index);
			// }

			// const dataRekapTugas = await models.RekapTugas.findAll({
			// 	include: [
			// 		{ 
			// 			model: models.WilayahPanjaitan,
			// 		},
			// 	],
			// 	order: [['wilayah', 'ASC']],
			// 	limit: 1
			// });

			// let result = await Promise.all(dataRekapTugas.map(str => {
			// 	let tugasMenikah = JSON.parse(str.menikah)
			// 	let tugasMeninggal = JSON.parse(str.meninggal)
			// 	let datatugasMenikahTemp = tugasMenikah.filter(val => val.tahun === tahun)
			// 	let datatugasMeninggalTemp = tugasMeninggal.filter(val => val.tahun === tahun)
			// 	let wadahMenikah = datatugasMenikahTemp.length ? datatugasMenikahTemp[0].menikah : []
			// 	let wadahMeninggal = datatugasMeninggalTemp.length ? datatugasMeninggalTemp[0].meninggal : []
			// 	let dataTugasMenikah = wadahMenikah.filter(val => val.bulan <= parseInt(bulan)).map(str => str.data)
			// 	let dataTugasMeninggal = wadahMeninggal.filter(val => val.bulan <= parseInt(bulan)).map(str => str.data)
			// 	var tugasTampung = dataTugasMenikah.map((obj, index) => ({
			// 		...obj,
			// 		...dataTugasMeninggal[index],
			// 		total: obj.totalmenikah + dataTugasMeninggal[index].totalmeninggal
			// 	}));
			// 	const countObj = tugasTampung.reduce((acc, curr) => {
			// 		return {
			// 			Anak_Mangoli: acc.Anak_Mangoli + curr.Anak_Mangoli,
			// 			Boru_Muli: acc.Boru_Muli + curr.Boru_Muli,
			// 			Bere_Mangoli: acc.Bere_Mangoli + curr.Bere_Mangoli,
			// 			Pasahat: acc.Pasahat + curr.Pasahat,
			// 			Manjalo: acc.Manjalo + curr.Manjalo,
			// 			Resepsi: acc.Resepsi + curr.Resepsi,
			// 			M123: acc.M123 + curr.M123,
			// 			totalmenikah: acc.totalmenikah + curr.totalmenikah,
			// 			Ama: acc.Ama + curr.Ama,
			// 			Ina: acc.Ina + curr.Ina,
			// 			Hela: acc.Hela + curr.Hela,
			// 			Boru: acc.Boru + curr.Boru,
			// 			Anak_Boru: acc.Anak_Boru + curr.Anak_Boru,
			// 			Dakdanak: acc.Dakdanak + curr.Dakdanak,
			// 			totalmeninggal: acc.totalmeninggal + curr.totalmeninggal,
			// 			total: acc.total + curr.total,
			// 		};
			// 	}, {
			// 		Anak_Mangoli: 0,
			// 		Boru_Muli: 0,
			// 		Bere_Mangoli: 0,
			// 		Pasahat: 0,
			// 		Manjalo: 0,
			// 		Resepsi: 0,
			// 		M123: 0,
			// 		totalmenikah: 0,
			// 		Ama: 0,
			// 		Ina: 0,
			// 		Hela: 0,
			// 		Boru: 0,
			// 		Anak_Boru: 0,
			// 		Dakdanak: 0,
			// 		totalmeninggal: 0,
			// 		total: 0,
			// 	});
			// 	return countObj
			// }))

			// const dataWilayah = await _allOption({ table: models.WilayahPanjaitan })
			// const responseData = await Promise.all(dataWilayah.map(async val => {
			// 	const count = await models.Biodata.count({where: { wilayah: val.kode }});
			// 	const dataBiodata = await models.Biodata.findAll({where: { wilayah: val.kode }});
			// 	const countObj = dataBiodata.reduce((acc, curr) => {
			// 		const tmp = acc
			// 		const { statusSuami, statusIstri } = curr
			// 		if(statusSuami === 'Hidup') tmp.suami += 1
			// 		if(statusIstri === 'Hidup') tmp.istri += 1
			// 		return tmp
			// 	}, {
			// 		suami: 0,
			// 		istri: 0,
			// 	});

			// 	const databiodata = await models.Biodata.findAll({where: { wilayah: val.kode }, attributes: ['idBiodata']});
			// 	const anak = await _anakOption({ models, idBiodata: databiodata.map(str => str.idBiodata) })
			// 	let obj = {
			// 		kode: val.kode,
			// 		label: val.label,
			// 		jml: count,
			// 		totalJiwa: anak.length + countObj.suami + countObj.istri,
			// 	}
			// 	return obj;
			// }))

			// const dataKomisarisWilayah = await _allOption({ table: models.KomisarisWilayah, where: { kodeWilayah: '01', statusKomisaris: true } })
			// const responseData = await Promise.all(dataKomisarisWilayah.map(async val => {
			// 	const count = await models.Biodata.count({where: { komisarisWilayah: val.kodeKomisarisWilayah }});
			// 	const dataBiodata = await models.Biodata.findAll({where: { komisarisWilayah: val.kodeKomisarisWilayah }});
			// 	const countObj = dataBiodata.reduce((acc, curr) => {
			// 		const tmp = acc
			// 		const { statusSuami, statusIstri } = curr
			// 		if(statusSuami === 'Hidup') tmp.suami += 1
			// 		if(statusIstri === 'Hidup') tmp.istri += 1
			// 		return tmp
			// 	}, {
			// 		suami: 0,
			// 		istri: 0,
			// 	});

			// 	const databiodata = await models.Biodata.findAll({where: { komisarisWilayah: val.kodeKomisarisWilayah }, attributes: ['idBiodata']});
			// 	const anak = await _anakOption({ models, idBiodata: databiodata.map(str => str.idBiodata) })
			// 	let obj = {
			// 		kodeKomisarisWilayah: val.kodeKomisarisWilayah,
			// 		kodeWilayah: val.kodeWilayah,
			// 		namaKomisaris: val.namaKomisaris,
			// 		jml: count,
			// 		totalJiwa: anak.length + countObj.suami + countObj.istri,
			// 	}
			// 	return obj;
			// }))
			const toTitleCase = (str) => {
				return str.replace(
					// /\b[a-z]/g,
					/\w\S*/g,
					text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
				);
			}
			const text = "ir.h.drs.triyoga, s.kom"
			const result = toTitleCase(text)
			const result2 = text.replace(/\b[a-z]/g, (x) => x.toUpperCase())
			return OK(res, {result, result2})
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

module.exports = {
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
	getManagePenanggungJawab,
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
}