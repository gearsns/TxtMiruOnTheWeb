import Dexie from './lib/dexie.js'

export class TxtMiruDB {
	constructor(txtMiru) {
		this.txtMiru = txtMiru
	}
	connect = async () => {
		this.db = new Dexie("TxtMiru")
		this.db.version(1).stores({
			Favorite: "++id,name,author,url,cur_url,cur_page,max_page",
			Setting: "id,value"
		})
	}
	add = async item => await this.connection.insert(item)
	select = async item => await this.connection.select(item)
	getSettingList = async () => await this.db.Setting.toArray()
	setSetting = async (item) => {
		if (Array.isArray(item)) {
			return await this.db.transaction('rw', this.db.Setting, async () => {
				for (const i of item) {
					await this.db.Setting.put(i)
				}
			})
		}
		return await this.db.Setting.put(item)
	}
	addFavorite = async (name, author, url, cur_url, cur_page, max_page) => {
		if (this.txtMiru.setting["UserID"]) {
			const server = this.txtMiru.setting["WebServerUrl"]
			const req_url = `${server}?${new URLSearchParams(
				{
					func: "add_favorite",
					uid: this.txtMiru.setting["UserID"],
					name: name,
					author: author,
					url: url,
					cur_url: cur_url,
					cur_page: cur_page,
					max_page: max_page,
					_no_cache_: Date.now().toString()
				})}`
			return await fetch(req_url)
				.then(response => response.json())
				.then(json => json["result"])
				.catch(e => null)
		}
		return await this.db.Favorite.add({
			name: name,
			author: author,
			url: url,
			cur_url: cur_url,
			cur_page: cur_page,
			max_page: max_page
		})
	}
	getFavoriteList = async () => {
		if (this.txtMiru.setting["UserID"]) {
			const server = this.txtMiru.setting["WebServerUrl"]
			const req_url = `${server}?${new URLSearchParams({ func: "get_favorites", uid: this.txtMiru.setting["UserID"], _no_cache_: Date.now().toString() })}`
			return await fetch(req_url)
				.then(response => response.json())
				.then(json => json["values"])
				.catch(e => null)
		}
		return await this.db.Favorite.toArray()
	}
	getFavoriteByUrl = async url => {
		if (this.txtMiru.setting["UserID"]) {
			const server = this.txtMiru.setting["WebServerUrl"]
			const req_url = `${server}?${new URLSearchParams({ func: "get_favorite_by_url", uid: this.txtMiru.setting["UserID"], url: url, _no_cache_: Date.now().toString() })}`
			return await fetch(req_url)
				.then(response => response.json())
				.then(json => json["values"])
				.catch(e => null)
		}
		return await this.db.Favorite.where({ url: url }).toArray()
	}
	setFavorite = async (id, item) => {
		if (this.txtMiru.setting["UserID"]) {
			let data = Object.assign({}, item)
			data.func = "update_favorite"
			data.uid = this.txtMiru.setting["UserID"]
			data.id = id
			data._no_cache_ = Date.now().toString()
			const server = this.txtMiru.setting["WebServerUrl"]
			const req_url = `${server}?${new URLSearchParams(data)}`
			return await fetch(req_url)
				.then(response => response.json())
				.then(json => json["result"])
				.catch(e => null)
		}
		return await this.db.Favorite.update(id, item)
	}
	deleteFavorite = async id => {
		if (this.txtMiru.setting["UserID"]) {
			const server = this.txtMiru.setting["WebServerUrl"]
			const req_url = `${server}?${new URLSearchParams(
				{
					func: "delete_favorite",
					uid: this.txtMiru.setting["UserID"],
					id: id,
					_no_cache_: Date.now().toString()
				})}`
			return await fetch(req_url)
				.then(response => response.json())
				.then(json => json["result"])
				.catch(e => null)
		}
		return await this.db.Favorite.delete(id)
	}
}