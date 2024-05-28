const {
	response,
	OK,
	NOT_FOUND,
	NO_CONTENT,
	UNAUTHORIZED
} = require('@triyogagp/backend-common/utils/response.utils');
const {
	encrypt,
	decrypt,
	shuffleArray,
	getRandomArray,
	makeRandom,
	dateconvert,
	convertDate,
	convertDate3,
	convertDateTime2,
	splitTime,
	createKSUID,
	pembilang,
	makeRandomAngka,
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
				let obj = {
					kode: val.kode,
					label: val.label,
					jml: count,
				}
				return obj;
			}))
			return OK(res, consumerType === 1 || consumerType === 2 ? responseData : responseData.filter(val => val.kode === wilayah));
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function getAdmin (models) {
  return async (req, res, next) => {
		let { page = 1, limit = 20, keyword } = req.query
    let where = {}
    try {
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ nama : { [Op.like]: `%${keyword}%` }},
					{ username : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			where = whereKey

      const { count, rows: dataAdmin } = await models.Admin.findAndCountAll({
				where,
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
				include: [
					{ 
						model: models.RoleAdmin,
						attributes: ['namaRole'],
						where: { statusRole: true }
					},
				],
				order: [
					['createdAt', 'DESC'],
				],
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
			}else if(body.jenis == 'DELETE'){
				kirimdataUser = {
					statusAdmin: 0,
					deleteBy: userID,
					deletedAt: new Date(),
				}
				await models.Admin.update(kirimdataUser, { where: { idAdmin: body.idAdmin } })	
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
		let { page = 1, limit = 20, keyword } = req.query
    let where = {}
    try {
			const { consumerType, wilayah } = req.JWTDecoded
			const OFFSET = page > 0 ? (page - 1) * parseInt(limit) : undefined

			const whereKey = keyword ? {
				[Op.or]: [
					{ namaLengkap : { [Op.like]: `%${keyword}%` }},
					{ nik : { [Op.like]: `%${keyword}%` }},
					{ namaKetuaKomisaris : { [Op.like]: `%${keyword}%` }},
				]
			} : {}

			where = consumerType !== 3 ? { ...whereKey } : { ...whereKey, wilayah }

      const { count, rows: dataBiodata } = await models.Biodata.findAndCountAll({
				where,
				attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'updatedAt', 'deletedAt'] },
				order: [
					['createdAt', 'DESC'],
				],
				limit: parseInt(limit),
				offset: OFFSET,
			});

			// return OK(res, dataBiodata)
			const getResult = await Promise.all(dataBiodata.map(async val => {
				return {
					idBiodata: val.idBiodata,
					nik: val.nik,
					namaLengkap: val.namaLengkap,
					tempat: val.tempat,
					tanggalLahirSuami: val.tanggalLahirSuami,
					alamat: val.alamat,
					provinsi: val.provinsi,
					kabKota: val.kabKota,
					kecamatan: val.kecamatan,
					kelurahan: val.kelurahan,
					kodePos: val.kodePos,
					pekerjaanSuami: val.pekerjaanSuami,
					telp: val.telp,
					namaIstri: val.namaIstri,
					tanggalLahirIstri: val.tanggalLahirIstri,
					pekerjaanIstri: val.pekerjaanIstri,
					anak: await _anakOption({ models, idBiodata: val.idBiodata }),
					jabatanPengurus: val.jabatanPengurus,
					wilayah: await _wilayahpanjaitanOption({ models, kode: val.wilayah }),
					komisarisWilayah: val.komisarisWilayah,
					namaKetuaKomisaris: val.namaKetuaKomisaris,
					ompu: await _ompuOption({ models, kode: val.ompu }),
					generasi: val.generasi,
					fotoProfil: val.fotoProfil ? `${BASE_URL}image/${val.fotoProfil}` : `${BASE_URL}bahan/user.png`,
					statusSuami: val.statusSuami,
					statusIstri: val.statusIstri,
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
				tempat: dataBiodata.tempat,
				tanggalLahir: dataBiodata.tanggalLahir,
				alamat: dataBiodata.alamat,
				provinsi: dataBiodata.provinsi,
				kabKota: dataBiodata.kabKota,
				kecamatan: dataBiodata.kecamatan,
				kelurahan: dataBiodata.kelurahan,
				kodePos: dataBiodata.kodePos,
				pekerjaan: dataBiodata.pekerjaan ? await _pekerjaanOption({ models, kode: dataBiodata.pekerjaan }) : null,
				pekerjaanLainnya: dataBiodata.pekerjaan === '18' ? dataBiodata.pekerjaanLainnya : null,
				telp: dataBiodata.telp,
				namaIstri: dataBiodata.namaIstri,
				anak: await _anakOption({ models, idBiodata: dataBiodata.idBiodata }),
				pekerjaanIstri: dataBiodata.pekerjaanIstri ? await _pekerjaanOption({ models, kode: dataBiodata.pekerjaanIstri }) : null,
				pekerjaanIstriLainnya: dataBiodata.pekerjaanIstri === '18' ? dataBiodata.pekerjaanIstriLainnya : null,
				jabatanPengurus: dataBiodata.jabatanPengurus,
				wilayah: await _wilayahpanjaitanOption({ models, kode: dataBiodata.wilayah }),
				komisarisWilayah: dataBiodata.komisarisWilayah,
				namaKetuaKomisaris: dataBiodata.namaKetuaKomisaris,
				ompu: await _ompuOption({ models, kode: dataBiodata.ompu }),
				generasi: dataBiodata.generasi,
				fotoProfil: dataBiodata.fotoProfil ? `${BASE_URL}image/${dataBiodata.fotoProfil}` : `${BASE_URL}bahan/user.png`,
				statusMeninggal: dataBiodata.statusMeninggal,
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
			const { userID } = req.JWTDecoded
			let kirimdataUser, kirimdataAnak = [];
			if(body.jenis == 'ADD'){
				let tglSplit = body.tanggalLahir.split('-')
				const data = await models.Biodata.findOne({
					attributes: ["nik"],
					order: [
						['createdAt', 'DESC'],
					],
					limit: 1,
				});
				let text = data.nik.split('.')[3]
				kirimdataUser = {
					idBiodata: body.idBiodata,
					nik: `${body.wilayah}.${body.ompu}.${tglSplit[2]}${tglSplit[1]}${tglSplit[0]}.${(parseInt(text.substr(2))+1).toString().padStart(4, '0')}`,
					namaLengkap: body.namaLengkap,
					tempat: body.tempat,
					tanggalLahir: body.tanggalLahir,
					alamat: body.alamat,
					provinsi: body.provinsi,
					kabKota: body.kabKota,
					kecamatan: body.kecamatan,
					kelurahan: body.kelurahan,
					kodePos: body.kodePos,
					pekerjaan: body.pekerjaan,
					pekerjaanLainnya: body.pekerjaanLainnya,
					telp: body.telp,
					namaIstri: body.namaIstri,
					pekerjaanIstri: body.pekerjaanIstri,
					pekerjaanIstriLainnya: body.pekerjaanIstriLainnya,
					jabatanPengurus: body.jabatanPengurus,
					wilayah: body.wilayah,
					komisarisWilayah: body.komisarisWilayah,
					namaKetuaKomisaris: body.namaKetuaKomisaris,
					ompu: body.ompu,
					generasi: body.generasi,
					statusMeninggal: body.statusMeninggal,
					statusBiodata: 1,
					createBy: userID,
				}

				body.anak.map(val => {
					kirimdataAnak.push({
						idBiodata: body.idBiodata,
						namaAnak: val,
					})
				})


				await sequelizeInstance.transaction(async trx => {
					await models.Biodata.create(kirimdataUser, { transaction: trx })
					await models.Anak.bulkCreate(kirimdataAnak, { transaction: trx })
				})
			}else if(body.jenis == 'EDIT'){
				let tglSplit = body.tanggalLahir.split('-')
				const data = await models.Biodata.findOne({
					where: {
						idBiodata: body.idBiodata,
					},
					attributes: ["nik"],
					limit: 1,
				});
				let text = data.nik.split('.')[3]
				kirimdataUser = {
					idBiodata: body.idBiodata,
					nik: `${body.wilayah}.${body.ompu}.${tglSplit[2]}${tglSplit[1]}${tglSplit[0]}.${text}`,
					namaLengkap: body.namaLengkap,
					tempat: body.tempat,
					tanggalLahir: body.tanggalLahir,
					alamat: body.alamat,
					provinsi: body.provinsi,
					kabKota: body.kabKota,
					kecamatan: body.kecamatan,
					kelurahan: body.kelurahan,
					kodePos: body.kodePos,
					pekerjaan: body.pekerjaan,
					pekerjaanLainnya: body.pekerjaanLainnya,
					telp: body.telp,
					namaIstri: body.namaIstri,
					pekerjaanIstri: body.pekerjaanIstri,
					pekerjaanIstriLainnya: body.pekerjaanIstriLainnya,
					jabatanPengurus: body.jabatanPengurus,
					wilayah: body.wilayah,
					komisarisWilayah: body.komisarisWilayah,
					namaKetuaKomisaris: body.namaKetuaKomisaris,
					ompu: body.ompu,
					generasi: body.generasi,
					statusMeninggal: body.statusMeninggal,
					statusBiodata: 1,
					updateBy: userID,
				}

				body.anak.map(val => {
					kirimdataAnak.push({
						idBiodata: body.idBiodata,
						namaAnak: val,
					})
				})

				await sequelizeInstance.transaction(async trx => {
					await models.Anak.destroy({ where: { idBiodata: body.idBiodata } }, { transaction: trx });
					await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } }, { transaction: trx })
					await models.Anak.bulkCreate(kirimdataAnak, { transaction: trx })
				})
			}else if(body.jenis == 'DELETE'){
				kirimdataUser = {
					statusBiodata: 0,
					deleteBy: userID,
					deletedAt: new Date(),
				}
				await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } })	
			}else if(body.jenis == 'STATUSRECORD'){
				kirimdataUser = { 
					statusBiodata: body.kondisi, 
					updateBy: userID 
				}
				await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } })
			}else if(body.jenis == 'STATUSMENINGGAL'){
				kirimdataUser = { 
					statusMeninggal: body.statusMeninggal, 
					updateBy: userID 
				}
				await models.Biodata.update(kirimdataUser, { where: { idBiodata: body.idBiodata } })
			}else{
				return NOT_FOUND(res, 'terjadi kesalahan pada sistem !')
			}

			return OK(res);
    } catch (err) {
			return NOT_FOUND(res, err.message)
    }
  }  
}

