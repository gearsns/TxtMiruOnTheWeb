import { TxtMiruSiteManager } from './TxtMiruSitePlugin.js?1.5'
import { TxtMiruLoading } from './TxtMiruLoading.js'
import { TxtMiruMessageBox } from "./TxtMiruMessageBox.js"

export class TxtMiruFavorite {
	constructor(txtMiru) {
		this.txtMiru = txtMiru
		this.txtMiruDB = txtMiru.txtMiruDB
		this.txtMiruLoading = new TxtMiruLoading()
		this.favoriteElement = document.createElement("div")
		this.favoriteElement.className = "hide-favorite"
		this.favoriteElement.innerHTML = `
<div id="favorite-box-inner" class="favorite-box-inner">
<button id="favorite-regist">追加</button>
<button id="favorite-delete" class="delete">削除</button>
<button id="favorite-update" class="update">最新の情報に更新</button>
<button id="favorite-first" class="goto">トップから</button>
<button id="favorite-continue" class="goto2">続きから</button>
	<div class="sticky_table">
		<table id="novel_list" class="sticky_table">
			<thead>
				<tr><th>#<th colspan="3">ページ<th>タイトル<br>著者<th>掲載
			</thead>
			<tbody id="novel_list_body"></tbody>
		</table>
	</div>
</div>`.replace(/[\r\n]/g, "")
		document.body.appendChild(this.favoriteElement)
		this.urlElement = document.createElement("div")
		this.urlElement.className = "hide-input-url"
		this.urlElement.innerHTML = `<div class="input-box-outer" id="input-favorite-box-outer"><div class="input-box-inner" id="input-favorite-box-inner">
<dl>
<dt>URL または 小説家になろうのNコードを指定してください。
<dd>
<input class="url" name="url" id="input-favorite-url">
</dl>
<button id="save-favorite-url">登録</button>
</div></div>`
		document.body.appendChild(this.urlElement)
	}

	select_row = e => {
	}
	show = async (txtMiru) => {
		if (txtMiru.display_popup) {
			return
		}
		txtMiru.display_popup = true
		this.favoriteElement.className = "show-favorite"
		this.reload()
	}

	reload = async () => {
		const e_novel_list = document.getElementById("novel_list") 
		e_novel_list.style.visibility = "hidden"
		this.txtMiruLoading.begin()
		const list = await this.txtMiruDB.getFavoriteList()
		let tr_list = []
		let num = 0
		if (!list || list.length == 0) {
			tr_list.push(`<tr><td colspan="6" style="width:100vw">お気に入りが登録されていません。</td></tr>`)
		} else {
			for (let item of list) {
				++num
				let site_name = ""
				for (let site of TxtMiruSiteManager.SiteList()) {
					if (site.Match(item.url)) {
						site_name = site.Name()
						break
					}
				}
				if (item.max_page == -1) {
					item.max_page = 1
					item.cur_page = 1
				}
				tr_list.push(`<tr item_id="${item.id}" url="${item.url}" cur_url="${item.cur_url}"><th>${num}<div class="check"></div><td>${item.cur_page}<td>/<td>${item.max_page}<td class="novel_title">${item.name}<br>${item.author}<td>${site_name}`)
			}
		}
		e_novel_list.style.visibility = "visible"
		document.getElementById("novel_list_body").innerHTML = tr_list.join("")
		this.txtMiruLoading.end()
	}

	setCurrentPage = async (txtMiru, url) => {
		for (const site of TxtMiruSiteManager.SiteList()) {
			if (site.Match(url)) {
				const page = await site.GetPageNo(txtMiru, url)
				if (page && page.index_url) {
					const item = await this.txtMiruDB.getFavoriteByUrl(page.index_url)
					if (item && item.length > 0 && item[0].cur_page < page.page_no) {
						await this.txtMiruDB.setFavorite(item[0].id, { cur_page: page.page_no, cur_url: url })
					}
				}
				break
			}
		}
	}

