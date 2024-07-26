const {
	response,
	OK,
	NOT_FOUND,
	NO_CONTENT
} = require('@triyogagp/backend-common/utils/response.utils');
const {
	encrypt,
	decrypt,
	convertDateTime,
	createKSUID,
	makeRandom,
	UpperFirstLetter,
	inisialuppercaseLetterFirst,
	buildMysqlResponseWithPagination,
	buildOrderQuery,
} = require('@triyogagp/backend-common/utils/helper.utils')
const {
	_wilayahOption,
	_wilayahCount,
} = require('../controllers/helper.service')
const { Op, fn } = require('sequelize')
const sequelize = require('sequelize')
const { sequelizeInstance } = require('../configs/db.config');
const { logger } = require('../configs/db.winston')
const fs = require('fs');
const path = require('path');
const _ = require('lodash')
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const dotenv = require('dotenv');
dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);
const BASE_URL = process.env.BASE_URL

function formatInterval(minutes) {
  let interval = [
    Math.floor(minutes / 60).toString(),  //hours ("1" - "12")
    (minutes % 60).toString()             //minutes ("1" - "59")
  ];
  // return interval[0].padStart(2, '0') + ' Jam ' + interval[1].padStart(2, '0') + ' Menit'
  return interval[0] + ' Jam ' + interval[1] + ' Menit'
}