function downloadTemplate (models) {
	return async (req, res, next) => {
		let { roleID } = req.params
	  try {
			let workbook = new excel.Workbook();
			if(roleID === '4'){
				let worksheet = workbook.addWorksheet("Data Siswa");
				let worksheetAgama = workbook.addWorksheet("Agama");
				let worksheetHobi = workbook.addWorksheet("Hobi");
				let worksheetCitaCita = workbook.addWorksheet("Cita - Cita");
				let worksheetJenjangSekolah = workbook.addWorksheet("Jenjang Sekolah");
				let worksheetStatusSekolah = workbook.addWorksheet("Status Sekolah");
				let worksheetStatusOrangTua = workbook.addWorksheet("Status Orang Tua");
				let worksheetPendidikan = workbook.addWorksheet("Pendidikan");
				let worksheetPekerjaan = workbook.addWorksheet("Pekerjaan");
				let worksheetStatusTempatTinggal = workbook.addWorksheet("Status Tempat Tinggal");
				let worksheetJarakRumah = workbook.addWorksheet("Jarak Rumah");
				let worksheetAlatTransportasi = workbook.addWorksheet("Alat Transportasi");
				let worksheetPenghasilan = workbook.addWorksheet("Penghasilan");

				//Data Siswa
				worksheet.columns = [
					{ header: "NAMA", key: "nama", width: 20 },
					{ header: "EMAIL", key: "email", width: 20 },
					{ header: "NIK SISWA", key: "nikSiswa", width: 20 },
					{ header: "NISN", key: "nomorInduk", width: 20 },
					{ header: "TANGGAL LAHIR", key: "tanggalLahir", width: 20 },
					{ header: "TEMPAT", key: "tempat", width: 20 },
					{ header: "JENIS KELAMIN", key: "jenisKelamin", width: 20 },
					{ header: "AGAMA", key: "agama", width: 20 },
					{ header: "ANAK KE", key: "anakKe", width: 20 },
					{ header: "JUMLAH SAUDARA", key: "jumlahSaudara", width: 20 },
					{ header: "HOBI", key: "hobi", width: 20 },
					{ header: "CITA-CITA", key: "citaCita", width: 20 },
					{ header: "JENJANG SEKOLAH", key: "jenjang", width: 20 },
					{ header: "NAMA SEKOLAH", key: "namaSekolah", width: 20 },
					{ header: "STATUS SEKOLAH", key: "statusSekolah", width: 20 },
					{ header: "NPSN", key: "npsn", width: 20 },
					{ header: "ALAMAT SEKOLAH", key: "alamatSekolah", width: 40 },
					{ header: "KABUPATEN / KOTA SEKOLAH SEBELUMNYA", key: "kabkotSekolah", width: 20 },
					{ header: "NOMOR KK", key: "noKK", width: 20 },
					{ header: "NAMA KEPALA KELUARGA", key: "namaKK", width: 20 },
					{ header: "NIK AYAH", key: "nikAyah", width: 20 },
					{ header: "NAMA AYAH", key: "namaAyah", width: 20 },
					{ header: "TAHUN AYAH", key: "tahunAyah", width: 20 },
					{ header: "STATUS AYAH", key: "statusAyah", width: 20 },
					{ header: "PENDIDIKAN AYAH", key: "pendidikanAyah", width: 20 },
					{ header: "PEKERJAAN AYAH", key: "pekerjaanAyah", width: 20 },
					{ header: "NO HANDPHONE AYAH", key: "telpAyah", width: 20 },
					{ header: "NIK IBU", key: "nikIbu", width: 20 },
					{ header: "NAMA IBU", key: "namaIbu", width: 20 },
					{ header: "TAHUN IBU", key: "tahunIbu", width: 20 },
					{ header: "STATUS IBU", key: "statusIbu", width: 20 },
					{ header: "PENDIDIKAN IBU", key: "pendidikanIbu", width: 20 },
					{ header: "PEKERJAAN IBU", key: "pekerjaanIbu", width: 20 },
					{ header: "NO HANDPHONE IBU", key: "telpIbu", width: 20 },
					{ header: "NIK WALI", key: "nikWali", width: 20 },
					{ header: "NAMA WALI", key: "namaWali", width: 20 },
					{ header: "TAHUN WALI", key: "tahunWali", width: 20 },
					{ header: "PENDIDIKAN WALI", key: "pendidikanWali", width: 20 },
					{ header: "PEKERJAAN WALI", key: "pekerjaanWali", width: 20 },
					{ header: "NO HANDPHONE WALI", key: "telpWali", width: 20 },
					{ header: "TELEPON", key: "telp", width: 20 },
					{ header: "ALAMAT", key: "alamat", width: 40 },
					{ header: "PROVINSI", key: "provinsi", width: 20 },
					{ header: "KABUPATEN / KOTA", key: "kabKota", width: 20 },
					{ header: "KECAMATAN", key: "kecamatan", width: 20 },
					{ header: "KELURAHAN", key: "kelurahan", width: 20 },
					{ header: "KODE POS", key: "kodePos", width: 20 },
					{ header: "PENGHASILAN", key: "penghasilan", width: 20 },
					{ header: "STATUS TEMPAT TINGGAL", key: "statusTempatTinggal", width: 20 },
					{ header: "JARAK RUMAH", key: "jarakRumah", width: 20 },
					{ header: "TRANSPORTASI", key: "transportasi", width: 20 },
				];
				const figureColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 ,19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];
				figureColumns.forEach((i) => {
					worksheet.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheet.addRows([{
					nama: 'tes', 
					email: 'tes@gmail.com', 
					nikSiswa: '123', 
					nomorInduk: '123', 
					tanggalLahir: new Date(),
					tempat: 'Bogor', 
					jenisKelamin: 'Laki - Laki', 
					agama: 1, 
					anakKe: '1', 
					jumlahSaudara: '1', 
					hobi: 1, 
					citaCita: 1, 
					jenjang: 1, 
					namaSekolah: 'SD. Teka Teki', 
					statusSekolah: 1, 
					npsn: '123', 
					alamatSekolah: 'Bogor', 
					kabkotSekolah: '32.01', 
					noKK: '123', 
					namaKK: 'Andre', 
					nikAyah: '123', 
					namaAyah: 'Andre', 
					tahunAyah: '1970', 
					statusAyah: 1, 
					pendidikanAyah: 1, 
					pekerjaanAyah: 1, 
					telpAyah: '123456789', 
					nikIbu: '123', 
					namaIbu: 'Susi', 
					tahunIbu: '1989', 
					statusIbu: 1, 
					pendidikanIbu: 1, 
					pekerjaanIbu: 1, 
					telpIbu: '123456789', 
					nikWali: '', 
					namaWali: '', 
					tahunWali: '', 
					pendidikanWali: null, 
					pekerjaanWali: null, 
					telpWali: '123456789', 
					telp: '123456789', 
					alamat: 'Bogor', 
					provinsi: '32', 
					kabKota: '32.01', 
					kecamatan: '32.01.01', 
					kelurahan: '32.01.01.1002', 
					kodePos: '16913',
					penghasilan: 1,
					statusTempatTinggal: 1,
					jarakRumah: 1,
					transportasi: 1,
				}]);
				
				//Pil Agama
				worksheetAgama.columns = [
					{ header: "KODE", key: "kode", width: 15 },
					{ header: "LABEL", key: "label", width: 15 }
				];
				const figureColumnsAgama = [1, 2];
				figureColumnsAgama.forEach((i) => {
					worksheetAgama.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetAgama.addRows(await _allOption({ table: models.Agama }));

				//Pil Hobi
				worksheetHobi.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsHobi = [1, 2];
				figureColumnsHobi.forEach((i) => {
					worksheetHobi.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetHobi.addRows(await _allOption({ table: models.Hobi }));

				//Pil CitaCita
				worksheetCitaCita.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsCitaCita = [1, 2];
				figureColumnsCitaCita.forEach((i) => {
					worksheetCitaCita.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetCitaCita.addRows(await _allOption({ table: models.CitaCita }));

				//Pil JenjangSekolah
				worksheetJenjangSekolah.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsJenjangSekolah = [1, 2];
				figureColumnsJenjangSekolah.forEach((i) => {
					worksheetJenjangSekolah.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetJenjangSekolah.addRows(await _allOption({ table: models.JenjangSekolah }));

				//Pil StatusSekolah
				worksheetStatusSekolah.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsStatusSekolah = [1, 2];
				figureColumnsStatusSekolah.forEach((i) => {
					worksheetStatusSekolah.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetStatusSekolah.addRows(await _allOption({ table: models.StatusSekolah }));

				//Pil StatusOrangTua
				worksheetStatusOrangTua.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsStatusOrangTua = [1, 2];
				figureColumnsStatusOrangTua.forEach((i) => {
					worksheetStatusOrangTua.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetStatusOrangTua.addRows(await _allOption({ table: models.StatusOrangtua }));

				//Pil Pendidikan
				worksheetPendidikan.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsPendidikan = [1, 2];
				figureColumnsPendidikan.forEach((i) => {
					worksheetPendidikan.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetPendidikan.addRows(await _allOption({ table: models.Pendidikan }));

				//Pil Pekerjaan
				worksheetPekerjaan.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsPekerjaan = [1, 2];
				figureColumnsPekerjaan.forEach((i) => {
					worksheetPekerjaan.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetPekerjaan.addRows(await _allOption({ table: models.Pekerjaan }));

				//Pil StatusTempatTinggal
				worksheetStatusTempatTinggal.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsStatusTempatTinggal = [1, 2];
				figureColumnsStatusTempatTinggal.forEach((i) => {
					worksheetStatusTempatTinggal.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetStatusTempatTinggal.addRows(await _allOption({ table: models.StatusTempatTinggal }));

				//Pil JarakRumah
				worksheetJarakRumah.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsJarakRumah = [1, 2];
				figureColumnsJarakRumah.forEach((i) => {
					worksheetJarakRumah.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetJarakRumah.addRows(await _allOption({ table: models.JarakRumah }));

				//Pil AlatTransportasi
				worksheetAlatTransportasi.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsAlatTransportasi = [1, 2];
				figureColumnsAlatTransportasi.forEach((i) => {
					worksheetAlatTransportasi.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetAlatTransportasi.addRows(await _allOption({ table: models.Transportasi }));

				//Pil Penghasilan
				worksheetPenghasilan.columns = [
					{ header: "KODE", key: "kode", width: 10 },
					{ header: "LABEL", key: "label", width: 50 }
				];
				const figureColumnsPenghasilan = [1, 2];
				figureColumnsPenghasilan.forEach((i) => {
					worksheetPenghasilan.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheetPenghasilan.addRows(await _allOption({ table: models.Penghasilan }));

				res.setHeader(
					"Content-Disposition",
					"attachment; filename=TemplateDataSiswa.xlsx"
				);
			}
			// else if(roleID === '2'){
			// 	let worksheet = workbook.addWorksheet("Data Guru");
			// 	let worksheetAgama = workbook.addWorksheet("Agama");
			// 	let worksheetPendidikan = workbook.addWorksheet("Pendidikan");
			// 	let worksheetJabatan = workbook.addWorksheet("Jabatan");
			// 	let worksheetBidangMengajar = workbook.addWorksheet("Bidang Mengajar");

			// 	//Data Guru
			// 	worksheet.columns = [
			// 		{ header: "NAMA", key: "name", width: 20 },
			// 		{ header: "EMAIL", key: "email", width: 20 },
			// 		{ header: "TANGGAL LAHIR", key: "tgl_lahir", width: 20 },
			// 		{ header: "TEMPAT", key: "tempat", width: 20 },
			// 		{ header: "JENIS KELAMIN", key: "jeniskelamin", width: 20 },
			// 		{ header: "AGAMA", key: "agama", width: 20 },
			// 		{ header: "PENDIDIKAN TERAKHIR", key: "pendidikan_guru", width: 25 },
			// 		{ header: "JABATAN", key: "jabatan_guru", width: 20 },
			// 		{ header: "MENGAJAR BIDANG", key: "mengajar_bidang", width: 20 },
			// 		{ header: "MENGAJAR KELAS", key: "mengajar_kelas", width: 20 },
			// 		{ header: "TELEPON", key: "telp", width: 20 },
			// 		{ header: "ALAMAT", key: "alamat", width: 40 },
			// 		{ header: "PROVINSI", key: "provinsi", width: 20 },
			// 		{ header: "KABUPATEN / KOTA", key: "kabkota", width: 20 },
			// 		{ header: "KECAMATAN", key: "kecamatan", width: 20 },
			// 		{ header: "KELURAHAN", key: "kelurahan", width: 20 },
			// 		{ header: "KODE POS", key: "kode_pos", width: 20 },
			// 	];
			// 	const figureColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
			// 	figureColumns.forEach((i) => {
			// 		worksheet.getColumn(i).alignment = { horizontal: "left" };
			// 	});
			// 	worksheet.addRows([{
			// 		name: 'tes', 
			// 		email: 'tes@gmail.com',
			// 		tgl_lahir: new Date(),
			// 		tempat: 'Bogor', 
			// 		jeniskelamin: 'Laki - Laki', 
			// 		agama: 'Islam',  
			// 		pendidikan_guru: '5',  
			// 		jabatan_guru: 'Staff TU',  
			// 		mengajar_bidang: 'PKN',  
			// 		mengajar_kelas: '7,8,9',  
			// 		telp: '123456789', 
			// 		alamat: 'Bogor', 
			// 		provinsi: '32', 
			// 		kabkota: '32.01', 
			// 		kecamatan: '32.01.01', 
			// 		kelurahan: '32.01.01.1002', 
			// 		kode_pos: '16913',
			// 	}]);

			// 	//Pil Agama
			// 	worksheetAgama.columns = [
			// 		{ header: "KODE", key: "kode", width: 15 },
			// 		{ header: "LABEL", key: "label", width: 15 }
			// 	];
			// 	const figureColumnsAgama = [1, 2];
			// 	figureColumnsAgama.forEach((i) => {
			// 		worksheetAgama.getColumn(i).alignment = { horizontal: "left" };
			// 	});
			// 	worksheetAgama.addRows([
			// 		{ kode: 'Islam', label: 'Islam' },
			// 		{ kode: 'Katolik', label: 'Katolik' },
			// 		{ kode: 'Protestan', label: 'Protestan' },
			// 		{ kode: 'Hindu', label: 'Hindu' },
			// 		{ kode: 'Budha', label: 'Budha' }
			// 	]);

			// 	//Pil Pendidikan
			// 	worksheetPendidikan.columns = [
			// 		{ header: "KODE", key: "kode", width: 10 },
			// 		{ header: "LABEL", key: "label", width: 50 }
			// 	];
			// 	const figureColumnsPendidikan = [1, 2];
			// 	figureColumnsPendidikan.forEach((i) => {
			// 		worksheetPendidikan.getColumn(i).alignment = { horizontal: "left" };
			// 	});
			// 	worksheetPendidikan.addRows([
			// 		{ kode: '0', label: 'Tidak Berpendidikan Formal' },
			// 		{ kode: '1', label: 'SD/Sederajat' },
			// 		{ kode: '2', label: 'SMP/Sederajat' },
			// 		{ kode: '3', label: 'SMA/Sederajat' },
			// 		{ kode: '4', label: 'D1' },
			// 		{ kode: '5', label: 'D2' },
			// 		{ kode: '6', label: 'D3' },
			// 		{ kode: '7', label: 'S1' },
			// 		{ kode: '8', label: 'S2' },
			// 		{ kode: '9', label: '>S2' },
			// 	]);

			// 	//Pil Jabatan
			// 	worksheetJabatan.columns = [
			// 		{ header: "KODE", key: "kode", width: 30 },
			// 		{ header: "LABEL", key: "label", width: 30 }
			// 	];
			// 	const figureColumnsJabatan = [1, 2];
			// 	figureColumnsJabatan.forEach((i) => {
			// 		worksheetJabatan.getColumn(i).alignment = { horizontal: "left" };
			// 	});
			// 	worksheetJabatan.addRows([
			// 		{ value: 'Kepala Sekolah', label: 'Kepala Sekolah' },
			// 		{ value: 'WaKaBid. Kesiswaan', label: 'WaKaBid. Kesiswaan' },
			// 		{ value: 'WaKaBid. Kurikulum', label: 'WaKaBid. Kurikulum' },
			// 		{ value: 'WaKaBid. Sarpras', label: 'WaKaBid. Sarpras' },
			// 		{ value: 'Kepala TU', label: 'Kepala TU' },
			// 		{ value: 'Staff TU', label: 'Staff TU' },
			// 		{ value: 'Wali Kelas', label: 'Wali Kelas' },
			// 		{ value: 'BP / BK', label: 'BP / BK' },
			// 		{ value: 'Pembina Osis', label: 'Pembina Osis' },
			// 		{ value: 'Pembina Pramuka', label: 'Pembina Pramuka' },
			// 		{ value: 'Pembina Paskibra', label: 'Pembina Paskibra' },
			// 	]);

			// 	//Pil Bidang Mengajar
			// 	worksheetBidangMengajar.columns = [
			// 		{ header: "KODE", key: "kode", width: 30 },
			// 		{ header: "LABEL", key: "label", width: 30 }
			// 	];
			// 	const figureColumnsBidangworksheetBidangMengajar = [1, 2];
			// 	figureColumnsBidangworksheetBidangMengajar.forEach((i) => {
			// 		worksheetBidangMengajar.getColumn(i).alignment = { horizontal: "left" };
			// 	});
			// 	worksheetBidangMengajar.addRows([
			// 		{ kode: 'Alquran Hadits', label: 'Alquran Hadits' },
			// 		{ kode: 'Aqidah Akhlak', label: 'Aqidah Akhlak' },
			// 		{ kode: 'Bahasa Arab', label: 'Bahasa Arab' },
			// 		{ kode: 'Bahasa Indonesia', label: 'Bahasa Indonesia' },
			// 		{ kode: 'Bahasa Inggris', label: 'Bahasa Inggris' },
			// 		{ kode: 'Bahasa Sunda', label: 'Bahasa Sunda' },
			// 		{ kode: 'BTQ', label: 'BTQ' },
			// 		{ kode: 'Fiqih', label: 'Fiqih' },
			// 		{ kode: 'IPA Terpadu', label: 'IPA Terpadu' },
			// 		{ kode: 'IPS Terpadu', label: 'IPS Terpadu' },
			// 		{ kode: 'Matematika', label: 'Matematika' },
			// 		{ kode: 'Penjasorkes', label: 'Penjasorkes' },
			// 		{ kode: 'PKN', label: 'PKN' },
			// 		{ kode: 'Prakarya', label: 'Prakarya' },
			// 		{ kode: 'Seni Budaya', label: 'Seni Budaya' },
			// 		{ kode: 'SKI', label: 'SKI' },
			// 	]);

			// 	res.setHeader(
			// 		"Content-Disposition",
			// 		"attachment; filename=TemplateDataGuru.xlsx"
			// 	);
			// }
	
			res.setHeader(
				"Content-Type",
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			);
  
			return workbook.xlsx.write(res).then(function () {
				res.status(200).end();
			});
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
			let jsonDataInsert = [];
			let jsonDataPending = [];
			let jsonData = [];
			readXlsxFile(dir.path).then(async(rows) => {
				rows.shift();
				rows.map(async (row) => {
					let data = {
						nama: row[0], 
						email: row[1], 
						nikSiswa: row[2], 
						nomorInduk: row[3], 
						tanggalLahir: row[4],
						tempat: row[5], 
						jenisKelamin: row[6], 
						agama: row[7], 
						anakKe: row[8], 
						jumlahSaudara: row[9], 
						hobi: row[10], 
						citaCita: row[11], 
						jenjang: row[12], 
						namaSekolah: row[13], 
						statusSekolah: row[14], 
						npsn: row[15], 
						alamatSekolah: row[16], 
						kabkotSekolah: row[17], 
						noKK: row[18], 
						namaKK: row[19], 
						nikAyah: row[20], 
						namaAyah: row[21], 
						tahunAyah: row[22], 
						statusAyah: row[23], 
						pendidikanAyah: row[24], 
						pekerjaanAyah: row[25], 
						telpAyah: row[26], 
						nikIbu: row[27], 
						namaIbu: row[28], 
						tahunIbu: row[29], 
						statusIbu: row[30], 
						pendidikanIbu: row[31], 
						pekerjaanIbu: row[32], 
						telpIbu: row[33], 
						nikWali: row[34], 
						namaWali: row[35], 
						tahunWali: row[36], 
						pendidikanWali: row[37], 
						pekerjaanWali: row[38], 
						telpWali: row[39], 
						telp: row[40], 
						alamat: row[41], 
						provinsi: row[42], 
						kabKota: row[43], 
						kecamatan: row[44], 
						kelurahan: row[45], 
						kodePos: row[46],
						penghasilan: row[47],
						statusTempatTinggal: row[48],
						jarakRumah: row[49],
						transportasi: row[50],
					};
					jsonData.push(data);
				});

				//Proccess
				await Promise.all(jsonData.map(async str => {
					let where = { 
						statusAktif: true,
						consumerType: 4,
						[Op.or]: [
							{ email: str.email },
							{ '$UserDetail.nomor_induk$': str.nomorInduk },
						] 
					}
					const count = await models.User.count({
						where,
						include: [
							{ 
								model: models.UserDetail,
							}
						],
					});
					if(count){
						jsonDataPending.push(str)
					}else{
						jsonDataInsert.push(str)
					}
				}))

				if(jsonDataInsert.length) {
					let salt, hashPassword, kirimdataUser, kirimdataUserDetail;				
					salt = await bcrypt.genSalt();
					await Promise.all(jsonData.map(async str => {
						const ksuid = await createKSUID()
						hashPassword = await bcrypt.hash(convertDate3(str.tanggalLahir), salt);
						kirimdataUser = {
							idUser: ksuid,
							consumerType: 4,
							nama: str.nama,
							email: str.email,
							username: str.nama.split(' ')[0],
							password: hashPassword,
							kataSandi: encrypt(convertDate3(str.tanggalLahir)),
							statusAktif: 1,
							createBy: body.createupdateBy,
						}
						kirimdataUserDetail = {
							idUser: ksuid,
							nikSiswa: str.nikSiswa,
							nomorInduk: str.nomorInduk,
							tempat: str.tempat,
							tanggalLahir: convertDate(str.tanggalLahir),
							jenisKelamin: str.jenisKelamin,
							agama: str.agama,
							anakKe: str.anakKe,
							jumlahSaudara: str.jumlahSaudara,
							hobi: str.hobi,
							citaCita: str.citaCita,
							kelas: str.kelas,
							//dataSekolahSebelumnya
							jenjang: str.jenjang,
							statusSekolah: str.statusSekolah,
							namaSekolah: str.namaSekolah,
							npsn: str.npsn,
							alamatSekolah: str.alamatSekolah,
							kabkotSekolah: str.kabkotSekolah,
							noPesertaUN: str.noPesertaUN,
							noSKHUN: str.noSKHUN,
							noIjazah: str.noIjazah,
							nilaiUN: str.nilaiUN,
							//dataOrangtua
							noKK: str.noKK,
							namaKK: str.namaKK,
							penghasilan: str.penghasilan,
							//dataAyah
							namaAyah: str.namaAyah,
							tahunAyah: str.tahunAyah,
							statusAyah: str.statusAyah,
							nikAyah: str.nikAyah,
							pendidikanAyah: str.pendidikanAyah,
							pekerjaanAyah: str.pekerjaanAyah,
							telpAyah: str.telpAyah,
							//dataIbu
							namaIbu: str.namaIbu,
							tahunIbu: str.tahunIbu,
							statusIbu: str.statusIbu,
							nikIbu: str.nikIbu,
							pendidikanIbu: str.pendidikanIbu,
							pekerjaanIbu: str.pekerjaanIbu,
							telpIbu: str.telpIbu,
							//dataWali
							namaWali: str.namaWali,
							tahunWali: str.tahunWali,
							nikWali: str.nikWali,
							pendidikanWali: str.pendidikanWali,
							pekerjaanWali: str.pekerjaanWali,
							telpWali: str.telpWali,
							//dataAlamatOrangtua
							telp: str.telp,
							alamat: str.alamat,
							provinsi: str.provinsi,
							kabKota: str.kabKota,
							kecamatan: str.kecamatan,
							kelurahan: str.kelurahan,
							kodePos: str.kodePos,
							//dataLainnya
							statusTempatTinggal: str.statusTempatTinggal,
							jarakRumah: str.jarakRumah,
							transportasi: str.transportasi,
						}

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
						let semester = cms_setting.semester.value === 1 ? 'ganjil' : 'genap'

						let dataMengajar = await _allOption({ table: models.Mengajar })
						let kirimdataNilai = []
						await dataMengajar.map(str => {
							kirimdataNilai.push({
								idUser: ksuid,
								mapel: str.label,
								dataNilai: JSON.stringify([
									{
										semester,
										nilai: {
											tugas1: 0,
											tugas2: 0,
											tugas3: 0,
											tugas4: 0,
											tugas5: 0,
											tugas6: 0,
											tugas7: 0,
											tugas8: 0,
											tugas9: 0,
											tugas10: 0,
											uts: 0,
											uas: 0
										}
									}
								]),
								dataKehadiran: JSON.stringify([
									{
										kehadiran: {
											sakit: 0,
											alfa: 0,
											ijin: 0,
										}
									}
								])
							})
						})
						await sequelizeInstance.transaction(async trx => {
							await models.User.create(kirimdataUser, { transaction: trx })
							await models.UserDetail.create(kirimdataUserDetail, { transaction: trx })
							await models.Nilai.bulkCreate(kirimdataNilai, { transaction: trx })
						})	
					}))
				}
				return OK(res, { jsonDataInsert: jsonDataInsert.length, jsonDataPending: jsonDataPending.length })
			})
	  } catch (err) {
			  return NOT_FOUND(res, err.message)
	  }
	}  
}

function exportExcel (models) {
	return async (req, res, next) => {
		let { kelas, kategori } = req.query
	  try {
			let workbook = new excel.Workbook();
			let split = kelas.split(', ')
			for (let index = 0; index < split.length; index++) {
				let whereUserDetail = {}
				let whereUser = {}
				if(kelas){
					whereUserDetail.kelas = split[index]
					whereUser.mutasiAkun = false
				}
				const dataSiswaSiswi = await models.User.findAll({
					where: whereUser,
					attributes: { exclude: ['createBy', 'updateBy', 'deleteBy', 'createdAt', 'updatedAt', 'deletedAt'] },
					include: [
						{ 
							model: models.Role,
							attributes: ['namaRole'],
							where: { status: true }
						},
						{ 
							model: models.UserDetail,
							where: whereUserDetail
						},
					],
				});
	
				const result = await Promise.all(dataSiswaSiswi.map(async val => {
					let agama = await _agamaOption({ models, kode: val.UserDetail.agama })
					let hobi = await _hobiOption({ models, kode: val.UserDetail.hobi })
					let cita_cita = await _citacitaOption({ models, kode: val.UserDetail.citaCita })
					let jenjang = await _jenjangsekolahOption({ models, kode: val.UserDetail.jenjang })
					let status_sekolah = await _statussekolahOption({ models, kode: val.UserDetail.statusSekolah })
					let kabkota_sekolah = await _wilayahOption({ models, kode: val.UserDetail.kabkotSekolah })
					let status_ayah = await _statusortuOption({ models, kode: val.UserDetail.statusAyah })
					let status_ibu = await _statusortuOption({ models, kode: val.UserDetail.statusIbu })
					let pendidikan_ayah = await _pendidikanOption({ models, kode: val.UserDetail.pendidikanAyah })
					let pendidikan_ibu = await _pendidikanOption({ models, kode: val.UserDetail.pendidikanIbu })
					let pendidikan_wali = await _pendidikanOption({ models, kode: val.UserDetail.pendidikanWali })
					let pekerjaan_ayah = await _pekerjaanOption({ models, kode: val.UserDetail.pekerjaanAyah })
					let pekerjaan_ibu = await _pekerjaanOption({ models, kode: val.UserDetail.pekerjaanIbu })
					let pekerjaan_wali = await _pekerjaanOption({ models, kode: val.UserDetail.pekerjaanWali })
					let penghasilan = await _penghasilanOption({ models, kode: val.UserDetail.penghasilan })
					let provinsi = await _wilayahOption({ models, kode: val.UserDetail.provinsi })
					let kabkota = await _wilayahOption({ models, kode: val.UserDetail.kabKota })
					let kecamatan = await _wilayahOption({ models, kode: val.UserDetail.kecamatan })
					let kelurahan = await _wilayahOption({ models, kode: val.UserDetail.kelurahan })
					let status_tempat_tinggal = await _statustempattinggalOption({ models, kode: val.UserDetail.statusTempatTinggal })
					let jarak_rumah = await _jarakrumahOption({ models, kode: val.UserDetail.jarakRumah })
					let transportasi = await _transportasiOption({ models, kode: val.UserDetail.transportasi })
	
					return {
						idUser: val.idUser,
						consumerType: val.consumerType,
						nikSiswa: val.UserDetail.nikSiswa,
						nomorInduk: val.UserDetail.nomorInduk,
						namaRole: val.Role.namaRole,
						nama: val.nama,
						username: val.username,
						email: val.email,
						password: val.password,
						kataSandi: val.kataSandi,
						tempat: val.UserDetail.tempat,
						tanggalLahir: val.UserDetail.tanggalLahir,
						jenisKelamin: val.UserDetail.jenisKelamin,
						agama: val.UserDetail.agama ? kategori === 'full' ? agama.label : agama.kode : null,
						anakKe: val.UserDetail.anakKe,
						jumlahSaudara: val.UserDetail.jumlahSaudara,
						hobi: val.UserDetail.hobi ? kategori === 'full' ? hobi.label : hobi.kode : null,
						citaCita: val.UserDetail.citaCita ? kategori === 'full' ? cita_cita.label : cita_cita.kode : null,
						jenjang: val.UserDetail.jenjang ? kategori === 'full' ? jenjang.label : jenjang.kode : null,
						statusSekolah: val.UserDetail.statusSekolah ? kategori === 'full' ? status_sekolah.label : status_sekolah.kode : null,
						namaSekolah: val.UserDetail.namaSekolah,
						npsn: val.UserDetail.npsn,
						alamatSekolah: val.UserDetail.alamatSekolah,
						kabkotSekolah: val.UserDetail.kabkotSekolah ? kategori === 'full' ? uppercaseLetterFirst2(kabkota_sekolah.nama) : kabkota_sekolah.kode : null,
						noPesertaUN: val.UserDetail.noPesertaUN,
						noSKHUN: val.UserDetail.noSKHUN,
						noIjazah: val.UserDetail.noIjazah,
						nilaiUN: val.UserDetail.nilaiUN,
						noKK: val.UserDetail.noKK,
						namaKK: val.UserDetail.namaKK,
						namaAyah: val.UserDetail.namaAyah,
						tahunAyah: val.UserDetail.tahunAyah,
						statusAyah: val.UserDetail.statusAyah ? kategori === 'full' ? status_ayah.label : status_ayah.kode : null,
						nikAyah: val.UserDetail.nikAyah,
						pendidikanAyah: val.UserDetail.pendidikanAyah ? kategori === 'full' ? pendidikan_ayah.label : pendidikan_ayah.kode : null,
						pekerjaanAyah: val.UserDetail.pekerjaanAyah ? kategori === 'full' ? pekerjaan_ayah.label : pekerjaan_ayah.kode : null,
						telpAyah: val.UserDetail.telpAyah,
						namaIbu: val.UserDetail.namaIbu,
						tahunIbu: val.UserDetail.tahunIbu,
						statusIbu: val.UserDetail.statusIbu ? kategori === 'full' ? status_ibu.label : status_ibu.kode : null,
						nikIbu: val.UserDetail.nikIbu,
						pendidikanIbu: val.UserDetail.pendidikanIbu ? kategori === 'full' ? pendidikan_ibu.label : pendidikan_ibu.kode : null,
						pekerjaanIbu: val.UserDetail.pekerjaanIbu ? kategori === 'full' ? pekerjaan_ibu.label : pekerjaan_ibu.kode : null,
						telpIbu: val.UserDetail.telpIbu,
						namaWali: val.UserDetail.namaWali,
						tahunWali: val.UserDetail.tahunWali,
						nikWali: val.UserDetail.nikWali,
						pendidikanWali: val.UserDetail.pendidikanWali ? kategori === 'full' ? pendidikan_wali.label : pendidikan_wali.kode : null,
						pekerjaanWali: val.UserDetail.pekerjaanWali ? kategori === 'full' ? pekerjaan_wali.label : pekerjaan_wali.kode : null,
						telpWali: val.UserDetail.telpWali,
						penghasilan: val.UserDetail.penghasilan ? kategori === 'full' ? penghasilan.label : penghasilan.kode : null,
						telp: val.UserDetail.telp,
						alamat: val.UserDetail.alamat,
						provinsi: val.UserDetail.provinsi ? kategori === 'full' ? uppercaseLetterFirst2(provinsi.nama) : provinsi.kode : null,
						kabKota: val.UserDetail.kabKota ? kategori === 'full' ? uppercaseLetterFirst2(kabkota.nama) : kabkota.kode : null,
						kecamatan: val.UserDetail.kecamatan ? kategori === 'full' ? uppercaseLetterFirst2(kecamatan.nama) : kecamatan.kode : null,
						kelurahan: val.UserDetail.kelurahan ? kategori === 'full' ? uppercaseLetterFirst2(kelurahan.nama) : kelurahan.kode : null,
						kodePos: val.UserDetail.kodePos,
						kelas: val.UserDetail.kelas,
						statusTempatTinggal: val.UserDetail.statusTempatTinggal ? kategori === 'full' ? status_tempat_tinggal.label : status_tempat_tinggal.kode : null,
						jarakRumah: val.UserDetail.jarakRumah ? kategori === 'full' ? jarak_rumah.label : jarak_rumah.kode : null,
						transportasi: val.UserDetail.transportasi ? kategori === 'full' ? transportasi.label : transportasi.kode : null,
					}
				}))
	
				let worksheet = workbook.addWorksheet(`Kelas ${split[index]}`);
				if(kategori === 'emis'){
					let worksheetAgama = workbook.addWorksheet("Agama");
					let worksheetHobi = workbook.addWorksheet("Hobi");
					let worksheetCitaCita = workbook.addWorksheet("Cita - Cita");
					let worksheetJenjangSekolah = workbook.addWorksheet("Jenjang Sekolah");
					let worksheetStatusSekolah = workbook.addWorksheet("Status Sekolah");
					let worksheetStatusOrangTua = workbook.addWorksheet("Status Orang Tua");
					let worksheetPendidikan = workbook.addWorksheet("Pendidikan");
					let worksheetPekerjaan = workbook.addWorksheet("Pekerjaan");
					let worksheetStatusTempatTinggal = workbook.addWorksheet("Status Tempat Tinggal");
					let worksheetJarakRumah = workbook.addWorksheet("Jarak Rumah");
					let worksheetAlatTransportasi = workbook.addWorksheet("Alat Transportasi");
					let worksheetPenghasilan = workbook.addWorksheet("Penghasilan");

					//Pil Agama
					worksheetAgama.columns = [
						{ header: "KODE", key: "kode", width: 15 },
						{ header: "LABEL", key: "label", width: 15 }
					];
					const figureColumnsAgama = [1, 2];
					figureColumnsAgama.forEach((i) => {
						worksheetAgama.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetAgama.addRows(await _allOption({ table: models.Agama }));

					//Pil Hobi
					worksheetHobi.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsHobi = [1, 2];
					figureColumnsHobi.forEach((i) => {
						worksheetHobi.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetHobi.addRows(await _allOption({ table: models.Hobi }));

					//Pil CitaCita
					worksheetCitaCita.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsCitaCita = [1, 2];
					figureColumnsCitaCita.forEach((i) => {
						worksheetCitaCita.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetCitaCita.addRows(await _allOption({ table: models.CitaCita }));

					//Pil JenjangSekolah
					worksheetJenjangSekolah.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsJenjangSekolah = [1, 2];
					figureColumnsJenjangSekolah.forEach((i) => {
						worksheetJenjangSekolah.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetJenjangSekolah.addRows(await _allOption({ table: models.JenjangSekolah }));

					//Pil StatusSekolah
					worksheetStatusSekolah.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsStatusSekolah = [1, 2];
					figureColumnsStatusSekolah.forEach((i) => {
						worksheetStatusSekolah.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetStatusSekolah.addRows(await _allOption({ table: models.StatusSekolah }));

					//Pil StatusOrangTua
					worksheetStatusOrangTua.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsStatusOrangTua = [1, 2];
					figureColumnsStatusOrangTua.forEach((i) => {
						worksheetStatusOrangTua.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetStatusOrangTua.addRows(await _allOption({ table: models.StatusOrangtua }));

					//Pil Pendidikan
					worksheetPendidikan.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsPendidikan = [1, 2];
					figureColumnsPendidikan.forEach((i) => {
						worksheetPendidikan.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetPendidikan.addRows(await _allOption({ table: models.Pendidikan }));

					//Pil Pekerjaan
					worksheetPekerjaan.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsPekerjaan = [1, 2];
					figureColumnsPekerjaan.forEach((i) => {
						worksheetPekerjaan.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetPekerjaan.addRows(await _allOption({ table: models.Pekerjaan }));

					//Pil StatusTempatTinggal
					worksheetStatusTempatTinggal.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsStatusTempatTinggal = [1, 2];
					figureColumnsStatusTempatTinggal.forEach((i) => {
						worksheetStatusTempatTinggal.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetStatusTempatTinggal.addRows(await _allOption({ table: models.StatusTempatTinggal }));

					//Pil JarakRumah
					worksheetJarakRumah.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsJarakRumah = [1, 2];
					figureColumnsJarakRumah.forEach((i) => {
						worksheetJarakRumah.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetJarakRumah.addRows(await _allOption({ table: models.JarakRumah }));

					//Pil AlatTransportasi
					worksheetAlatTransportasi.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsAlatTransportasi = [1, 2];
					figureColumnsAlatTransportasi.forEach((i) => {
						worksheetAlatTransportasi.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetAlatTransportasi.addRows(await _allOption({ table: models.Transportasi }));

					//Pil Penghasilan
					worksheetPenghasilan.columns = [
						{ header: "KODE", key: "kode", width: 10 },
						{ header: "LABEL", key: "label", width: 50 }
					];
					const figureColumnsPenghasilan = [1, 2];
					figureColumnsPenghasilan.forEach((i) => {
						worksheetPenghasilan.getColumn(i).alignment = { horizontal: "left" };
					});
					worksheetPenghasilan.addRows(await _allOption({ table: models.Penghasilan }));
				}

				//Data Siswa
				worksheet.columns = [
					{ header: "NAMA", key: "nama", width: 20 },
					{ header: "EMAIL", key: "email", width: 20 },
					{ header: "NIK SISWA", key: "nikSiswa", width: 20 },
					{ header: "NISN", key: "nomorInduk", width: 20 },
					{ header: "TANGGAL LAHIR", key: "tanggalLahir", width: 20 },
					{ header: "TEMPAT", key: "tempat", width: 20 },
					{ header: "JENIS KELAMIN", key: "jenisKelamin", width: 20 },
					{ header: "AGAMA", key: "agama", width: 20 },
					{ header: "ANAK KE", key: "anakKe", width: 20 },
					{ header: "JUMLAH SAUDARA", key: "jumlahSaudara", width: 20 },
					{ header: "HOBI", key: "hobi", width: 20 },
					{ header: "CITA-CITA", key: "citaCita", width: 20 },
					{ header: "JENJANG SEKOLAH", key: "jenjang", width: 20 },
					{ header: "NAMA SEKOLAH", key: "namaSekolah", width: 20 },
					{ header: "STATUS SEKOLAH", key: "statusSekolah", width: 20 },
					{ header: "NPSN", key: "npsn", width: 20 },
					{ header: "ALAMAT SEKOLAH", key: "alamatSekolah", width: 40 },
					{ header: "KABUPATEN / KOTA SEKOLAH SEBELUMNYA", key: "kabkotSekolah", width: 20 },
					{ header: "NOMOR KK", key: "noKK", width: 20 },
					{ header: "NAMA KEPALA KELUARGA", key: "namaKK", width: 20 },
					{ header: "NIK AYAH", key: "nikAyah", width: 20 },
					{ header: "NAMA AYAH", key: "namaAyah", width: 20 },
					{ header: "TAHUN AYAH", key: "tahunAyah", width: 20 },
					{ header: "STATUS AYAH", key: "statusAyah", width: 20 },
					{ header: "PENDIDIKAN AYAH", key: "pendidikanAyah", width: 20 },
					{ header: "PEKERJAAN AYAH", key: "pekerjaanAyah", width: 20 },
					{ header: "NO HANDPHONE AYAH", key: "telpAyah", width: 20 },
					{ header: "NIK IBU", key: "nikIbu", width: 20 },
					{ header: "NAMA IBU", key: "namaIbu", width: 20 },
					{ header: "TAHUN IBU", key: "tahunIbu", width: 20 },
					{ header: "STATUS IBU", key: "statusIbu", width: 20 },
					{ header: "PENDIDIKAN IBU", key: "pendidikanIbu", width: 20 },
					{ header: "PEKERJAAN IBU", key: "pekerjaanIbu", width: 20 },
					{ header: "NO HANDPHONE IBU", key: "telpIbu", width: 20 },
					{ header: "NIK WALI", key: "nikWali", width: 20 },
					{ header: "NAMA WALI", key: "namaWali", width: 20 },
					{ header: "TAHUN WALI", key: "tahunWali", width: 20 },
					{ header: "PENDIDIKAN WALI", key: "pendidikanWali", width: 20 },
					{ header: "PEKERJAAN WALI", key: "pekerjaanWali", width: 20 },
					{ header: "NO HANDPHONE WALI", key: "telpWali", width: 20 },
					{ header: "TELEPON", key: "telp", width: 20 },
					{ header: "ALAMAT", key: "alamat", width: 40 },
					{ header: "PROVINSI", key: "provinsi", width: 20 },
					{ header: "KABUPATEN / KOTA", key: "kabKota", width: 20 },
					{ header: "KECAMATAN", key: "kecamatan", width: 20 },
					{ header: "KELURAHAN", key: "kelurahan", width: 20 },
					{ header: "KODE POS", key: "kodePos", width: 20 },
					{ header: "PENGHASILAN", key: "penghasilan", width: 20 },
					{ header: "STATUS TEMPAT TINGGAL", key: "statusTempatTinggal", width: 20 },
					{ header: "JARAK RUMAH", key: "jarakRumah", width: 20 },
					{ header: "TRANSPORTASI", key: "transportasi", width: 20 },
				];
				const figureColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 ,19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];
				figureColumns.forEach((i) => {
					worksheet.getColumn(i).alignment = { horizontal: "left" };
				});
				worksheet.addRows(result);

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
	  } catch (err) {
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
		try {
			let textInput = "JAWA BARAT"
			let regex = /[\!\@\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-]/g
			let cek = regex.test(textInput)
			textInput = textInput.toLowerCase();
			var stringArray = ''
			if(cek){
				stringArray = textInput.split(". ");
			}else{
				stringArray = textInput.split(/\b(\s)/);
			}
			for (var i = 0; i < stringArray.length; i++) {
				stringArray[i] =
					stringArray[i].charAt(0).toUpperCase() +
					stringArray[i].substring(1);
			}
			var finalText = cek ? stringArray.join(". ") : stringArray.join("");
			return OK(res, finalText)
		} catch (err) {
			return NOT_FOUND(res, err.message)
		}
	}
}

module.exports = {
  getDashboard,
  getAdmin,
  getAdminbyUid,
  postAdmin,
  getBiodata,
  getBiodatabyUid,
  postBiodata,
  downloadTemplate,
  importExcel,
  exportExcel,
  pdfCreate,
  pdfCreateRaport,
  testing,
}