	inputURL = () => {
		this.urlElement.className = "show-input-url"
		const url = (new URL(window.location)).searchParams.get('url')
		if (url == null) {
			document.getElementById("input-favorite-url").value = ""
		} else {
			document.getElementById("input-favorite-url").value = url
		}
		document.getElementById("input-favorite-url").focus()
		document.getElementById("input-favorite-url").select()
	}
	addSite = async (txtMiru) => {
		let url = document.getElementById("input-favorite-url").value
		if (url.match(/^n/)) {
			url = `https://ncode.syosetu.com/${url}`
		}
		for (const site of TxtMiruSiteManager.SiteList()) {
			if (site.Match(url)) {
				const page = await site.GetPageNo(txtMiru, url)
				if (page && page.url) {
					const item = await this.txtMiruDB.getFavoriteByUrl(page.index_url)
					if (item && item.length > 0) {
						if (item[0].cur_page < page.page_no) {
							await this.txtMiruDB.setFavorite(item[0].id, { cur_page: page.page_no, cur_url: url })
						} else {
							TxtMiruMessageBox.show(`${url}<br>は既に登録されています。`, { "buttons": ["閉じる"] }).then(e => { })
						}
					} else {
						const update_item = await site.GetInfo(txtMiru, page.index_url)
						if (update_item && update_item.name && update_item.name.length > 0) {
							await this.txtMiruDB.addFavorite(update_item.name, update_item.author, page.index_url, page.url, page.page_no, update_item.max_page, 0)
						} else {
							TxtMiruMessageBox.show(`ページ情報の取得に失敗しました。<br>${url}`, { "buttons": ["閉じる"] }).then(e => { })
						}
					}
					this.reload()
				}
				break
			}
		}
		this.urlElement.className = "hide-input-url"
	}
	setEvent = (txtMiru) => {
		// 画面内はクリックで閉じない
		document.getElementById("favorite-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		// 画面外をクリックで閉じる
		this.favoriteElement.addEventListener("click", e => {
			this.favoriteElement.className = "hide-favorite"
			txtMiru.display_popup = false
		})
		// お気に入りの追加
		document.getElementById("favorite-regist").addEventListener("click", e => {
			this.inputURL()
		})
		// 最新情報に更新
		document.getElementById("favorite-update").addEventListener("click", async e => {
			this.txtMiruLoading.begin()
			let url_list = []
			let tr_list = document.getElementById("novel_list_body").getElementsByTagName("TR")
			for (let tr of tr_list) {
				if (tr.className == "check_on") {
					let url = tr.getAttribute("url")
					if (url) {
						url_list.push(url)
					}
				}
			}
			if(url_list.length == 0){
				for (let tr of tr_list) {
					let url = tr.getAttribute("url")
					if (url) {
						url_list.push(url)
					}
				}
			}
			let results = []
			for (let site of TxtMiruSiteManager.SiteList()) {
				results = await site.GetInfo(txtMiru, url_list, item_list => {
					let arr = ["取得中..."]
					for(let url of item_list){
						let exists = false
						for (let tr of tr_list) {
							if(url == tr.getAttribute("url")){
								arr.push(tr.getElementsByClassName("novel_title")[0].innerText)
								exists = true
								break
							}
						}
						if(!exists){
							arr.push(url)
						}
					}
					this.txtMiruLoading.update(arr)
				})
				if (results) {
					for (let i = 0, c = url_list.length; i < c; ++i) {
						let url = url_list[i]
						for (let item of results) {
							if (item.url == url) {
								await this.txtMiruDB.setFavorite(tr_list[i].getAttribute("item_id") | 0, item)
							}
						}

					}
				}
			}
			this.txtMiruLoading.end()
			this.reload()
		})
		// 最初から
		document.getElementById("favorite-first").addEventListener("click", e => {
			for (let tr of document.getElementById("novel_list_body").getElementsByTagName("TR")) {
				if (tr.className == "check_on") {
					this.favoriteElement.className = "hide-favorite"
					txtMiru.display_popup = false
					txtMiru.LoadNovel(tr.getAttribute("url"))
					return
				}
			}
		})
		// 続きから
		document.getElementById("favorite-continue").addEventListener("click", e => {
			for (let tr of document.getElementById("novel_list_body").getElementsByTagName("TR")) {
				if (tr.className == "check_on") {
					this.favoriteElement.className = "hide-favorite"
					txtMiru.display_popup = false
					txtMiru.LoadNovel(tr.getAttribute("cur_url"))
					return
				}
			}
		})
		// URL入力 画面内はクリックで閉じない
		document.getElementById("input-favorite-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		// URL入力 画面外をクリックで閉じる
		document.getElementById("input-favorite-box-outer").addEventListener("click", e => {
			this.urlElement.className = "hide-input-url"
			txtMiru.display_popup = false
		})
		// 保存
		document.getElementById("save-favorite-url").addEventListener("click", e => { this.addSite(txtMiru) })
		document.getElementById("input-favorite-url").addEventListener("keydown", e => {
			if (e.code == "Enter") {
				this.addSite(txtMiru)
				e.preventDefault()
				e.stopPropagation()
			} else if (e.code == "Escape") {
				this.urlElement.className = "hide-input-url"
				txtMiru.display_popup = false
				e.preventDefault()
				e.stopPropagation()
			}
		})
		// 削除
		document.getElementById("favorite-delete").addEventListener("click", e => {
			let count = 0
			for (let tr of document.getElementById("novel_list_body").getElementsByTagName("TR")) {
				if (tr.className == "check_on") {
					++count
				}
			}
			if (count > 0) {
				TxtMiruMessageBox.show("選択されているページをお気に入りから削除します。", { "buttons": [{ text: "削除", className: "seigaiha_blue", value: "delete" }, "削除しない"] }).then(async e => {
					if (e == "delete") {
						for (let tr of document.getElementById("novel_list_body").getElementsByTagName("TR")) {
							if (tr.className == "check_on") {
								await this.txtMiruDB.deleteFavorite(tr.getAttribute("item_id") | 0)
							}
						}
						this.reload()
					}
				})
			} else {
				TxtMiruMessageBox.show("お気に入りから削除したいページを選択してください。", { "buttons": ["閉じる"] }).then(e => {
				})
			}
		})
		// 列ダブルクリックで続きから
		document.getElementById("novel_list_body").addEventListener("dblclick", e => {
			let tr = null
			if (e.target.tagName == "TD" || e.target.tagName == "TH") {
				tr = e.target.parentElement
			} else if (e.target.tagName == "TR") {
				tr = e.target
			}
			if (tr) {
				this.favoriteElement.className = "hide-favorite"
				txtMiru.display_popup = false
				txtMiru.LoadNovel(tr.getAttribute("cur_url"))
				return false
			}
		})
		// 列の選択
		document.getElementById("novel_list_body").addEventListener("click", e => {
			let tr = null
			if (e.target.tagName == "TD" || e.target.tagName == "TH") {
				tr = e.target.parentElement
			} else if (e.target.tagName == "TR") {
				tr = e.target
			}
			if (tr) {
				if (tr.className == "check_on") {
					tr.className = ""
				} else {
					tr.className = "check_on"
				}
			}
			return false
		})
	}
}
