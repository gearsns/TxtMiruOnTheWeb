import { TxtMiruSiteManager } from './TxtMiruSitePlugin.js?1.0.10.0'
import { TxtMiruFavorite } from './TxtMiruFavorite.js?1.0.10.0'
import { TxtMiruLocalFile } from './TxtMiruLocalFile.js?1.0.10.0'
import { TxtMiruInputURL } from './TxtMiruInputURL.js?1.0.10.0'
import { TxtMiruLoading } from './TxtMiruLoading.js?1.0.10.0'
import { TxtMiruConfig } from './TxtMiruConfig.js?1.0.10.0'
import { TxtMiruDB } from './TxtMiruDB.js?1.0.10.0'

const TxtMiruTitle = "TxtMiru on the Web"
// DOM
// 絶対位置の取得
const cumulativeOffset = element => {
	let top = 0, left = 0
	do {
		top += element.offsetTop || 0
		left += element.offsetLeft || 0
		element = element.offsetParent
	} while (element)
	return {
		top: top,
		left: left
	}
}
// 文字ごとの座標を取得
const retrieveCharactersRects = elem => {
	let results = []
	if (elem.nodeType == elem.TEXT_NODE) {
		const range = elem.ownerDocument.createRange()
		range.selectNodeContents(elem)
		for (let current_pos = 0, end_pos = range.endOffset; current_pos + 1 < end_pos; ++current_pos) {
			range.setStart(elem, current_pos)
			range.setEnd(elem, current_pos + 1)
			results.push({
				character: range.toString(),
				rect: range.getBoundingClientRect()
			})
		}
		range.detach()
		return results
	} else {
		for (let i = 0, n = elem.childNodes.length; i < n; ++i) {
			results.push(retrieveCharactersRects(elem.childNodes[i]))
		}
		return Array.prototype.concat.apply([], results)
	}
}

export class TxtMiru {
	set_scroll_pos_state_timer_id = null
	scroll_timer_id = null
	scroll_timer_func = null
	touchTimer = null
	touchCount = 0
	display_popup = false
	cache_list = []
	default_setting = {
		"WebServerUrl": "https://script.google.com/macros/s/AKfycbxf6f5omc-p0kTdmyPh92wdpXv9vfQBqa9HJYtypTGD5N5Aqf5S5CWf-yQ6x6sIj4pf3g/exec"
	}
	setting = {...this.default_setting}