function updateFile (models) {
  return async (req, res, next) => {
		let namaFile = req.files[0].filename;
		let body = { ...req.body, namaFile };
    try {
			let kirimdata
			if(body.table == 'Admin'){
				kirimdata = { fotoProfil: body.nama_folder+'/'+body.namaFile }
				await models.Admin.update(kirimdata, { where: { idAdmin: body.idUser } })
			}else if(body.table == 'Biodata'){
				kirimdata = { fotoProfil: body.nama_folder+'/'+body.namaFile }
				await models.Biodata.update(kirimdata, { where: { idBiodata: body.idUser } })
			}else if(body.table == 'CMSSetting'){
				kirimdata = { 
					setting: JSON.stringify({
						value: body.namaFile,
					}),
				}
				await models.CMSSetting.update(kirimdata, { where: { kode: body.kode } })
			}
			return OK(res, body);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function updateBerkas (models) {
  return async (req, res, next) => {
		let namaFile = req.files[0].filename;
		let body = { ...req.body, namaFile };
    try {
			let kirimdata
			if(body.table == 'Berkas'){
				kirimdata = { 
					idBerkas: await createKSUID(),
					type: body.type,
					title: body.title,
					ext: body.ext,
					statusAktif: 1,
					file: body.namaFile,
				}
				await models.Berkas.create(kirimdata)
			}else if(body.table == 'QuestionExam'){
				await models.TemporaryFile.create({ 
					kode: makeRandom(10),
					folder: body.folder,
					file: body.namaFile,
					use: 0,
				})
			}
			return OK(res, body);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getUID () {
  return async (req, res, next) => {
    try {
			const ksuid = await createKSUID()
			return OK(res, ksuid);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getEncrypt () {
  return async (req, res, next) => {
		let { kata } = req.query;
    try {
      let dataEncrypt = {
				asli: kata,
				hasil: encrypt(kata)
			}

			// logger.info(JSON.stringify({ message: dataEncrypt, level: 'info', timestamp: new Date() }), {route: '/settings/encryptPass'});
			return OK(res, dataEncrypt);
    } catch (err) {
			// logger.error(JSON.stringify({ message: err.message, level: 'error', timestamp: new Date() }), {route: '/settings/encryptPass'});
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getDecrypt () {
  return async (req, res, next) => {
		let { kata } = req.query;
    try {
      let dataDecrypt = {
				asli: kata,
				hasil: decrypt(kata)
			}
			return OK(res, dataDecrypt);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getMenu (models) {
  return async (req, res, next) => {
		let { pilihan, kategori, page = 1, limit = 10, keyword } = req.query
		let where = {}
		let order = []
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined
			order = [
				['kategori', 'DESC'],
				['menuSequence', 'ASC']
			]

			if(pilihan == 'ALL') {
				if(kategori) {
					where.kategori = kategori
				}	

				const dataMenu = await models.Menu.findAll({
					where,
					order,
				});

				return OK(res, dataMenu);
			}

			const whereKey = keyword ? {
				[Op.or]: [
					{ menuText : { [Op.like]: `%${keyword}%` }},
					{ menuRoute : { [Op.like]: `%${keyword}%` }},
					{ kategori : { [Op.like]: `%${keyword}%` }},
				]
			} : kategori ? { kategori: kategori } : {}

			where = whereKey

      const { count, rows: dataMenu } = await models.Menu.findAndCountAll({
				where,
				order,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const responseData = buildMysqlResponseWithPagination(
				dataMenu,
				{ limit, page, total: count }
			)

			return OK(res, responseData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function crudMenu (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
		let where = {}
    try {
			if(body.jenis == 'ADD'){
				where = { 
					statusAktif: true,
					[Op.or]: [
						// { 
						// 	[Op.and]: [
						// 		{ kategori: body.kategori },
						// 		{ menuRoute: body.menu_route },
						// 	]
						// },
						{ 
							[Op.and]: [
								{ menuRoute: body.menu_route },
								{ menuText: body.menu_text }
							]
						},
					]
				}
				const {count, rows} = await models.Menu.findAndCountAll({where});
				if(count) return NOT_FOUND(res, 'data sudah di gunakan !')
				let dataCek = await models.Menu.findOne({where: {kategori: body.kategori}, limit: 1, order: [['idMenu', 'DESC']]})
				let urutan = dataCek ? dataCek.menuSequence + 1 : 1
				kirimdata = {
					kategori: body.kategori,
					menuRoute: body.menu_route,
					menuText: body.menu_text,
					menuIcon: body.menu_icon,
					menuSequence: urutan,
					statusAktif: 1,
				}
				await models.Menu.create(kirimdata)
			}else if(body.jenis == 'EDIT'){
				if(await models.Menu.findOne({
					where: {
						[Op.and]: [
							{ menuRoute: body.menu_route },
							{ menuText: body.menu_text }
						],
						[Op.not]: [
							{idMenu: body.id_menu}
						]
					}
				})) return NOT_FOUND(res, 'Menu Route atau Menu Text sudah di gunakan !')
				kirimdata = {
					kategori: body.kategori,
					menuRoute: body.menu_route,
					menuText: body.menu_text,
					menuIcon: body.menu_icon,
					statusAktif: 1,
				}
				await models.Menu.update(kirimdata, { where: { idMenu: body.id_menu } })
			}else if(body.jenis == 'DELETE'){
				kirimdata = {
					statusAktif: 0
				}
				await models.Menu.update(kirimdata, { where: { idMenu: body.id_menu } })	
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdata = { 
					statusAktif: body.status_aktif 
				}
				await models.Menu.update(kirimdata, { where: { idMenu: body.id_menu } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getRole (models) {
  return async (req, res, next) => {
		let { pilihan, sort, page = 1, limit = 10, keyword } = req.query
    let where = {}
		let order = []
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined
			order = [
				['idRole', sort ? sort : 'ASC'],
			]

			if(pilihan == 'ALL') {
				const dataRole = await models.RoleAdmin.findAll({
					order,
				});

				return OK(res, dataRole);
			}

			const whereKey = keyword ? {
				[Op.or]: [
					{ namaRole : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			where = whereKey

			const { count, rows: dataRole } = await models.RoleAdmin.findAndCountAll({
				where,
				order,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const responseData = buildMysqlResponseWithPagination(
				dataRole,
				{ limit, page, total: count }
			)

			return OK(res, responseData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function crudRole (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
		let where = {}
    try {
			if(body.jenis == 'ADD'){
				where = { 
					statusRole: true,
					namaRole: body.nama_role
				}
				const {count, rows} = await models.RoleAdmin.findAndCountAll({where});
				if(count) return NOT_FOUND(res, 'data sudah di gunakan !')
				kirimdata = {
					namaRole: body.nama_role,
					statusRole: 1,
				}
				let kirim = await models.RoleAdmin.create(kirimdata)
				if(kirim){
					let data = await models.RoleAdmin.findOne({where: {namaRole: body.nama_role}})
					let sendData = {
						idRole: data.idRole,
						menu: '',
					}
					await models.RoleMenu.create(sendData)
				}
			}else if(body.jenis == 'EDIT'){
				if(await models.RoleAdmin.findOne({where: {namaRole: body.nama_role, [Op.not]: [{idRole: body.id_role}]}})) return NOT_FOUND(res, 'Nama Role sudah di gunakan !')
				kirimdata = {
					namaRole: body.nama_role,
					statusRole: 1,
				}
				await models.RoleAdmin.update(kirimdata, { where: { idRole: body.id_role } })
			}else if(body.jenis == 'DELETE'){
				kirimdata = {
					statusRole: 0
				}
				await models.RoleAdmin.update(kirimdata, { where: { idRole: body.id_role } })	
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdata = { 
					statusRole: body.status_role 
				}
				await models.RoleAdmin.update(kirimdata, { where: { idRole: body.id_role } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getSequenceMenu (models) {
  return async (req, res, next) => {
    try {
      const dataMenu = await models.Menu.findAll({
				order: [
					['kategori', 'DESC'],
					['menuSequence', 'ASC']
				],
			});

			return OK(res, {
				Menu: dataMenu.filter(str => { return str.kategori === 'menu' }),
				SubMenu: dataMenu.filter(str => { return str.kategori === 'submenu' })
			});
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function crudSequenceMenu (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
    try {
			const { Menu } = body
			await Menu.map(async (val, i) => {
				await models.Menu.update({ menuSequence: i + 1 }, { where: { idMenu: val.idMenu } })
			})
			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getRoleMenu (models) {
  return async (req, res, next) => {
    let { id_role, page = 1, limit = 10, keyword } = req.query
		let where = {}
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ '$Role.nama_role$' : { [Op.like]: `%${keyword}%` }},
				]
			} : id_role ? { idRole: id_role } : {}

			where = whereKey

      const { count, rows: dataRoleMenu } = await models.RoleMenu.findAndCountAll({
				where,
				include: [
					{ 
						model: models.RoleAdmin,
						attributes: ['namaRole'],
						where: { statusRole: true }
					}
				],
				limit: parseInt(limit),
				offset: OFFSET,
			});
			let dataKumpul = []
			await dataRoleMenu.map(val => {
				let obj = {
					idRoleMenu: val.dataValues.idRoleMenu,
					idRole: val.dataValues.idRole,
					namaRole: val.dataValues.RoleAdmin.namaRole
				}
				let objectBaru = Object.assign(obj, {
					menu: val.dataValues.menu ? JSON.parse([val.dataValues.menu]) : []
				});
				return dataKumpul.push(objectBaru)
			})
			
			let result = await Promise.all(dataKumpul.map(async value => {
				let kumpul = await Promise.all(value.menu.map(async val => {
					let kumpulsub = await Promise.all(val.subMenu.map(async val2 => {
						const dataMenu = await models.Menu.findOne({
							where: { idMenu: val2.idMenu }
						});
						return dataMenu
					}))
					const dataMenu = await models.Menu.findOne({
						where: { idMenu: val.idMenu }
					});
					let objectBaru = Object.assign(val, {
						menuRoute: dataMenu.menuRoute,
						menuText: dataMenu.menuText,
						menuIcon: dataMenu.menuIcon,
						menuSequence: dataMenu.menuSequence,
						statusAktif: dataMenu.statusAktif,
						kondisi: val.kondisi, 
						subMenu: kumpulsub
					});
					return objectBaru
				}))
				let objectBaru = Object.assign(value, { menu: kumpul.filter(value => value.statusAktif) });
				return objectBaru
			}))

			const responseData = buildMysqlResponseWithPagination(
				result,
				{ limit, page, total: count }
			)

			return OK(res, responseData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function crudRoleMenu (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
    try {
			kirimdata = {
				idRole: body.id_role,
				menu: JSON.stringify(body.menu),
			}
			await models.RoleMenu.update(kirimdata, { where: { idRoleMenu: body.id_role_menu } })
			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getCountNotifikasi (models) {
	return async (req, res, next) => {
    try {
			const { userID } = req.JWTDecoded
			const notif = await models.TemporaryData.findAll({
				where: { statusExecute: 'Menunggu Persetujuan Permohonan' },
				order: [['createdAt','DESC']],
			});

			const result = notif.reduce((memo, notifikasi) => {
				const tmp = memo
				const { idAdmin } = notifikasi;
				if(_.includes(idAdmin, userID)) tmp.notif += 1
				return tmp
			}, {
				notif: 0,
			})

			const response = [
				{
					kode: '1',
					text: 'All Notification',
					count: result.notif,
				},
			]

			return OK(res, response);
	  } catch (err) {
			return NOT_FOUND(res, err.message)
	  }
	}  
}

function getKategoriNotifikasi (models) {
	return async (req, res, next) => {
    try {
			const { userID } = req.JWTDecoded
			const notif = await models.TemporaryData.findAll({
				where: { statusExecute: 'Menunggu Persetujuan Permohonan' },
				order: [['createdAt','DESC']],
			});

			const result = notif.reduce((memo, notifikasi) => {
				const tmp = memo
				const { idAdmin, jenis } = notifikasi;
				if(_.includes(idAdmin, userID)) {
					if(jenis === 'Update') tmp.ubah += 1
					if(jenis === 'Delete') tmp.hapus += 1
				}
				tmp.all += 1
				return tmp
			}, {
				all: 0,
				ubah: 0,
				hapus: 0,
			})

			const response = [
				{
					kode: '1',
					text: 'All Notification',
					count: result.all,
				},
				{
					kode: '2',
					text: 'Update Data',
					count: result.ubah,
				},
				{
					kode: '3',
					text: 'Delete Data',
					count: result.hapus,
				},
			]

			return OK(res, response);
	  } catch (err) {
			return NOT_FOUND(res, err.message)
	  }
	}  
}

function getNotifikasi (models) {
	return async (req, res, next) => {
	  let { page = 1, limit = 5, kategori } = req.query
		let where = {}
    try {
			const { userID } = req.JWTDecoded
			const type = kategori === '1' ? ['Update', 'Delete'] : kategori === '2' ? ['Update'] : ['Delete']
			const offset = limit * (page - 1)
			const { count, rows: datanotifikasi } = await models.TemporaryData.findAndCountAll({
				where: { jenis: type },
				order: [['createdAt','DESC']],
				limit: parseInt(limit, 10),
				offset,
			});

			// return OK(res, datanotifikasi);

			const records = await Promise.all(datanotifikasi.map(async val => {
				let id_admin = JSON.parse(val.dataValues.idAdmin);
				if(_.includes(id_admin, userID)) {
					const dataUserTujuan = await models.Admin.findOne({ where: { idAdmin: userID } })
					const dataUserReq = await models.Admin.findOne({ where: { idAdmin: val.createBy } })
					let pesan = JSON.parse(val.dataValues.dataTemporary)

					return {
						...val.dataValues,
						idAdmin: userID,
						pesan: {
							title: pesan.title,
							message: pesan.message,
							payload: JSON.stringify(pesan.payload),
							reason: pesan.reason,
						},
						tujuan: dataUserTujuan.nama,
						request: dataUserReq.nama,
						createdAt: convertDateTime(val.dataValues.createdAt),
					}
				}
			}))

			const arrangeResponse = () => {
				const totalPage = Math.ceil(count / limit)
				const hasNext = totalPage > parseInt(page, 10)
				const pageSummary = { limit: Number(limit), page: Number(page), hasNext, lastID: '', total: count, totalPage }

				if(count > 0){
					pageSummary.lastID = datanotifikasi[datanotifikasi.length - 1].idNotifikasi
					return { records, pageSummary }
				}
				return { records: [], pageSummary }
			}

			return OK(res, arrangeResponse());
	  } catch (err) {
			return NOT_FOUND(res, err.message)
	  }
	}  
}

function crudNotifikasi (models) {
	return async (req, res, next) => {
	  let body = { ...req.body }
    try {
			const { userID } = req.JWTDecoded
			if(body.jenis === 'ISREAD'){
				let payload = {
					isRead: 1,
				}
				await models.TemporaryData.update(payload, { where: { idTemporaryData: body.idTemporaryData } })
			}else if(body.jenis === 'ISREADALL'){
				const type = body.kategori === '1' ? ['Update', 'Delete'] : body.kategori === '2' ? ['Update'] : ['Delete']
				const datanotifikasi = await models.TemporaryData.findAll({
					where: { jenis: type, isRead: 0 },
					attributes: ["idTemporaryData", "jenis"],
				});
				await Promise.all(datanotifikasi.map(async val => {
					await models.TemporaryData.update({ isRead: 1 }, { where: { idTemporaryData: val.dataValues.idTemporaryData } })
				}))
			}else if(body.jenis === 'SETUJU'){
				const { kirimdataUser } = body.dataTemporary.payload
				await sequelizeInstance.transaction(async trx => {
					if(jenis === 'Delete') {
						await models.Iuran.destroy({ where: { idBiodata: kirimdataUser.idBiodata } }, { transaction: trx });
						await models.Biodata.destroy({ where: { idBiodata: kirimdataUser.idBiodata } }, { transaction: trx });
					}else if(jenis === 'Update') {
						await models.TemporaryData.update({ statusExecute: body.statusExecute }, { where: { idTemporaryData: body.idTemporaryData } }, { transaction: trx })
						await models.Anak.destroy({ where: { idBiodata: kirimdataUser.idBiodata } }, { transaction: trx });
						await models.Biodata.update(kirimdataUser, { where: { idBiodata: kirimdataUser.idBiodata } }, { transaction: trx })
						await models.Anak.bulkCreate(data.payload.kirimdataAnak, { transaction: trx })
					}
				})
			}else if(body.jenis === 'TIDAKSETUJU'){
				const { kirimdataUser } = body.dataTemporary.payload
				let kirimdata = {
					statusBiodata: 1,
					deleteBy: null,
				}
				await models.Biodata.update(kirimdata, { where: { idBiodata: kirimdataUser.idBiodata } })
				await models.TemporaryData.update({ statusExecute: body.statusExecute }, { where: { idTemporaryData: body.idTemporaryData } })
			}
			// else if(body.jenis === 'CREATE'){
			// 	let payload = {
			// 		idNotifikasi: await createKSUID(),
			// 		idUser: body.idUser,
			// 		type: body.type,
			// 		judul: body.judul,
			// 		pesan: JSON.stringify(body.pesan),
			// 		params: body.params !== null ? JSON.stringify(body.params) : null,
			// 		dikirim: body.dikirim,
			// 		createBy: body.createBy,
			// 	}
			// 	await models.TemporaryData.create(payload)
			// }else if(body.jenis === 'BROADCAST'){
			// 	let payload = []
			// 	await Promise.all(body.idUser.map(async idUser => {
			// 		payload.push({
			// 			idNotifikasi: await createKSUID(),
			// 			idUser: idUser,
			// 			type: body.type,
			// 			judul: body.judul,
			// 			pesan: JSON.stringify(body.pesan),
			// 			params: body.params !== null ? JSON.stringify(body.params) : null,
			// 			dikirim: body.dikirim,
			// 			tautan: JSON.stringify(body.tautan),
			// 			createBy: body.createBy,
			// 	})
			// 	}))
			// 	// console.log(payload);
			// 	await models.TemporaryData.bulkCreate(payload)
			// }else if(body.jenis === 'DELETEBROADCAST'){
			// 	await models.TemporaryData.destroy({ where: { idTemporaryData: body.idTemporaryData } })
			// }
			return OK(res)
	  } catch (err) {
			return NOT_FOUND(res, err.message)
	  }
	}  
}

function getCMSSetting (models) {
  return async (req, res, next) => {
    try {
			const dataCMS = await models.CMSSetting.findAll();

			const data = {}
			dataCMS.forEach(str => {
				let eva = JSON.parse(str.setting)
				if(eva.label){
					data[str.kode] = eva
				}else{
					// if(str.kode === 'logo') return data[str.kode] = `${BASE_URL}bahan/${eva.value}`
					data[str.kode] = eva.value
				}
			})
			return OK(res, data);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function crudCMSSetting (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
    try {
			const mappingData = []
			Object.entries(body).forEach(str => {
				if(str[1].label){
					mappingData.push({
						kode: str[0],
						setting: str[1],
					})
				}else{
					mappingData.push({
						kode: str[0],
						setting: { value: str[1] },
					})
				}
			})

			await [null, ...mappingData].reduce(async (memo, data) => {
				await memo;
				await models.CMSSetting.upsert(
					{ setting : JSON.stringify(data.setting), kode: data.kode },
					{ where: { kode: data.kode } }
				)
			})
			return OK(res, mappingData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getKomisarisWilayah (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 10, sort = '', keyword } = req.query
		let where = {}
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ kodeKomisarisWilayah : { [Op.like]: `%${keyword}%` }},
					{ namaKomisaris : { [Op.like]: `%${keyword}%` }},
					{ '$WilayahPanjaitan.label$' : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const mappingSortField = [
				'namaKomisaris',
				['wilayah', sequelize.literal('`WilayahPanjaitan.label`')],
			]

			const orders = buildOrderQuery(sort, mappingSortField)
			
			if(orders.length === 0){
				orders.push(['kodeWilayah', 'ASC'], ['kodeKomisarisWilayah', 'ASC'])
			}

			where = whereKey

      const { count, rows: dataKomisarisWilayah } = await models.KomisarisWilayah.findAndCountAll({
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

			const getResult = await Promise.all(dataKomisarisWilayah.map(str => {
				return {
					idKomisaris: str.idKomisaris,
					kodeKomisarisWilayah: str.kodeKomisarisWilayah,
					kodeWilayah: str.kodeWilayah,
					namaWilayah: str.WilayahPanjaitan.label,
					namaKomisaris: str.namaKomisaris,
					daerah: str.daerah,
					statusKomisaris: str.statusKomisaris,
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

function crudKomisarisWilayah (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
		let where = {}
		let kode = ''
    try {
			let kirimdata
			if(body.jenis == 'ADD'){
				const data = await models.KomisarisWilayah.findOne({
					where: { kodeWilayah: body.kode_wilayah },
					attributes: ["kodeKomisarisWilayah"],
					order: [
						['kodeKomisarisWilayah', 'DESC'],
					],
					limit: 1,
				});
				if(body.kode_wilayah === '01') kode = 'JakPus.'; 
				else if(body.kode_wilayah === '02') kode = 'JakUt.'; 
				else if(body.kode_wilayah === '03') kode = 'JakBar.'; 
				else if(body.kode_wilayah === '04') kode = 'JakSelA.'; 
				else if(body.kode_wilayah === '05') kode = 'JakSelB.'; 
				else if(body.kode_wilayah === '06') kode = 'JakTimA.'; 
				else if(body.kode_wilayah === '07') kode = 'JakTimB.'; 
				else if(body.kode_wilayah === '08') kode = 'Bks.'; 
				else if(body.kode_wilayah === '09') kode = 'Tang.'; 
				else if(body.kode_wilayah === '10') kode = 'Dpk.'; 
				else if(body.kode_wilayah === '11') kode = 'BgrA.'; 
				else if(body.kode_wilayah === '12') kode = 'BgrB.'; 
				let text = data.kodeKomisarisWilayah.split('.')[1]

				where = {
					namaKomisaris : { [Op.like]: `%${body.nama_komisaris}%` }
				}

				const {count, rows} = await models.KomisarisWilayah.findAndCountAll({where});
				if(count) return NOT_FOUND(res, 'data sudah di gunakan !')
				kirimdata = {
					kodeKomisarisWilayah: `${kode}${(parseInt(text.substr(1))+1).toString().padStart(3, '0')}`,
					kodeWilayah: body.kode_wilayah,
					namaKomisaris: body.nama_komisaris,
					daerah: body.daerah,
				}
				await models.KomisarisWilayah.create(kirimdata)
			}else if(body.jenis == 'EDIT'){
				if(await models.KomisarisWilayah.findOne({where: {namaKomisaris: body.nama_komisaris, [Op.not]: [{idKomisaris: body.id_komisaris}]}})) return NOT_FOUND(res, 'Nama Komisaris sudah di gunakan !')
				kirimdata = {
					kodeWilayah: body.kode_wilayah,
					namaKomisaris: body.nama_komisaris,
					daerah: body.daerah,
				}
				await models.KomisarisWilayah.update(kirimdata, { where: { idKomisaris: body.id_komisaris } })
			}else if(body.jenis == 'DELETE'){
				await models.KomisarisWilayah.destroy(kirimdata, { where: { idKomisaris: body.id_komisaris } })	
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdata = { 
					statusKomisaris: body.status, 
				}
				await models.KomisarisWilayah.update(kirimdata, { where: { idKomisaris: body.id_komisaris } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}


function getWilayahPanjaitan (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 10, sort = '', keyword } = req.query
		let where = {}
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ kode : { [Op.like]: `%${keyword}%` }},
					{ label : { [Op.like]: `%${keyword}%` }},
					{ namaKetuaWilayah : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			const mappingSortField = ['label', 'namaKetuaWilayah']

			const orders = buildOrderQuery(sort, mappingSortField)
			
			if(orders.length === 0){
				orders.push(['kode', 'ASC'])
			}

			where = whereKey

      const { count, rows: dataWilayahPanjaitan } = await models.WilayahPanjaitan.findAndCountAll({
				where,
				order: orders,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const getResult = await Promise.all(dataWilayahPanjaitan.map(str => {
				return {
					id: str.id,
					kode: str.kode,
					label: str.label,
					namaKetuaWilayah: str.namaKetuaWilayah,
					statusWilayah: str.statusWilayah,
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

function crudWilayahPanjaitan (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
		let where = {}
		let kode = ''
    try {
			let kirimdata
			if(body.jenis == 'ADD'){
				const data = await models.WilayahPanjaitan.findOne({
					attributes: ["kode"],
					order: [
						['kode', 'DESC'],
					],
					limit: 1,
				});
				let kode;
				if(data) {
					let text = data.kode
					kode = `${(parseInt(text.substr(1))).toString().padStart(2, '0')}`
				}else{
					kode = `01`
				}
				kirimdata = {
					kode,
					label: body.label,
					namaKetuaWilayah: body.nama_ketua_wilayah,
				}
				await models.WilayahPanjaitan.create(kirimdata)
			}else if(body.jenis == 'EDIT'){
				if(await models.WilayahPanjaitan.findOne({where: {label: body.label, [Op.not]: [{id: body.id}]}})) return NOT_FOUND(res, 'Nama Wilayah sudah di gunakan !')
				kirimdata = {
					label: body.label,
					namaKetuaWilayah: body.nama_ketua_wilayah,
				}
				await models.WilayahPanjaitan.update(kirimdata, { where: { id: body.id } })
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdata = { 
					statusWilayah: body.status, 
				}
				await models.WilayahPanjaitan.update(kirimdata, { where: { id: body.id } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getBerkas (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 10, keyword } = req.query
    let where = {}
		let order = []
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined
			order = [
				['createdAt', 'DESC'],
			]

			const whereKey = keyword ? {
				[Op.or]: [
					{ title : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			where = whereKey

			const { count, rows: dataBerkas } = await models.Berkas.findAndCountAll({
				where,
				order,
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const responseData = buildMysqlResponseWithPagination(
				await dataBerkas.map(val => {
					return {
						...val.dataValues,
						file: `${BASE_URL}berkas/${val.dataValues.file}`
					}
				}),
				{ limit, page, total: count }
			)

			return OK(res, responseData);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function crudBerkas (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
		let where = {}
    try {
			if(body.jenis == 'STATUSRECORD'){
				kirimdata = { 
					statusAktif: body.statusAktif 
				}
				await models.Berkas.update(kirimdata, { where: { idBerkas: body.idBerkas } })
			}else if(body.jenis == 'DELETE'){
				await sequelizeInstance.transaction(async trx => {
					const dataBerkas = await models.Berkas.findOne({
						where: { idBerkas: body.idBerkas }
					});
					const { file } = dataBerkas.dataValues
					let path_file = path.join(__dirname, `../public/berkas/${file}`);
					fs.unlinkSync(path_file);
					await models.Berkas.destroy({ where: { idBerkas: body.idBerkas } }, { transaction: trx });
				})
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsMenu (models) {
  return async (req, res, next) => {
    let { id_role } = req.query
    try {
      const dataRoleMenu = await models.RoleMenu.findAll({ where: { idRole: id_role }});

			let dataKumpul = []
			await dataRoleMenu.map(val => {
				let objectBaru = Object.assign(val.dataValues, {
					menu: val.dataValues.menu ? JSON.parse([val.dataValues.menu]) : []
				});
				return dataKumpul.push(objectBaru)
			})
			
			let result = await Promise.all(dataKumpul.map(async value => {
				let kumpul = await Promise.all(value.menu.map(async val => {
					let kumpulsub = await Promise.all(val.subMenu.map(async val2 => {
						const dataMenu = await models.Menu.findOne({
							where: { idMenu: val2.idMenu }
						});
						return dataMenu
					}))
					const dataMenu = await models.Menu.findOne({
						where: { idMenu: val.idMenu }
					});
					let dataSubMenuOrderBy = _.orderBy(kumpulsub, 'menuSequence', 'asc')
					let objectBaru = {
						menuRoute: dataMenu.menuRoute,
						menuText: dataMenu.menuText,
						menuIcon: dataMenu.menuIcon,
						menuSequence: id_role === '4' ? dataMenu.menuSequence : dataMenu.menuSequence + 1,
						statusAktif: dataMenu.statusAktif,
						kondisi: val.kondisi,
						subMenu: dataSubMenuOrderBy.filter(value => value.statusAktif)
					};
					return objectBaru
				}))
				if(id_role !== '4'){
					kumpul.push({
						menuRoute: '/dashboard',
						menuText: 'Dashboard',
						menuIcon: 'mdi mdi-view-dashboard',
						menuSequence: 1,
						statusAktif: true,
						kondisi: false, 
						subMenu: []
					})
				}
				let dataMenuOrderBy = _.orderBy(kumpul, 'menuSequence', 'asc')
				let objectBaru = Object.assign(value, { menu: dataMenuOrderBy.filter(value => value.statusAktif) });
				return objectBaru
			}))

			return OK(res, result);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsAnak (models) {
  return async (req, res, next) => {
		let { uid } = req.query
		let where = {}
    try {
			const { userID, consumerType } = req.JWTDecoded
			
			console.log(userID, consumerType);
			if(consumerType === 3){
				where	= { idBiodata: userID }
			}else{
				where	= { idBiodata: uid }
			}

      const dataAnak = await models.Anak.findAll({ where });
			return OK(res, dataAnak);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsOmpu (models) {
  return async (req, res, next) => {
    try {
      const dataOmpu = await models.Ompu.findAll();
			return OK(res, dataOmpu);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsKomisarisWilayah (models) {
  return async (req, res, next) => {
    let { kodeWilayah } = req.query
		let where = {}
    try {
			if(kodeWilayah){
				where = { kodeWilayah }
			}
      const dataKomisarisWilayah = await models.KomisarisWilayah.findAll({
				where: { ...where, statusKomisaris: true },
				include: [
					{ 
						model: models.WilayahPanjaitan,
					}
				],
			});
			return OK(res, dataKomisarisWilayah.map(str => {
				return {
					idKomisaris: str.idKomisaris,
					kodeKomisarisWilayah: str.kodeKomisarisWilayah,
					kodeWilayah: str.kodeWilayah,
					namaWilayah: str.WilayahPanjaitan.label,
					namaKomisaris: str.namaKomisaris,
					daerah: str.daerah,
				}
			}));
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsWilayahPanjaitan (models) {
  return async (req, res, next) => {
    try {
      const dataWilayahPanjaitan = await models.WilayahPanjaitan.findAll();
			return OK(res, await dataWilayahPanjaitan.map(val => {
				return {
					...val.dataValues,
					lambang: `${BASE_URL}bahan/${val.dataValues.lambang}`
				}
			}));
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsWilayah (models) {
  return async (req, res, next) => {
		let { bagian, KodeWilayah } = req.query
		let jmlString = bagian == 'provinsi' ? 2 : bagian == 'kabkotaOnly' ? 5 : bagian == 'kecamatanOnly' ? 8 : bagian == 'kelurahanOnly' ? 13 : KodeWilayah.length
		let whereChar = (jmlString==2?5:(jmlString==5?8:13))
    let where = {}
		try {
			if(bagian == 'provinsi' || bagian == 'kabkotaOnly' || bagian == 'kecamatanOnly' || bagian == 'kelurahanOnly') {
				where = sequelize.where(sequelize.fn('char_length', sequelize.col('kode')), jmlString)
			}else{
				where = { 
					[Op.and]: [
						sequelize.where(sequelize.fn('char_length', sequelize.col('kode')), whereChar),
						{
							kode: {
								[Op.like]: `${KodeWilayah}%`
							}
						}
					]
				}
			}
			const dataWilayah = await models.Wilayah.findAll({
				where,
				// attributes: [['kode', 'value'], ['nama', 'text'], 'kodePos']
				attributes: ['kode', 'nama', 'kodePos'],
				order: [['kode', 'ASC']]
			});

			return OK(res, dataWilayah);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsWilayah2023 (models) {
  return async (req, res, next) => {
		let { bagian, KodeWilayah } = req.query
		let jmlString = bagian == 'provinsi' ? 2 : bagian == 'kabkotaOnly' ? 5 : bagian == 'kecamatanOnly' ? 8 : bagian == 'kelurahanOnly' ? 13 : KodeWilayah.length
		let whereChar = bagian === 'kabkota' || bagian === 'kecamatan' || bagian === 'kelurahan' ? (jmlString == 2 ? 5 : (jmlString == 5 ? 8 : 13)) : jmlString
    let where = {}
    let attributes = ['idLocation', [sequelize.fn('LEFT', sequelize.col('kode'), whereChar), 'kode']]
		try {
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
						wilayahResult.push(val);
					}
				})
			}else if(bagian === 'kabkota'){
				await dataWilayah.map(val => {
					if(KodeWilayah === '31'){
						if(val.kode !== '31.01') {
							wilayahResult.push(val);
						}
					}else if(KodeWilayah === '32'){
						if(val.kode === '32.01' || val.kode === '32.16' || val.kode === '32.71' || val.kode === '32.75' || val.kode === '32.76') {
							wilayahResult.push(val);
						}
					}else if(KodeWilayah === '36'){
						if(val.kode === '36.03' || val.kode === '36.71') {
							wilayahResult.push(val);
						}
					}
				})
			}else{
				wilayahResult = dataWilayah;
			}

			return OK(res, wilayahResult);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function optionsBerkas (models) {
  return async (req, res, next) => {
		const { kategori } = req.query
		let where = {}
    try {
			if(kategori === 'tautan') where = { statusAktif: true }
      const dataBerkas = await models.Berkas.findAll({ where });
			let extGBR = [], extFile = []
			await Promise.all(dataBerkas.map(val => {
				if(val.dataValues.type === 'Gambar'){
					extGBR.push({
						...val.dataValues,
						file: `${BASE_URL}berkas/${val.dataValues.file}`
					})
				}else if(val.dataValues.type === 'File'){
					extFile.push({
						...val.dataValues,
						file: `${BASE_URL}berkas/${val.dataValues.file}`
					})
				}
			}))

			if(extGBR.length && extFile.length){
				// return OK(res, [{header: 'Files'}, ...extFile, {divider: true}, {header: 'Images'}, ...extGBR]);
				return OK(res, [...extFile, ...extGBR]);
			}else if(extGBR.length && !extFile.length){
				// return OK(res, [{header: 'Images'}, ...extGBR]);
				return OK(res, [...extGBR]);
			}else if(!extGBR.length && extFile.length){
				// return OK(res, [{header: 'Files'}, ...extFile]);
				return OK(res, [...extFile]);
			}
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getUserBroadcast (models) {
	return async (req, res, next) => {
		const { kategori, kode } = req.query
    try {
			const { consumerType } = req.JWTDecoded
			const type = consumerType === 1 || consumerType === 2 || (consumerType === 3 && kode === '1') ? [3, 4] : consumerType === 3 ? 4 : 3
			if(kategori === 'USER'){
				const dataUser = await models.User.findAll({
					where: {
						consumerType: type,
						statusAktif: true,
					},
					include: [
						{ 
							model: models.UserDetail,
						},
					],
					order: [
						[models.UserDetail, 'kelas', 'ASC'],
						['nama', 'ASC'],
					],
				});
				let pushSiswa = [], pushGuru = []
				await Promise.all(dataUser.map(async val => {
					const group = val.consumerType === 3 ? 'Guru' : 'Siswa-Siswi'
					if(val.consumerType === 3){
						pushGuru.push({
							idUser: val.idUser,
							consumerType: val.consumerType,
							nama: val.nama,
							kelas: val.UserDetail.kelas,
							text: val.consumerType === 3 ? `${val.nama}` : `${val.nama} (${val.UserDetail.kelas})`,
							value: val.idUser,
							group,
							fotoProfil: val.UserDetail.fotoProfil ? `${BASE_URL}image/${val.UserDetail.fotoProfil}` : `${BASE_URL}bahan/user.png`,
						})
					}
					if(val.consumerType === 4){
						pushSiswa.push({
							idUser: val.idUser,
							consumerType: val.consumerType,
							nama: val.nama,
							kelas: val.UserDetail.kelas,
							text: val.consumerType === 3 ? `${val.nama}` : `${val.nama} (${val.UserDetail.kelas})`,
							value: val.idUser,
							group,
							fotoProfil: val.UserDetail.fotoProfil ? `${BASE_URL}image/${val.UserDetail.fotoProfil}` : `${BASE_URL}bahan/user.png`,
						})
					}
				}))
				if(pushSiswa.length && pushGuru.length){
					return OK(res, [{ type: 'subheader', title: 'Guru' }, {divider: true}, ...pushGuru, {divider: true}, {type: 'subheader', title: 'Siswa-Siswi'}, {divider: true}, ...pushSiswa]);
					// return OK(res, [...pushGuru, ...pushSiswa]);
				}else if(pushSiswa.length && !pushGuru.length){
					return OK(res, [{type: 'subheader', title: 'Siswa-Siswi'}, {divider: true}, ...pushSiswa]);
					// return OK(res, [...pushSiswa]);
				}else if(!pushSiswa.length && pushGuru.length){
					return OK(res, [{type: 'subheader', title: 'Guru'}, {divider: true}, ...pushGuru]);
					// return OK(res, [...pushGuru]);
				}
			}else if(kategori === 'KELAS'){
				const dataKelas = await models.Kelas.findAll({
					where: {
						status: true
					},
				});

				const dataUser = await Promise.all(dataKelas.map(async val => {
					const user = await models.User.findAll({
						where: {
							consumerType: 4,
							statusAktif: true,
						},
						include: [
							{ 
								where: {
									kelas: val.kelas,
								},
								model: models.UserDetail,
							},
						],
						order: [
							['nama', 'ASC'],
						],
					});
					const result = []
					await Promise.all(user.map(async val => {
						result.push(val.idUser)
						return result
					}))
					return {
						text: val.kelas,
						value: val.kelas,
						listUser: result,
					}
				}))
				return OK(res, dataUser);
			}
	  } catch (err) {
			return NOT_FOUND(res, err.message)
	  }
	}  
}

// tabel m_wilayah
function getWilayah (models) {
	return async (req, res, next) => {
		let { page = 1, limit = 20, keyword, bagian } = req.query
		let jmlString = bagian == 'provinsiOnly' ? 2 : bagian == 'kabkotaOnly' ? 5 : bagian == 'kecamatanOnly' ? 8 : 13
    let where = {}
		try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined
			let whereChar = sequelize.where(sequelize.fn('char_length', sequelize.col('kode')), jmlString)
			const whereKey = keyword ? {
				[Op.or]: [
					{ nama : { [Op.like]: `%${keyword}%` }},
					{ kode : { [Op.like]: `${keyword}%` }},
				]
			} : {}

			where = { ...whereKey, whereChar }

			const { count, rows: dataWilayah } = await models.Wilayah.findAndCountAll({
				where,
				order: [['kode', 'ASC']],
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const getResult = await Promise.all(dataWilayah.map(async val => {
				const split = val.kode.split('.')
				if(bagian === 'provinsiOnly'){
					const countWilayah = await _wilayahCount({ models, kode: val.kode })
					return {
						idLocation: val.idLocation,
						kode: val.kode,
						provinsi: val.nama,
						countWilayah,
					}
				}else if(bagian === 'kabkotaOnly'){
					const provinsi = await _wilayahOption({ models, kode: split[0] })
					const countWilayah = await _wilayahCount({ models, kode: val.kode })
					return {
						idLocation: val.idLocation,
						kode: val.kode,
						provinsi: provinsi ? provinsi.nama : '',
						kabkota: val.nama,
						kategori: val.kategori,
						countWilayah,
					}
				}else if(bagian === 'kecamatanOnly'){
					const provinsi = await _wilayahOption({ models, kode: split[0] })
					const kabkota = await _wilayahOption({ models, kode: `${split[0]}.${split[1]}` })
					const countWilayah = await _wilayahCount({ models, kode: val.kode })
					return {
						idLocation: val.idLocation,
						kode: val.kode,
						provinsi: provinsi ? provinsi.nama : '',
						kabkota: kabkota ? kabkota.nama : '',
						kecamatan: val.nama,
						countWilayah,
					}
				}else if(bagian === 'kelurahanOnly'){
					const provinsi = await _wilayahOption({ models, kode: split[0] })
					const kabkota = await _wilayahOption({ models, kode: `${split[0]}.${split[1]}` })
					const kecamatan = await _wilayahOption({ models, kode: `${split[0]}.${split[1]}.${split[2]}` })
					return {
						idLocation: val.idLocation,
						kode: val.kode,
						provinsi: provinsi ? provinsi.nama : '',
						kabkota: kabkota ? kabkota.nama : '',
						kecamatan: kecamatan ? kecamatan.nama : '',
						kelurahan: val.nama,
						kategori: val.kategori,
						kodePos: val.kodePos,
					}
				}
			}))

			const responseData = buildMysqlResponseWithPagination(
				getResult,
				{ limit, page, total: count }
			)

			return OK(res, responseData);
		} catch (err) {
			console.log(err);
			return NOT_FOUND(res, err.message)
		}
	}
}

function getWilayah2023 (models) {
	return async (req, res, next) => {
		let { page = 1, limit = 20, keyword } = req.query
    let where = {}
		try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined
			const whereKey = keyword ? {
				[Op.or]: [
					{ kode : { [Op.like]: `${keyword}%` }},
					{ namaProv : { [Op.like]: `%${keyword}%` }},
					{ namaKabKota : { [Op.like]: `%${keyword}%` }},
					{ namaKec : { [Op.like]: `%${keyword}%` }},
					{ namaKelDes : { [Op.like]: `%${keyword}%` }},
					{ kodePos : { [Op.like]: `${keyword}%` }},
				]
			} : {}
			
			const { count, rows: dataWilayah } = await models.Wilayah2023.findAndCountAll({
				where: whereKey,
				order: [['kode', 'ASC']],
				limit: parseInt(limit),
				offset: OFFSET,
			});

			const getResult = await Promise.all(dataWilayah.map(async val => {
				const split = val.kode.split('.')
				return {
					idLocation: val.idLocation,
					kode: val.kode,
					kodeProv: `${split[0]} - ${val.namaProv}`,
					namaProv: `Provinsi ${val.namaProv}`,
					kodeKabKota: `${split[0]}.${split[1]} - ${val.namaKabKota}`,
					namaKabKota: `${val.jenisKabKota} ${val.namaKabKota}`,
					kodeKec: `${split[0]}.${split[1]}.${split[2]} - ${val.namaKec}`,
					namaKec: `Kecamatan ${val.namaKec}`,
					namaKelDes: val.namaKelDes,
					kodePos: val.kodePos,
					jenisKabKota: val.jenisKabKota,
					jenisKelDes: val.jenisKelDes,
					statusAktif: val.statusAktif,
				}
			}))

			let countProvinsi = await models.Wilayah2023.count({ where: { statusAktif: true }, group: ['namaProv'] })
			let countKota = await models.Wilayah2023.count({ where: { jenisKabKota: 'Kota', statusAktif: true }, group: [sequelize.fn('LEFT', sequelize.col('kode'), 5)] })
			let countKabupaten = await models.Wilayah2023.count({ where: { jenisKabKota: 'Kabupaten', statusAktif: true }, group: [sequelize.fn('LEFT', sequelize.col('kode'), 5)] })
			let countKecamatan = await models.Wilayah2023.count({ where: { statusAktif: true }, group: [sequelize.fn('LEFT', sequelize.col('kode'), 8)] })
			let countKelurahan = await models.Wilayah2023.count({ where: { jenisKelDes: 'Kelurahan', statusAktif: true } })
			let countDesa = await models.Wilayah2023.count({ where: { jenisKelDes: 'Desa', statusAktif: true } })

			const responseData = buildMysqlResponseWithPagination(
				getResult,
				{ limit, page, total: count }
			)

			return OK(res, { ...responseData, countWilayah: {
				provinsi: countProvinsi.length,
				kota: countKota.length,
				kabupaten: countKabupaten.length,
				kabkota: countKota.length + countKabupaten.length,
				kecamatan: countKecamatan.length,
				kelurahan: countKelurahan,
				desa: countDesa,
				keldes: countKelurahan + countDesa
			} });
		} catch (err) {
			console.log(err);
			return NOT_FOUND(res, err.message)
		}
	}
}

function crudWilayah (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
		let where = {}
    try {
			if(body.jenis == 'ADD'){
				kirimdata = {
					kode: body.kode,
					nama: body.nama,
					kategori: body.kategori,
					kodePos: body.kodePos,
				}
				await models.Wilayah.create(kirimdata)
			}else if(body.jenis == 'EDIT'){
				if(body.enabled){
					kirimdata = {
						kode: body.kode,
						nama: body.nama,
						kategori: body.kategori,
						kodePos: body.kodePos,
					}
					await models.Wilayah.update(kirimdata, { where: { idLocation: body.idLocation } })
				}else if(!body.enabled && body.bagian === 'kabkotaOnly'){
					await sequelizeInstance.transaction(async trx => {
						let whereCharKec = sequelize.where(sequelize.fn('char_length', sequelize.col('kode')), 8)
						let whereCharKel = sequelize.where(sequelize.fn('char_length', sequelize.col('kode')), 13)
						const dataWilayahKec = await models.Wilayah.findAll({
							where: { ...{ kode : { [Op.like]: `${body.kodeTemp}%` }}, whereCharKec },
							order: [['kode', 'ASC']],
						});
						await dataWilayahKec.map(async x => {
							let splitkode = x.kode.split('.')
							await models.Wilayah.update({kode: `${body.kode}.${splitkode[2]}`}, { where: { idLocation: x.idLocation } }, { transaction: trx })
						})
						const dataWilayahKel = await models.Wilayah.findAll({
							where: { ...{ kode : { [Op.like]: `${body.kodeTemp}%` }}, whereCharKel },
							order: [['kode', 'ASC']],
						});
						await dataWilayahKel.map(async x => {
							let splitkode = x.kode.split('.')
							await models.Wilayah.update({kode: `${body.kode}.${splitkode[2]}.${splitkode[3]}`}, { where: { idLocation: x.idLocation } }, { transaction: trx })
						})
						kirimdata = {
							kode: body.kode,
							nama: body.nama,
							kategori: body.kategori,
							kodePos: body.kodePos,
						}
						await models.Wilayah.update(kirimdata, { where: { idLocation: body.idLocation } }, { transaction: trx })
					})
				}else if(!body.enabled && body.bagian === 'kecamatanOnly'){
					await sequelizeInstance.transaction(async trx => {
						let whereCharKel = sequelize.where(sequelize.fn('char_length', sequelize.col('kode')), 13)
						const dataWilayahKel = await models.Wilayah.findAll({
							where: { ...{ kode : { [Op.like]: `${body.kodeTemp}%` }}, whereCharKel },
							order: [['kode', 'ASC']],
						});
						await dataWilayahKel.map(async x => {
							let splitkode = x.kode.split('.')
							await models.Wilayah.update({kode: `${body.kode}.${splitkode[3]}`}, { where: { idLocation: x.idLocation } }, { transaction: trx })
						})
						kirimdata = {
							kode: body.kode,
							nama: body.nama,
							kategori: body.kategori,
							kodePos: body.kodePos,
						}
						await models.Wilayah.update(kirimdata, { where: { idLocation: body.idLocation } }, { transaction: trx })
					})
				}else if(!body.enabled && body.bagian === 'kelurahanOnly'){
					kirimdata = {
						kode: body.kode,
						nama: body.nama,
						kategori: body.kategori,
						kodePos: body.kodePos,
					}
					await models.Wilayah.update(kirimdata, { where: { idLocation: body.idLocation } })
				}
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			console.log(err);
			return NOT_FOUND(res, err.message)
    }
  }  
}

function crudWilayah2023 (models) {
  return async (req, res, next) => {
		let body = { ...req.body }
    try {
			if(body.jenis == 'ADD'){
				kirimdata = {
					kode: body.kode,
					namaProv: body.namaProv,
					namaKabKota: body.namaKabKota,
					namaKec: body.namaKec,
					namaKelDes: body.namaKelDes,
					kodePos: body.kodePos,
					jenisKabKota: body.jenisKabKota,
					jenisKelDes: body.jenisKelDes,
					statusAktif: 1,
				}
				await models.Wilayah2023.create(kirimdata)
			}else if(body.jenis == 'EDIT'){
				kirimdata = {
					kode: body.kode,
					namaProv: body.namaProv,
					namaKabKota: body.namaKabKota,
					namaKec: body.namaKec,
					namaKelDes: body.namaKelDes,
					kodePos: body.kodePos,
					jenisKabKota: body.jenisKabKota,
					jenisKelDes: body.jenisKelDes,
				}
				await models.Wilayah2023.update(kirimdata, { where: { idLocation: body.idLocation } })
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdata = {
					statusAktif: body.statusAktif,
				}
				await models.Wilayah2023.update(kirimdata, { where: { idLocation: body.idLocation } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res, kirimdata);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function testing (models) {
	return async (req, res, next) => {
		try {
			let countProvinsi = await models.Wilayah2023.count({ group: ['namaProv'] })
			let countKota = await models.Wilayah2023.count({ where: { jenisKabKota: 'Kota' }, group: [sequelize.fn('LEFT', sequelize.col('kode'), 5)] })
			let countKabupaten = await models.Wilayah2023.count({ where: { jenisKabKota: 'Kabupaten' }, group: [sequelize.fn('LEFT', sequelize.col('kode'), 5)] })
			let countKecamatan = await models.Wilayah2023.count({ group: [sequelize.fn('LEFT', sequelize.col('kode'), 8)] })
			let countKelurahan = await models.Wilayah2023.count({ where: { jenisKelDes: 'Kelurahan' } })
			let countDesa = await models.Wilayah2023.count({ where: { jenisKelDes: 'Desa' } })
			return OK(res, {
				provinsi: countProvinsi.length,
				kota: countKota.length,
				kabupaten: countKabupaten.length,
				kabkota: countKota.length + countKabupaten.length,
				kecamatan: countKecamatan.length,
				kelurahan: countKelurahan,
				desa: countDesa,
				keldes: countKelurahan + countDesa
			})
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

module.exports = {
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
}