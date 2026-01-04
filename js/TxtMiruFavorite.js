import { TxtMiruSiteManager } from './TxtMiruSitePlugin.js?1.0.20.1'
import { TxtMiruLoading } from './TxtMiruLoading.js?1.0.20.1'
import { TxtMiruMessageBox } from "./TxtMiruMessageBox.js?1.0.20.1"

export class TxtMiruFavorite {
	constructor(txtMiru) {
		this.favoriteList = []
		this.txtMiru = txtMiru
		this.txtMiruDB = txtMiru.txtMiruDB
		this.txtMiruLoading = new TxtMiruLoading(txtMiru)
		this.favoriteElement = document.createElement("div")
		this.favoriteElement.className = "hide-favorite"
		this.favoriteElement.innerHTML = `
<div id="favorite-box-inner" class="favorite-box-inner">
<button id="favorite-regist">追加</button>
<button id="favorite-delete" class="delete">削除</button>
<button id="favorite-update" class="update">最新の情報に更新</button>
<button id="favorite-first" class="goto">トップから</button>
<button id="favorite-continue" class="goto2">続きから</button>
<button id="favorite-close" class="seigaiha_blue">閉じる</button>
	<div class="sticky_table">
		<table id="novel_list" class="sticky_table">
			<thead id="novel_list_head">
				<tr><th><div name="list_no" style="height:100%">#</div><th colspan="3"><div name="page">ページ</div><th><div name="title"><div name="new" class="updated" style="display:inline">New</div>タイトル</div><div name="author">著者</div><th><div name="site">掲載</div>
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
<button id="save-favorite-url-close" class="seigaiha_blue">閉じる</button>
</div></div>`
		document.body.appendChild(this.urlElement)
		this.setEvent(txtMiru)
	}
	show = async _ => {
		if (this.txtMiru.display_popup) {
			return
		}
		this.txtMiru.display_popup = true
		this.favoriteElement.className = "show-favorite"
		this.reload()
	}
	dispList = _ => {
		const list = this.favoriteList
		const tr_list = []
		let num = 0
		try {
			if (!list || list.length === 0) {
				tr_list.push(`<tr><td colspan="6" style="width:100vw">お気に入りが登録されていません。</td></tr>`)
			} else {
				const column_name = this.txtMiru.setting["favorite-sort-column"]
				const column_name_order = this.txtMiru.setting["favorite-sort-column-order"]
				const order_dir = (column_name === column_name_order) ? 1 : -1
				if (column_name === "list_no") {
					list.sort((a, b) => (parseInt(a.id) - parseInt(b.id)) * order_dir)
				} else if (column_name === "title") {
					list.sort((a, b) => 
						a.name.localeCompare(b.name) * order_dir
						|| a.author.localeCompare(b.author)
						|| parseInt(a.id) - parseInt(b.id)
					)
				} else if (column_name === "page") {
					list.sort((a, b) =>
						(parseInt(a.max_page) - parseInt(b.max_page)) * order_dir
						|| a.name.localeCompare(b.name)
						|| a.author.localeCompare(b.author)
						|| parseInt(a.id) - parseInt(b.id)
					)
				} else if (column_name === "author") {
					list.sort((a, b) => 
						a.author.localeCompare(b.author) * order_dir
						|| a.name.localeCompare(b.name)
						|| parseInt(a.id) - parseInt(b.id)
					)
				} else if (column_name === "site") {
					list.sort((a, b) => 
						a.url.localeCompare(b.url) * order_dir
						|| parseInt(a.id) - parseInt(b.id)
					)
				} else if (column_name === "new") {
					list.sort((a, b) => {
						const a_new = parseInt(a.cur_page) < parseInt(a.max_page)
						const b_new = parseInt(b.cur_page) < parseInt(b.max_page)
						if (a_new && b_new) {
							return parseInt(a.id) - parseInt(b.id)
						}
						return a_new ? -order_dir : order_dir
					})
				}
				for (const item of list) {
					++num
					let site_name = ""
					for (const site of TxtMiruSiteManager.SiteList()) {
						if (site.Match(item.url)) {
							site_name = site.Name()
							break
						}
					}
					if (item.max_page === -1) {
						item.max_page = 1
						item.cur_page = 1
					}
					let tag_add = ""
					if (parseInt(item.cur_page) < parseInt(item.max_page)) {
						tag_add = `<span class="updated">New</span>`
					}
					if (item.source){
						site_name += `<br>${item.source}`
					}
					tr_list.push(`<tr item_id="${item.id}" url="${item.url}" cur_url="${item.cur_url}" source="${item.source}"><th>${num}<div class="check"></div><td>${item.cur_page}<td>/<td>${item.max_page}<td>${tag_add}<span class="novel_title">${item.name}</span><br>${item.author}<td>${site_name}`)
				}
			}
		} catch {
			this.favoriteList = []
			tr_list.push(`<tr><td colspan="6" style="width:100vw">お気に入りが登録されていません。</td></tr>`)
		}
		document.getElementById("novel_list_body").innerHTML = tr_list.join("")
	}
	reload = async _ => {
		const e_novel_list = document.getElementById("novel_list")
		e_novel_list.style.visibility = "hidden"
		this.txtMiruLoading.begin()
		this.favoriteList = await this.txtMiruDB.getFavoriteList()
		this.dispList()
		e_novel_list.style.visibility = "visible"
		this.txtMiruLoading.end()
	}
	inputURL = _ => {
		this.urlElement.className = "show-input-url"
		const el = document.getElementById("input-favorite-url")
		el.value = (new URL(window.location)).searchParams.get('url') || ""
		el.focus()
		el.select()
	}
	addSite = async txtMiru => {
		this.txtMiruLoading.begin()
		let url = document.getElementById("input-favorite-url").value
		if (url.match(/^n/)) {
			url = `https://ncode.syosetu.com/${url}`
		}
		for (const site of TxtMiruSiteManager.SiteList()) {
			if (!site.Match(url)) { continue; }
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
				await this.reload()
			}
			break
		}
		this.txtMiruLoading.end()
		this.urlElement.className = "hide-input-url"
	}
	setEvent = txtMiru => {
		const hideFavorite = _ => {
			this.favoriteElement.className = "hide-favorite"
			txtMiru.display_popup = false
		}
		// 画面内はクリックで閉じない
		document.getElementById("favorite-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		// 画面外をクリックで閉じる
		this.favoriteElement.addEventListener("click", hideFavorite)
		document.getElementById("favorite-close").addEventListener("click", hideFavorite)
		// お気に入りの追加
		document.getElementById("favorite-regist").addEventListener("click", this.inputURL)
		// 最新情報に更新
		document.getElementById("favorite-update").addEventListener("click", async e => {
			this.txtMiruLoading.begin()
			try {
				const url_list = []
				const tr_list = document.getElementById("novel_list_body").getElementsByTagName("TR")
				for (const tr of tr_list) {
					if (tr.className === "check_on") {
						const url = tr.getAttribute("url")
						if (url) {
							url_list.push(url)
						}
					}
				}
				if (url_list.length === 0) {
					for (const tr of tr_list) {
						if (tr.getAttribute("source")) {
							continue
						}
						const url = tr.getAttribute("url")
						if (url) {
							url_list.push(url)
						}
					}
				}
				let results = []
				for (const site of TxtMiruSiteManager.SiteList()) {
					results = await site.GetInfo(txtMiru, url_list, item_list => {
						const arr = ["取得中..."]
						for (const url of item_list) {
							let exists = false
							for (const tr of tr_list) {
								if (tr.className === "loading") {
									tr.className = "check_on"
								}
								if (url === tr.getAttribute("url")) {
									tr.className = "loading"
									arr.push(tr.getElementsByClassName("novel_title")[0].innerText)
									exists = true
									break
								}
							}
							if (!exists) {
								arr.push(url)
							}
						}
						this.txtMiruLoading.update(arr)
					})
					if (results) {
						for (const tr of tr_list) {
							const url = tr.getAttribute("url")
							for (const item of results) {
								if (item.url === url) {
									await this.txtMiruDB.setFavorite(tr.getAttribute("item_id") | 0, item)
								}
							}

						}
					}
				}
			} catch(e){
				console.log(e)
			}
			this.txtMiruLoading.end()
			this.reload()
		})
		const loadNovel = id => {
			for (const tr of document.getElementById("novel_list_body").getElementsByTagName("TR")) {
				if (tr.className === "check_on") {
					hideFavorite()
					txtMiru.LoadNovel(tr.getAttribute(id))
					return
				}
			}
		}
		// 最初から
		document.getElementById("favorite-first").addEventListener("click", e => { loadNovel("url") })
		// 続きから
		document.getElementById("favorite-continue").addEventListener("click", e => { loadNovel("cur_url") })
		// URL入力 画面内はクリックで閉じない
		document.getElementById("input-favorite-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		// URL入力 画面外をクリックで閉じる
		const hideInputUrl = _ => {
			this.urlElement.className = "hide-input-url"
			txtMiru.display_popup = false
		}
		document.getElementById("input-favorite-box-outer").addEventListener("click", hideInputUrl)
		document.getElementById("save-favorite-url-close").addEventListener("click", hideInputUrl)
		// 保存
		document.getElementById("save-favorite-url").addEventListener("click", e => { this.addSite(txtMiru) })
		document.getElementById("input-favorite-url").addEventListener("keydown", e => {
			if (e.code === "Enter") {
				this.addSite(txtMiru)
				e.preventDefault()
				e.stopPropagation()
			} else if (e.code === "Escape") {
				hideInputUrl()
				e.preventDefault()
				e.stopPropagation()
			}
		})
		// 削除
		document.getElementById("favorite-delete").addEventListener("click", e => {
			let count = 0
			for (const tr of document.getElementById("novel_list_body").getElementsByTagName("TR")) {
				if (tr.className === "check_on") {
					++count
				}
			}
			if (count > 0) {
				TxtMiruMessageBox.show("選択されているページをお気に入りから削除します。", { "buttons": [{ text: "削除", className: "seigaiha_blue", value: "delete" }, "削除しない"] }).then(async e => {
					if (e === "delete") {
						this.txtMiruLoading.begin()
						for (const tr of document.getElementById("novel_list_body").getElementsByTagName("TR")) {
							if (tr.className === "check_on") {
								await this.txtMiruDB.deleteFavorite(tr.getAttribute("item_id") | 0)
							}
						}
						this.txtMiruLoading.end()
						this.reload()
					}
				})
			} else {
				TxtMiruMessageBox.show("お気に入りから削除したいページを選択してください。", { "buttons": ["閉じる"] }).then(e => {
				})
			}
		})
		// ソート
		document.getElementById("novel_list_head").addEventListener("click", e => {
			let target = null
			if (e.target.tagName === "DIV") {
				target = e.target
			} else if (e.target.tagName === "TD" || e.target.tagName === "TH") {
				target = e.target.children[0]
			} else {
				return false
			}
			if (target) {
				if (txtMiru.setting["favorite-sort-column-order"] === target.getAttribute("name")) {
					txtMiru.setting["favorite-sort-column-order"] = ""
				} else {
					txtMiru.setting["favorite-sort-column-order"] = target.getAttribute("name")
				}
				txtMiru.setting["favorite-sort-column"] = target.getAttribute("name")
				txtMiru.saveSetting().then(_ => txtMiru.reflectSetting).catch(_ => {})
				this.dispList()
			}
			return false
		})
		const getTrElement = e => {
			if (e.target.tagName === "TD" || e.target.tagName === "TH") {
				return e.target.parentElement
			} else if (e.target.tagName === "TR") {
				return e.target
			}
			return null
		}
		// 行ダブルクリックで続きから
		document.getElementById("novel_list_body").addEventListener("dblclick", e => {
			const tr = getTrElement(e)
			if (tr) {
				hideFavorite()
				const url = tr.getAttribute("cur_url") || tr.getAttribute("url")
				txtMiru.LoadNovel(url)
				return false
			}
		})
		// 行の選択
		document.getElementById("novel_list_body").addEventListener("click", e => {
			const tr = getTrElement(e)
			if (tr) {
				tr.className = tr.className === "check_on" ? "" : "check_on"
			}
			return false
		})
	}
}