	constructor(main_id) {
		this.mainElement = document.getElementById(main_id)
		this.mainElement.setAttribute("tabindex", 1)
		this.mainElement.innerHTML = `<div class="prev-episode"></div><div id="contents" class="contents"><p style="width:100vw"></p></div><div class="next-episode"></div>`
		this.contentsElement = document.getElementById("contents")
		//
		this.txtMiruDB = new TxtMiruDB(this)
		new Promise((resolve, reject) => {
			resolve(this.txtMiruDB.connect())
		}).then(ret => {
			this.txtMiruDB.getSettingList().then(ret => {
				if (ret) {
					for (const item of ret) {
						this.setting[item.id] = item.value
					}
				}
			}).finally(() => {
				TxtMiruSiteManager.txtMiru = this
				this.txtMiruLoading = new TxtMiruLoading()
				this.txtMiruLocalFile = new TxtMiruLocalFile(this)
				this.txtMiruInputURL = new TxtMiruInputURL(this)
				this.txtMiruFavorite = new TxtMiruFavorite(this)
				this.txtMiruConfig = new TxtMiruConfig(this)
				//
				this.setKeyBind()
				this.setEvent()
				//
				this.reflectSetting()
				//
				const url = new URL(window.location)
				this.LoadNovel(url.searchParams.get('url'), url.searchParams.get('scroll_pos'), true)
			})
		})
	}
	defaultSetting = () => this.default_setting
	reflectSetting = () => {
		const el = document.getElementById("TxtMiruMain")
		let classNameList = []
		for (const cn of el.className.split(/ +/)) {
			if (!cn.match(/^zoom/)) {
				classNameList.push(cn)
			}
		}
		if (this.setting["font-size"] == "large") {
			classNameList.push("zoom_p1")
		} else if (this.setting["font-size"] == "small") {
			classNameList.push("zoom_m1")
		}
		el.className = classNameList.join(" ")
		//
		if (this.setting["theme"] == "dark") {
			document.body.className = "dark"
		} else {
			document.body.className = ""
		}
		if (this.setting["menu-position"] == "bottom") {
			document.body.className += " bottom_menu"
		}
		this.setupWebsock(this.setting["WebSocketServerUrl"])
	}
	//
	txtmiru_websocket = null
	setupWebsock = url => {
		try {
			if(this.txtmiru_websocket){
				this.txtmiru_websocket.close()
			}
			this.txtmiru_websocket = null
			if(!url || url.length == 0){
				return
			}
			let sock = new WebSocket(url)
			sock.addEventListener("message", e => {
				try {
					let item = JSON.parse(e.data)
					if(item.url){
						const url = item.url.replace(/(#.*$)/, "")
						const name = RegExp.$1
						item.url = url
						this.addCache(item)
						this.LoadNovel(url, name, true)
					} else {
						this.addCache(item)
					}
				} catch{}
			})
			sock.addEventListener("close", this.txtmiru_websocket = null)
			this.txtmiru_websocket = sock
			sock.addEventListener("open", e => {
				this.txtmiru_websocket.send(JSON.stringify({reload: true}))
			})
		} catch {
			this.txtmiru_websocket = null
		}
	}
	//
	saveSetting = () => {
		let item_list = []
		for (const key of Object.keys(this.setting)) {
			item_list.push({ id: key, value: this.setting[key] })
		}
		return this.txtMiruDB.setSetting(item_list)
	}
	//
	getCache = () => this.cache_list
	addCache = item => {
		for(let i=0, l = this.cache_list.length; i<l; ++i){
			if(item.url && this.cache_list[i].url == item.url){
				this.cache_list[i] = item
				return
			}
		}
		this.cache_list.push(item)
	}
	///////////////////////////////
	// ページ移動
	// アニメーションでスクロール
	scrollToAnim = scroll_last => {
		const el = this.mainElement
		const height = scroll_last - el.scrollLeft
		const count = 10
		const scroll_step = height / count
		let index = 0
		const loop = () => {
			this.restartScrollTimeout()
			if (index < count) {
				++index
				el.scrollBy(scroll_step, 0)
				requestAnimationFrame(loop)
			} else {
				if (height < 0) {
					if (el.scrollLeft < scroll_last) {
						return
					}
				} else {
					if (el.scrollLeft > scroll_last) {
						return
					}
				}
				el.scrollTo(scroll_last, 0)
			}
		}
		requestAnimationFrame(loop)
	}
	// タイマー処理再スタート
	restartScrollTimeout = () => {
		if (this.scroll_timer_id) {
			clearTimeout(this.scroll_timer_id)
			this.scroll_timer_id = setTimeout(this.scroll_timer_func, 100)
		}
	}
	//
	pagePrev = () => {
		if (this.scroll_timer_id) {
			clearTimeout(this.scroll_timer_id)
		}
		const el = this.mainElement
		this.scrollToAnim(el.scrollLeft + el.clientWidth)
		this.scroll_timer_func = this.fixPagePrev
		this.scroll_timer_id = setTimeout(this.fixPagePrev, 100)
	}
	pageNext = () => {
		if (this.scroll_timer_id) {
			clearTimeout(this.scroll_timer_id)
		}
		const el = this.mainElement
		this.scrollToAnim(el.scrollLeft - el.clientWidth)
		this.scroll_timer_func = this.fixPageNext
		this.scroll_timer_id = setTimeout(this.fixPageNext, 100)
	}
	pageTop = () => this.scrollToAnim(this.mainElement.scrollWidth)
	pageEnd = () => this.scrollToAnim(-this.mainElement.scrollWidth)
	//
	gotoAttributeUrl = name => {
		const el = this.contentsElement
		if (el.hasAttribute(name)) {
			const url = el.getAttribute(name)
			if (url && url.length > 0) {
				this.LoadNovel(url)
			}
		}
	}
	gotoNextEpisode = () => this.gotoAttributeUrl("next-episode")
	gotoPrevEpisode = () => this.gotoAttributeUrl("prev-episode")
	gotoIndex = () => this.gotoAttributeUrl("episode-index")
	//
	fixPagePrev = () => this.fixPageNext()
	fixPageNext = () => {
		this.scroll_timer_id = null
		const el = this.mainElement
		const abl_pos = cumulativeOffset(el)
		const right = abl_pos.left + el.clientWidth
		const pos = el.scrollLeft
		const targets = new Set()
		for (let x = 1; x < 3; x++) {
			for (let i = 0; i < el.clientHeight; i += 10) {
				const t = document.elementsFromPoint(right - x, abl_pos.top + i)
				if (t.length > 3 && el.contains(t[0])) {
					targets.add(t[0])
					break
				}
			}
		}
		let offset = 0
		for (const item of targets) {
			for (const ch of retrieveCharactersRects(item)) {
				const item_right = ch.rect.right + ch.rect.width / 2.3
				if (ch.rect.left < right && right < item_right) {
					if (offset < item_right - right) {
						offset = item_right - right
					}
				}
			}
		}
		el.scrollTo(pos + offset, 0)
	}
	//
	setHistory = (cur_url, title) => {
		if(!cur_url.searchParams.get("url")){
			return
		}
		let history = this.setting["history"]
		if(history){
			const check_url = cur_url.searchParams.get("url")
			let buf_history = []
			buf_history.push({url: cur_url.searchParams.get("url"), name: title, scroll_pos: cur_url.searchParams.get("scroll_pos")})
			for(const item of JSON.parse(history)){
				if(item.url !== check_url){
					buf_history.push(item)
				}
			}
			if(buf_history.length > 5){
				buf_history.length = 5
			}
			this.setting["history"] = JSON.stringify(buf_history)
		} else {
			this.setting["history"] = JSON.stringify([{url: cur_url.searchParams.get("url"), name: title, scroll_pos: cur_url.searchParams.get("scroll_pos")}])
		}
		this.txtMiruDB.setSetting([{ id: "history", value: this.setting["history"] }])
	}
	setScrollPosState = () => {
		clearTimeout(this.set_scroll_pos_state_timer_id)
		const cur_url = new URL(window.location)
		const title = document.title
		cur_url.searchParams.set('scroll_pos', this.mainElement.scrollLeft / this.mainElement.scrollWidth)
		const state = {
			'TxtMiru': true
		}
		window.history.replaceState(state, title, cur_url)
		this.setHistory(cur_url, title)
	}
	//
	loadLocalFile = () => this.txtMiruLocalFile.show(this)
	inputURL = () => this.txtMiruInputURL.show(this)
	//
	showFavorite = () => this.txtMiruFavorite.show(this)
	//
	showConfig = () => this.txtMiruConfig.show(this)
	//
	key_mapping = {
		"Shift+Space": (e) => this.pagePrev(),
		"Space": (e) => this.pageNext(),
		"PageUp": (e) => this.pagePrev(),
		"PageDown": (e) => this.pageNext(),
		"Home": (e) => this.pageTop(),
		"End": (e) => this.pageEnd(),
		"KeyL": (e) => this.inputURL(),
		"KeyO": (e) => this.loadLocalFile(),
		"KeyF": (e) => this.showFavorite(),
		"KeyC": (e) => this.showConfig(),
		"Ctrl+ArrowLeft": (e) => this.gotoNextEpisode(),
		"Ctrl+ArrowRight": (e) => this.gotoPrevEpisode(),
	}
	//
	setKeyBind = () => {
		this.isComposing = false
		document.addEventListener("compositionstart", e => { this.isComposing = true })
		document.addEventListener("compositionend", e => { this.isComposing = false })
		document.addEventListener("keydown", e => {
			if (!this.display_popup && !this.isComposing) {
				let code = e.code
				if (e.shiftKey) {
					code = `Shift+${code}`
				}
				if (e.altKey) {
					code = `Alt+${code}`
				}
				if (e.metaKey) {
					code = `Meta+${code}`
				}
				if (e.ctrlKey) {
					code = `Ctrl+${code}`
				}
				const func = this.key_mapping[code]
				if (func) {
					func(e)
					e.preventDefault()
					e.stopPropagation()
				}
			}
		})
		this.mainElement.addEventListener("scroll", e => {
			if (this.set_scroll_pos_state_timer_id) {
				clearTimeout(this.set_scroll_pos_state_timer_id)
			}
			this.set_scroll_pos_state_timer_id = setTimeout(this.setScrollPosState, 500)
		})
		this.mainElement.addEventListener("wheel", e => {
			if (!this.display_popup) {
				const el = this.mainElement
				if (e.deltaY < 0) {
					this.scrollToAnim(el.scrollLeft + el.clientWidth * 0.1)
				} else {
					this.scrollToAnim(el.scrollLeft - el.clientWidth * 0.1)
				}
			}
		}, { passive: true })
		this.mainElement.addEventListener("mousewheel", e => {
			if (!this.display_popup) {
				const el = this.mainElement
				if (e.wheelDelta > 0) {
					this.scrollToAnim(el.scrollLeft + el.clientWidth * 0.1)
				} else {
					this.scrollToAnim(el.scrollLeft - el.clientWidth * 0.1)
				}
			}
		}, { passive: true })
	}
	///////////////////////////////
	// イベント
	setEvent = () => {
		window.addEventListener("load", e => {
			const url = new URL(window.location)
			this.LoadNovel(url.searchParams.get('url'), url.searchParams.get('scroll_pos'), true)
		})
		window.addEventListener("popstate", e => {
			const url = new URL(window.location)
			this.LoadNovel(url.searchParams.get('url'), url.searchParams.get('scroll_pos'), true)
		})
		//
		this.txtMiruLocalFile.setEvent(this)
		this.txtMiruInputURL.setEvent(this)
		this.txtMiruFavorite.setEvent(this)
		this.txtMiruConfig.setEvent(this)
	}
	//
	pageInfo = async url => {
		if (!url) {
			const cur_url = new URL(window.location)
			url = cur_url.searchParams.get('url')
			if (!url) {
				return
			}
		}
		for (const site of TxtMiruSiteManager.SiteList()) {
			if (site.Match(url)) {
				return site.Info(url)
			}
		}
		return null
	}
	setTxtMiruIndexSite = () => {
		document.getElementById("contents").innerHTML = document.getElementById("TxtMiruTopContents").innerHTML
		const oldPrevFunc = this.prevFunc
		for (const el of this.mainElement.getElementsByClassName("prev-episode")) {
			el.innerHTML = `<a href="./index.html">${TxtMiruTitle}</a>`
			if (oldPrevFunc) {
				el.removeEventListener("click", oldPrevFunc)
			}
		}
		this.prevFunc = null
		//
		const oldNextFunc = this.nextFunc
		for (const el of this.mainElement.getElementsByClassName("next-episode")) {
			el.innerHTML = `<a href="./index.html">${TxtMiruTitle}</a>`
			if (oldNextFunc) {
				el.removeEventListener("click", oldNextFunc)
			}
		}
		this.nextFunc = null
		//
		let history = this.setting["history"]
		if(history){
			history = JSON.parse(history)
			let i = 0
			for(const item of history){
				++i
				const el = document.getElementById(`TxtMiruTopContentsHistory${i}`)
				if(el){
					el.style.display = "block"
					el.innerHTML = `${i}. <a href='${item.url}' id='TxtMiruTopContentsHistoryAnchor${i}'>${item.name}</a>`
					const el_a = document.getElementById(`TxtMiruTopContentsHistoryAnchor${i}`)
					el_a.addEventListener("click", e => {
						e.preventDefault()
						e.stopPropagation()
						this.LoadNovel(`${item.url}`, parseFloat(item.scroll_pos))
					})
				}
			}
			const el = document.getElementById(`TxtMiruTopContentsHistoryList`)
			if(i > 0 && el){
				el.style.display = "block"
			}
		}
	}
	//
	LoadNovel = (url, scroll_pos = 0, no_history = false) => {
		//
		const old_url = new URL(window.location)
		const title = document.title
		if (!no_history) {
			old_url.searchParams.set('scroll_pos', this.mainElement.scrollLeft / this.mainElement.scrollWidth)
			const state = {
				'TxtMiru': true
			}
			history.replaceState(state, title, old_url)
			history.pushState(state, title, old_url)
			this.setHistory(old_url, title)
		}
		//
		this.contentsElement.setAttribute("prev-episode", "")
		this.contentsElement.setAttribute("next-episode", "")
		this.contentsElement.setAttribute("episode-index", "")
		if (!url) {
			this.setTxtMiruIndexSite()
			//
			old_url.searchParams.get('url')
			if (!url) {
				return
			}
			scroll_pos = old_url.searchParams.get('scroll_pos')
		}
		//
		this.txtMiruLoading.begin()
		this.txtMiruFavorite.setCurrentPage(this, url)
		TxtMiruSiteManager.GetDocument(this, url).then(item => {
			if (item == null) {
				return
			}
			for (const key of ["className", "prev-episode", "next-episode", "episode-index", "next-episode-text", "prev-episode-text", "episode-index-text"]) {
				const v = item[key]
				if (v == null || v == "undefined") {
					item[key] = ""
				}
			}
			if (item["next-episode-text"].length == 0 && item["next-episode"].length > 0) {
				item["next-episode-text"] = "次へ"
			}
			if (item["prev-episode-text"].length == 0 && item["prev-episode"].length > 0) {
				item["prev-episode-text"] = "前へ"
			}
			if (item["episode-index-text"].length == 0 && item["episode-index"].length > 0) {
				item["episode-index-text"] = "目次へ"
			}
			if (item["next-episode-text"].length == 0 && item["episode-index-text"].length == 0) {
				item["next-episode"] = "./index.html"
				item["next-episode-text"] = TxtMiruTitle
			}
			if (item["prev-episode-text"].length == 0 && item["episode-index-text"].length == 0) {
				item["prev-episode"] = "./index.html"
				item["prev-episode-text"] = TxtMiruTitle
			}
			if (item["episode-index-text"].length == 0) {
				item["episode-index"] = "./index.html"
				item["episode-index-text"] = TxtMiruTitle
			}
			if (!no_history) {
				const state = {
					'TxtMiru': true
				}
				const new_url = new URL(window.location)
				new_url.searchParams.set('url', url)
				new_url.searchParams.set('scroll_pos', scroll_pos)
				window.history.replaceState(state, document.title, new_url)
			}
			this.contentsElement.className = `contents ${item["className"]}`
			let html = item.html
			if (html == "undefined") {
				html = `<P>${url}</P><P>ページにつながりませんでした。</P>`
				item["prev-episode"] = "./index.html"
				item["next-episode"] = "./index.html"
				item["episode-index"] = "./index.html"
				item["next-episode-text"] = TxtMiruTitle
				item["prev-episode-text"] = TxtMiruTitle
				item["episode-index-text"] = TxtMiruTitle
			}
			this.contentsElement.setAttribute("prev-episode", item["prev-episode"])
			this.contentsElement.setAttribute("next-episode", item["next-episode"])
			this.contentsElement.setAttribute("episode-index", item["episode-index"])
			this.contentsElement.innerHTML = html
			for (const el_a of this.contentsElement.getElementsByTagName("A")) {
				const href = el_a.getAttribute("href")
				if (href && href.match(/^(?:http|https|txtmiru):\/\//i)) {
					let support = false
					for (let site of TxtMiruSiteManager.SiteList()) {
						if (site.Match(href)) {
							support = true
							break
						}
					}
					if (support) {
						el_a.addEventListener("click", e => {
							e.preventDefault()
							e.stopPropagation()
							this.LoadNovel(`${href}`)
						})
					}
				} else if (href && href.match(/^#(.*)/)) {
					const name = RegExp.$1
					el_a.addEventListener("click", e => {
						e.preventDefault()
						e.stopPropagation()
						const target_list = document.getElementsByName(name)
						if (target_list.length > 0) {
							this.mainElement.scrollTo(-this.mainElement.clientWidth + target_list[0].getBoundingClientRect().right, 0)
						}
					})
				}
			}
			for (const el of this.mainElement.getElementsByClassName("prev-episode")) {
				if (item["prev-episode"]) {
					el.innerHTML = `<a href="${item["prev-episode"]}" class="${item["className"]}">${item["prev-episode-text"]}</a>`
				} else if (item["episode-index"]) {
					el.innerHTML = `<a href="${item["episode-index"]}" class="${item["className"]}">${item["episode-index-text"]}</a>`
				}
			}
			for (const el of this.mainElement.getElementsByClassName("next-episode")) {
				if (item["next-episode"]) {
					el.innerHTML = `<a href="${item["next-episode"]}" class="${item["className"]}">${item["next-episode-text"]}</a>`
				} else if (item["episode-index"]) {
					el.innerHTML = `<a href="${item["episode-index"]}" class="${item["className"]}">${item["episode-index-text"]}</a>`
				}
			}
			const oldPrevFunc = this.prevFunc
			this.prevFunc = e => {
				e.preventDefault()
				e.stopPropagation()
				if (item["prev-episode"]) {
					this.LoadNovel(`${item["prev-episode"]}`)
				} else if (item["episode-index"]) {
					this.LoadNovel(`${item["episode-index"]}`)
				}
			}
			for (const el of this.mainElement.getElementsByClassName("prev-episode")) {
				if (oldPrevFunc) {
					el.removeEventListener("click", oldPrevFunc)
				}
				el.addEventListener("click", this.prevFunc)
			}
			const oldNextFunc = this.nextFunc
			this.nextFunc = e => {
				e.preventDefault()
				e.stopPropagation()
				if (item["next-episode"]) {
					this.LoadNovel(`${item["next-episode"]}`)
				} else if (item["episode-index"]) {
					this.LoadNovel(`${item["episode-index"]}`)
				}
			}
			for (const el of this.mainElement.getElementsByClassName("next-episode")) {
				if (oldNextFunc) {
					el.removeEventListener("click", oldNextFunc)
				}
				el.addEventListener("click", this.nextFunc)
			}
			if(typeof scroll_pos == "string"){
				const anchor_name = scroll_pos.replace(/#/, "")
				const target_list = document.getElementsByName(anchor_name)
				scroll_pos = this.mainElement.scrollWidth
				const offset = (anchor_name === "current_line") ? this.mainElement.clientWidth / 2 : 0
				if (target_list.length > 0) {
					scroll_pos = -this.mainElement.clientWidth + target_list[0].getBoundingClientRect().right + this.mainElement.scrollLeft + offset
				} else {
					const target = document.getElementById(anchor_name)
					if (target) {
						scroll_pos = -this.mainElement.clientWidth + target.getBoundingClientRect().right + this.mainElement.scrollLeft + offset
					}
				}
				this.mainElement.scrollTo(scroll_pos, 0)
			} else if (scroll_pos) {
				this.mainElement.scrollTo(this.mainElement.scrollWidth * scroll_pos, 0)
			} else {
				this.mainElement.scrollTo(this.mainElement.scrollWidth, 0)
			}
			this.setHistory(new URL(window.location), document.title)
		}).catch(err => {
			this.setTxtMiruIndexSite()
		}).finally(() => {
			this.mainElement.focus()
			this.txtMiruLoading.end()
		})
	}
}
