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
	const wilayahpanjaitan = await models.WilayahPanjaitan.findOne({ where: { kode, statusWilayah: true }, attributes: ['kode', 'label', 'lambang', 'namaKetuaWilayah'] })
	return wilayahpanjaitan
}

async function _ompuOption(params) {
	const { models, kode } = params
	const ompu = await models.Ompu.findOne({ where: { kode }, attributes: ['kode', 'label'] })
	return ompu
}

async function _komisariswilayahOption(params) {
	const { models, kodeKomisarisWilayah } = params
	const komisarisWilayah = await models.KomisarisWilayah.findOne({ where: { kodeKomisarisWilayah, statusKomisaris: true } })
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

async function _iuranAllData(params) {
	const { models, tahun, komisaris_wilayah } = params
	let dataiuran = []
	const dataBiodata = await models.Biodata.findAll({
		where: { komisarisWilayah: komisaris_wilayah },
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

	const totalKeseluruhanIuran = result.reduce((acc, curr) => {
		return {
			totalIuran: Number(acc.totalIuran) + Number(curr.totalIuran),
		};
	}, {
		totalIuran: 0,
	});

	result.map(str => {
		dataiuran.push(str.iuran);
	})
	const countObj = dataiuran.reduce((acc, curr) => {
		return {
			januari: acc.januari + curr.januari,
			februari: acc.februari + curr.februari,
			maret: acc.maret + curr.maret,
			april: acc.april + curr.april,
			mei: acc.mei + curr.mei,
			juni: acc.juni + curr.juni,
			juli: acc.juli + curr.juli,
			agustus: acc.agustus + curr.agustus,
			september: acc.september + curr.september,
			oktober: acc.oktober + curr.oktober,
			november: acc.november + curr.november,
			desember: acc.desember + curr.desember,
			total: acc.total + curr.total,
		};
	}, {
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
	});

	return {
		totalKeseluruhanIuran: totalKeseluruhanIuran.totalIuran,
		totalKeseluruhanIuranPerTahun: countObj.total,
		dataIuran: {
			idBiodata: '',
			idIuran: '',
			nik: '',
			namaLengkap: '',
			komisarisWilayah: '',
			iuran: countObj,
		}
	}
}

async function _penanggungjawabAllData(params) {
	const { models, tahun, kategori } = params
	let datapenangungjawab = []
	const dataRekapPenanggungJawab = await models.RekapPenanggungJawab.findAll({ order: [['nama', 'ASC']] });
	// let resultMenikah = [], resultMeninggal = []
	let result = await Promise.all(dataRekapPenanggungJawab.map(str => {
		let penanggungjawab = kategori === 'menikah' ? JSON.parse(str.menikah) : JSON.parse(str.meninggal)
		let dataPenanggungJawab = penanggungjawab.filter(val => val.tahun === tahun)
		// console.log(dataMenikah);

		// let penanggungjawabMenikah = JSON.parse(str.menikah)
		// let dataPenanggungJawabMenikah = penanggungjawabMenikah.filter(val => val.tahun === tahun)
		// let penanggungjawabMeninggal = JSON.parse(str.meninggal)
		// let dataPenanggungJawabMeninggal = penanggungjawabMeninggal.filter(val => val.tahun === tahun)

		// if(kategori === 'menikah'){
		// 	resultMenikah.push({
		// 		idRekap: str.idRekap,
		// 		kategori: str.kategori,
		// 		nama: str.nama,
		// 		penanggungjawab: dataPenanggungJawabMenikah.length ? dataPenanggungJawabMenikah[0].menikah : null,
		// 		totalPenanggungJawab: str.totalMenikah,
		// 	})
		// }else if(kategori === 'menikah'){
		// 	resultMeninggal.push({
		// 		idRekap: str.idRekap,
		// 		kategori: str.kategori,
		// 		nama: str.nama,
		// 		penanggungjawab: dataPenanggungJawabMeninggal.length ? dataPenanggungJawabMeninggal[0].meninggal : null,
		// 		totalPenanggungJawab: str.totalMeninggal,
		// 	})
		// }

		return {
			idRekap: str.idRekap,
			kategori: str.kategori,
			nama: str.nama,
			penanggungjawab: dataPenanggungJawab.length ? kategori === 'menikah' ? dataPenanggungJawab[0].menikah : dataPenanggungJawab[0].meninggal : null,
			totalPenanggungJawabMenikah: str.totalMenikah,
			totalPenanggungJawabMeninggal: str.totalMeninggal,
		}
	}))

	const totalKeseluruhanPenanggungJawab = result.reduce((acc, curr) => {
		return {
			totalPenanggungJawabMenikah: Number(acc.totalPenanggungJawabMenikah) + Number(curr.totalPenanggungJawabMenikah),
			totalPenanggungJawabMeninggal: Number(acc.totalPenanggungJawabMeninggal) + Number(curr.totalPenanggungJawabMeninggal),
		};
	}, {
		totalPenanggungJawabMenikah: 0,
		totalPenanggungJawabMeninggal: 0,
	});

	result.map(str => {
		datapenangungjawab.push(str.penanggungjawab);
	})
	const countObj = datapenangungjawab.reduce((acc, curr) => {
		return {
			januari: acc.januari + curr.januari,
			februari: acc.februari + curr.februari,
			maret: acc.maret + curr.maret,
			april: acc.april + curr.april,
			mei: acc.mei + curr.mei,
			juni: acc.juni + curr.juni,
			juli: acc.juli + curr.juli,
			agustus: acc.agustus + curr.agustus,
			september: acc.september + curr.september,
			oktober: acc.oktober + curr.oktober,
			november: acc.november + curr.november,
			desember: acc.desember + curr.desember,
			total: acc.total + curr.total,
		};
	}, {
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
	});

	return {
		totalKeseluruhanPenanggungJawab: countObj.total,
		totalKeseluruhanPenanggungJawabPerTahun: totalKeseluruhanPenanggungJawab.totalPenanggungJawabMenikah + totalKeseluruhanPenanggungJawab.totalPenanggungJawabMeninggal,
		dataPenanggungJawab: {
			idRekap: '',
			kategori: '',
			nama: '',
			penanggungjawab: countObj,
		}
	}
}

async function _tugasAllData(params) {
	const { models, tahun, bulan } = params
	let datatugas = []
	const dataRekapTugas = await models.RekapTugas.findAll({
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
			// totalTugas: gabung.total,
			totalTugasMenikah: str.totalMenikah,
			totalTugasMeninggal: str.totalMeninggal,
		}
	}))

	const totalKeseluruhanTugas = result.reduce((acc, curr) => {
		return {
			totalTugasMenikah: Number(acc.totalTugasMenikah) + Number(curr.totalTugasMenikah),
			totalTugasMeninggal: Number(acc.totalTugasMeninggal) + Number(curr.totalTugasMeninggal),
		};
	}, {
		totalTugasMenikah: 0,
		totalTugasMeninggal: 0,
	});

	result.map(str => {
		datatugas.push(str.tugas);
	})
	const countObj = datatugas.reduce((acc, curr) => {
		return {
			Anak_Mangoli: acc.Anak_Mangoli + curr.Anak_Mangoli,
			Boru_Muli: acc.Boru_Muli + curr.Boru_Muli,
			Bere_Mangoli: acc.Bere_Mangoli + curr.Bere_Mangoli,
			Pasahat: acc.Pasahat + curr.Pasahat,
			Manjalo: acc.Manjalo + curr.Manjalo,
			Resepsi: acc.Resepsi + curr.Resepsi,
			M123: acc.M123 + curr.M123,
			totalmenikah: acc.totalmenikah + curr.totalmenikah,
			Ama: acc.Ama + curr.Ama,
			Ina: acc.Ina + curr.Ina,
			Hela: acc.Hela + curr.Hela,
			Boru: acc.Boru + curr.Boru,
			Anak_Boru: acc.Anak_Boru + curr.Anak_Boru,
			Dakdanak: acc.Dakdanak + curr.Dakdanak,
			totalmeninggal: acc.totalmeninggal + curr.totalmeninggal,
			total: acc.total + curr.total,
		};
	}, {
		Anak_Mangoli: 0,
		Boru_Muli: 0,
		Bere_Mangoli: 0,
		Pasahat: 0,
		Manjalo: 0,
		Resepsi: 0,
		M123: 0,
		totalmenikah: 0,
		Ama: 0,
		Ina: 0,
		Hela: 0,
		Boru: 0,
		Anak_Boru: 0,
		Dakdanak: 0,
		totalmeninggal: 0,
		total: 0,
	});

	let BulanSebelumnya = bulan === '1' ? '1' : String(parseInt(bulan) - 1)
	let resultSampaiBulanIni = await JmlTugas(dataRekapTugas, tahun, bulan)
	let resultSampaiBulanSebelumnya = await JmlTugas(dataRekapTugas, tahun, BulanSebelumnya)

	return {
		totalKeseluruhanTugas: resultSampaiBulanIni.total,
		totalKeseluruhanTugasPerTahun: totalKeseluruhanTugas.totalTugasMenikah + totalKeseluruhanTugas.totalTugasMeninggal,
		dataTugasBulanIni: {
			idRekap: '',
			wilayahKode: '',
			wilayahNama: '',
			bulan: 'jmlbulanini',
			tugas: countObj
		},
		dataTugasSampaiBulanIni: {
			idRekap: '',
			wilayahKode: '',
			wilayahNama: '',
			bulan: 'jmlsampaibulanini',
			tugas: resultSampaiBulanIni
		},
		dataTugasSampaiBulanSebelumnya: {
			idRekap: '',
			wilayahKode: '',
			wilayahNama: '',
			bulan: 'jmlsampaibulansebelumnya',
			tugas: resultSampaiBulanSebelumnya
		}
	}
}

async function JmlTugas(dataRekapTugas, tahun, bulan) {
	let result = await Promise.all(dataRekapTugas.map(str => {
		let tugasMenikah = JSON.parse(str.menikah)
		let tugasMeninggal = JSON.parse(str.meninggal)
		let datatugasMenikahTemp = tugasMenikah.filter(val => val.tahun === tahun)
		let datatugasMeninggalTemp = tugasMeninggal.filter(val => val.tahun === tahun)
		let wadahMenikah = datatugasMenikahTemp.length ? datatugasMenikahTemp[0].menikah : []
		let wadahMeninggal = datatugasMeninggalTemp.length ? datatugasMeninggalTemp[0].meninggal : []
		let dataTugasMenikah = wadahMenikah.filter(val => val.bulan <= parseInt(bulan)).map(str => str.data)
		let dataTugasMeninggal = wadahMeninggal.filter(val => val.bulan <= parseInt(bulan)).map(str => str.data)
		var tugasTampung = dataTugasMenikah.map((obj, index) => ({
			...obj,
			...dataTugasMeninggal[index],
			total: obj.totalmenikah + dataTugasMeninggal[index].totalmeninggal
		}));
		const countObj = tugasTampung.reduce((acc, curr) => {
			return {
				Anak_Mangoli: acc.Anak_Mangoli + curr.Anak_Mangoli,
				Boru_Muli: acc.Boru_Muli + curr.Boru_Muli,
				Bere_Mangoli: acc.Bere_Mangoli + curr.Bere_Mangoli,
				Pasahat: acc.Pasahat + curr.Pasahat,
				Manjalo: acc.Manjalo + curr.Manjalo,
				Resepsi: acc.Resepsi + curr.Resepsi,
				M123: acc.M123 + curr.M123,
				totalmenikah: acc.totalmenikah + curr.totalmenikah,
				Ama: acc.Ama + curr.Ama,
				Ina: acc.Ina + curr.Ina,
				Hela: acc.Hela + curr.Hela,
				Boru: acc.Boru + curr.Boru,
				Anak_Boru: acc.Anak_Boru + curr.Anak_Boru,
				Dakdanak: acc.Dakdanak + curr.Dakdanak,
				totalmeninggal: acc.totalmeninggal + curr.totalmeninggal,
				total: acc.total + curr.total,
			};
		}, {
			Anak_Mangoli: 0,
			Boru_Muli: 0,
			Bere_Mangoli: 0,
			Pasahat: 0,
			Manjalo: 0,
			Resepsi: 0,
			M123: 0,
			totalmenikah: 0,
			Ama: 0,
			Ina: 0,
			Hela: 0,
			Boru: 0,
			Anak_Boru: 0,
			Dakdanak: 0,
			totalmeninggal: 0,
			total: 0,
		});
		return countObj
	}))

	const countObj = result.reduce((acc, curr) => {
		return {
			Anak_Mangoli: acc.Anak_Mangoli + curr.Anak_Mangoli,
			Boru_Muli: acc.Boru_Muli + curr.Boru_Muli,
			Bere_Mangoli: acc.Bere_Mangoli + curr.Bere_Mangoli,
			Pasahat: acc.Pasahat + curr.Pasahat,
			Manjalo: acc.Manjalo + curr.Manjalo,
			Resepsi: acc.Resepsi + curr.Resepsi,
			M123: acc.M123 + curr.M123,
			totalmenikah: acc.totalmenikah + curr.totalmenikah,
			Ama: acc.Ama + curr.Ama,
			Ina: acc.Ina + curr.Ina,
			Hela: acc.Hela + curr.Hela,
			Boru: acc.Boru + curr.Boru,
			Anak_Boru: acc.Anak_Boru + curr.Anak_Boru,
			Dakdanak: acc.Dakdanak + curr.Dakdanak,
			totalmeninggal: acc.totalmeninggal + curr.totalmeninggal,
			total: acc.total + curr.total,
		};
	}, {
		Anak_Mangoli: 0,
		Boru_Muli: 0,
		Bere_Mangoli: 0,
		Pasahat: 0,
		Manjalo: 0,
		Resepsi: 0,
		M123: 0,
		totalmenikah: 0,
		Ama: 0,
		Ina: 0,
		Hela: 0,
		Boru: 0,
		Anak_Boru: 0,
		Dakdanak: 0,
		totalmeninggal: 0,
		total: 0,
	});

	return countObj
}

module.exports = {
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
}