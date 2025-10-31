import { TxtMiruSiteManager } from './TxtMiruSitePlugin.js?1.0.19.0'
import { TxtMiruFavorite } from './TxtMiruFavorite.js?1.0.19.0'
import { TxtMiruLocalFile } from './TxtMiruLocalFile.js?1.0.19.0'
import { TxtMiruInputURL } from './TxtMiruInputURL.js?1.0.19.0'
import { TxtMiruLoading } from './TxtMiruLoading.js?1.0.19.0'
import { TxtMiruConfig } from './TxtMiruConfig.js?1.0.19.0'
import { TxtMiruDB } from './TxtMiruDB.js?1.0.19.0'

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
const retrieveCharactersRectsRange = (elem, left, right) => {
	const treeWalker = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT)
	const results = []
	while(treeWalker.nextNode())
	{
		const target = treeWalker.currentNode
		if (target.parentElement && target.nodeValue.trim().length > 0) {
			const topElementRect = target.parentElement.getBoundingClientRect()
			if (topElementRect.left <= right && topElementRect.right >= left){
				const range = target.ownerDocument.createRange()
				range.selectNodeContents(target)
				range.setStart(target, 0)
				range.setEnd(target, range.endOffset)
				const r = range.getBoundingClientRect()
				if (r.left <= right && r.right >= left && r.width > 0 && r.height > 0){
					for (let current_pos = 0, end_pos = range.endOffset; current_pos < end_pos; ++current_pos) {
						range.setStart(target, current_pos)
						range.setEnd(target, current_pos + 1)
						results.push({
							character: target.data[current_pos],
							rect: range.getBoundingClientRect()
						})
					}
				}
				range.detach()
			}
		}
	}
	return results
}
const retrieveCharactersRects = elem => {
	let results = []
	if (elem.nodeType == elem.TEXT_NODE) {
		const range = elem.ownerDocument.createRange()
		range.selectNodeContents(elem)
		range.setStart(elem, 0)
		range.setEnd(elem, range.endOffset)
		const r = range.getBoundingClientRect()
		if(r.x > -100 && r.height > 0 && r.width > 0 && r.x <= window.innerWidth + 50){
			for (let current_pos = 0, end_pos = range.endOffset; current_pos < end_pos; ++current_pos) {
				range.setStart(elem, current_pos)
				range.setEnd(elem, current_pos + 1)
				results.push({
					character: elem.data[current_pos],
					rect: range.getBoundingClientRect()
				})
			}
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

// getCache : loalfile
class CacheFiles {
	#cache = []
	Get = url => {
		for(const item of this.#cache){
			if(item.url === url){
				return item
			}
		}
		return null
	}
	Set = item => {
		if (this.#cache.length > 10) {
			this.#cache.shift()
		}
		this.#cache.push(item)
	}
	SetHtml = (url, html) => this.Set({ url: url, html: html })
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
		"WebServerUrl": "https://script.google.com/macros/s/AKfycbxf6f5omc-p0kTdmyPh92wdpXv9vfQBqa9HJYtypTGD5N5Aqf5S5CWf-yQ6x6sIj4pf3g/exec",
		"delay-set-scroll-pos-state": 10000,
		"page-scroll-effect-animation": true,
		"page-prefetch": true,
	}
	setting = { ...this.default_setting }
	fetchAbortController = null
	cacheFiles = new CacheFiles()

	constructor(main_id) {
		this.mainElement = document.getElementById(main_id)
		this.mainElement.setAttribute("tabindex", 1)
		this.mainElement.innerHTML = `<div id="TxtMiruPageEffect"></div><div class="prev-episode"></div><div id="contents" class="contents"><p style="width:100vw"></p></div><div class="next-episode"></div>`
		this.contentsElement = document.getElementById("contents")
		this.setButtonBind()
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
				this.txtMiruLoading = new TxtMiruLoading(this)
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
				const item = this.getHistory(url.searchParams.get('url'))
				this.LoadNovel(url.searchParams.get('url'), item['scroll_pos'], true)
			})
		})
	}
	defaultSetting = _ => this.default_setting
	reflectSetting = _ => {
		const el = document.getElementById("TxtMiruMain")
		const classNameList = []
		for (const cn of el.className.split(/ +/)) {
			if (!cn.match(/^zoom/)) {
				classNameList.push(cn)
			}
		}
		if (this.setting["font-size"] === "large-p") {
			classNameList.push("zoom_p2")
		} else if (this.setting["font-size"] === "large") {
			classNameList.push("zoom_p1")
		} else if (this.setting["font-size"] === "small") {
			classNameList.push("zoom_m1")
		}
		el.className = classNameList.join(" ")
		//
		if (this.setting["theme"] === "dark") {
			document.body.className = "dark"
		} else {
			document.body.className = ""
		}
		if (this.setting["menu-position"] === "bottom") {
			document.body.className += " bottom_menu"
		}
		if (this.setting["show-episode-button"] === "true") {
			document.getElementById("btn_prev_episode").classList.remove("hidden")
			document.getElementById("btn_next_episode").classList.remove("hidden")
		} else {
			document.getElementById("btn_prev_episode").classList.add("hidden")
			document.getElementById("btn_next_episode").classList.add("hidden")
		}
		if (this.setting["show-index-button"] === "true") {
			document.getElementById("btn_index").classList.remove("hidden")
		} else {
			document.getElementById("btn_index").classList.add("hidden")
		}
		this.setupWebsock(this.setting["WebSocketServerUrl"])
	}
	//
	txtmiru_websocket = null
	setupWebsock = url => {
		try {
			if (this.txtmiru_websocket) {
				this.txtmiru_websocket.close()
			}
			this.txtmiru_websocket = null
			if (!url || url.length === 0) {
				return
			}
			let sock = new WebSocket(url)
			sock.addEventListener("message", e => {
				try {
					let item = JSON.parse(e.data)
					if (item.url) {
						const match = item.url.match(/#.*$/)
						item.url = item.url.replace(/#.*$/, "")
						this.addCache(item)
						this.LoadNovel(item.url, match ? match[0] : "", true)
					} else {
						this.addCache(item)
					}
				} catch { }
			})
			sock.addEventListener("close", this.txtmiru_websocket = null)
			this.txtmiru_websocket = sock
			sock.addEventListener("open", e => {
				this.txtmiru_websocket.send(JSON.stringify({ reload: true }))
			})
		} catch {
			this.txtmiru_websocket = null
		}
	}
	//
	saveSetting = _ => {
		const item_list = []
		for (const key of Object.keys(this.setting)) {
			item_list.push({ id: key, value: this.setting[key] })
		}
		return this.txtMiruDB.setSetting(item_list)
	}
	//
	clearCache = _ => this.cache_list.length = 0
	getCache = _ => this.cache_list
	addCache = item => {
		for (let i = 0, l = this.cache_list.length; i < l; ++i) {
			if (item.url && this.cache_list[i].url == item.url) {
				this.cache_list[i] = item
				return
			}
		}
		this.cache_list.push(item)
	}
	///////////////////////////////
	// ページ移動
	// アニメーションでスクロール
	scrollPageEffect = nextDir => {
		const el_effect = document.getElementById("TxtMiruPageEffect")
		el_effect.style.display = "none"
		const el = this.mainElement
		let maxCount = window.innerWidth
		const right = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sal"))
		if (nextDir) {
			if (maxCount + maxCount - el.scrollLeft > el.scrollWidth) {
				maxCount = el.scrollWidth - maxCount + el.scrollLeft
			}
		} else {
			maxCount -= right
			if (-el.scrollLeft < maxCount) {
				maxCount = -el.scrollLeft
			}
		}
		//
		if (nextDir) {
			const abl_pos = cumulativeOffset(el_effect)
			const targets = new Set()
			for (let x = 0; x < 3; x++) {
				for (let i = 0; i < el.clientHeight; i += 10) {
					const t = document.elementsFromPoint(right + x, abl_pos.top + i)
					if (t.length >= 3 && el.contains(t[0])) {
						targets.add(t[0])
						break
					}
				}
			}
			// rt: ruby-position : over, under underは左側
			let offset = 0
			for (let item of targets) {
				let check_right = right
				if (item.tagName == "RT") {
					for (const ch of retrieveCharactersRects(item)) {
						const item_right = ch.rect.right
						if (ch.rect.left < right && right < item_right) {
							check_right += ch.rect.left
							break
						}
					}
				}
				do {
					if (item.tagName == "RT" || item.tagName == "RB" || item.tagName == "RUBY") {
						item = item.parentNode
					} else {
						break
					}
				} while (true)
				for (const ch of retrieveCharactersRectsRange(item, 0, 30)) {
					const item_right = ch.rect.right + ch.rect.width / 5 //2.3
					if (ch.rect.left < check_right && check_right < ch.rect.right) {
						if (offset < item_right - right) {
							offset = item_right - right
						}
					}
				}
			}
			maxCount -= right
			maxCount -= offset
			maxCount *= -1
		}
		//
		if (Math.abs(maxCount) > 1) {
			if (this.setting["page-scroll-effect-animation"]) {
				el_effect.style.display = "block"
				el_effect.className = el_effect.className == 'fadeInAnime1' ? 'fadeInAnime2' : 'fadeInAnime1'
			}
			el_effect.style.left = (el.scrollLeft + maxCount) + "px"
			el.scrollBy({ left: maxCount, behavior: "smooth" })
		}
	}

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
				el.scrollBy({left: scroll_step})
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
	restartScrollTimeout = _ => {
		if (this.scroll_timer_id) {
			clearTimeout(this.scroll_timer_id)
			this.scroll_timer_id = setTimeout(this.scroll_timer_func, 100)
		}
	}
	//
	pagePrev = _ => this.scrollPageEffect(false)
	pageNext = _ => this.scrollPageEffect(true)
	pageTop = _ => this.mainElement.scrollTo({ left: this.mainElement.scrollWidth, behavior: "smooth"})
	pageEnd = _ => this.mainElement.scrollTo({ left: -this.mainElement.scrollWidth, behavior: "smooth"})
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
	gotoNextEpisode = _ => this.gotoAttributeUrl("next-episode")
	gotoPrevEpisode = _ => this.gotoAttributeUrl("prev-episode")
	gotoIndex = _ => this.gotoAttributeUrl("episode-index")
	//
	getHistory = curl_url => {
		const history = this.setting["history"]
		if (history){
			for (const item of JSON.parse(history)) {
				if (item.url === curl_url) {
					return item
				}
			}
		}
		return {}
	}
	setHistory = (check_url, title) => {
		if (!check_url) {
			return
		}
		const scroll_pos = this.mainElement.scrollLeft / this.mainElement.scrollWidth
		let buf_history = [{ url: check_url, name: title, scroll_pos: scroll_pos }]
		let r
		if (r = check_url.match(/^(txtmiru:\/\/localfile\/[a-z0-9\-]+)/i)){
			if (r[1] === check_url){
				this.setting["local_history_index"] = { url: check_url, name: title }
			}
			const history = this.setting["local_history"]
			if (history) {
				for (const item of JSON.parse(history)) {
					if (item.url !== check_url) {
						buf_history.push(item)
					}
				}
				if (buf_history.length > 5) {
					buf_history.length = 5
				}
			}
			this.setting["local_history"] = JSON.stringify(buf_history)
		} else {
			const history = this.setting["history"]
			if (history) {
				for (const item of JSON.parse(history)) {
					if (item.url !== check_url) {
						buf_history.push(item)
					}
				}
				if (buf_history.length > 5) {
					buf_history.length = 5
				}
			}
			this.setting["history"] = JSON.stringify(buf_history)
			this.txtMiruDB.setSetting([{ id: "history", value: this.setting["history"] }])
		}
	}
	setScrollPosState = _ => {
		clearTimeout(this.set_scroll_pos_state_timer_id)
		const cur_url = new URL(window.location)
		this.setHistory(cur_url.searchParams.get("url"), document.title)
	}
	//
	loadLocalFile = _ => this.txtMiruLocalFile.show(this)
	inputURL = _ => this.txtMiruInputURL.show(this)
	//
	showFavorite = _ => this.txtMiruFavorite.show(this)
	//
	showConfig = _ => this.txtMiruConfig.show(this)
	//
	key_mapping = {
		"Shift+Space": e => this.pagePrev(),
		"Space": e => this.pageNext(),
		"PageUp": e => this.pagePrev(),
		"PageDown": e => this.pageNext(),
		"Home": e => this.pageTop(),
		"End": e => this.pageEnd(),
		"KeyL": e => this.inputURL(),
		"KeyO": e => this.loadLocalFile(),
		"KeyF": e => this.showFavorite(),
		"KeyC": e => this.showConfig(),
		"Ctrl+ArrowLeft": e => this.gotoNextEpisode(),
		"Ctrl+ArrowRight": e => this.gotoPrevEpisode(),
	}
	//
	setKeyBind = _ => {
		this.isComposing = false
		this.mainElement.addEventListener("click", e => { 
			const r = this.setting["tap-scroll-next-per"] || 0
			if (r && e.clientX < this.mainElement.clientWidth * (r / 100)){
				if (e.target && e.target.tagName === "A") {
					return
				}
				e.preventDefault()
				e.stopPropagation()
				this.pageNext()
			}
		})
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
			if (this.setting["delay-set-scroll-pos-state"] >= 0) {
				this.set_scroll_pos_state_timer_id = setTimeout(this.setScrollPosState, this.setting["delay-set-scroll-pos-state"])
			}
			if (this.prefetch && this.setting["page-prefetch"]) {
				const scroll_pos = - this.mainElement.scrollLeft / (this.mainElement.scrollWidth - this.mainElement.clientWidth)
				if (scroll_pos > 0.2){
					this.CacheLoad(this.contentsElement.getAttribute("next-episode"))
				}
			}
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
	setEvent = _ => {
		window.addEventListener("load", e => {
			const url = new URL(window.location)
			const item = this.getHistory(url.searchParams.get('url'),)
			this.LoadNovel(url.searchParams.get('url'), item['scroll_pos'], true)
		})
		window.addEventListener("popstate", e => {
			const url = new URL(window.location)
			const item = this.getHistory(url.searchParams.get('url'),)
			this.LoadNovel(url.searchParams.get('url'), item['scroll_pos'], true)
		})
		const el_effect = document.getElementById("TxtMiruPageEffect")
		el_effect.addEventListener("animationend", _ => { el_effect.style.display = "none" })
		//
		window.addEventListener('beforeunload', this.setScrollPosState)
		window.addEventListener('unload', this.setScrollPosState)
		//
		this.txtMiruLocalFile.setEvent(this)
		this.txtMiruInputURL.setEvent(this)
		this.txtMiruFavorite.setEvent(this)
		this.txtMiruConfig.setEvent(this)
	}
	//
	setTxtMiruIndexSite = _ => {
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
		const addHistory = (id, item, i) => {
			const el = document.getElementById(`${id}${i}`)
			if (el) {
				el.style.display = "block"
				el.innerHTML = `${i}. <a href='${item.url}' id='${id}Anchor${i}'>${item.name}</a>`
				const el_a = document.getElementById(`${id}Anchor${i}`)
				el_a.addEventListener("click", e => {
					e.preventDefault()
					e.stopPropagation()
					this.LoadNovel(`${item.url}`, parseFloat(item.scroll_pos))
				})
			}
		}
		let local_history = this.setting["local_history"]
		if (local_history){
			local_history = JSON.parse(local_history)
			let i = 0
			for (const item of local_history) {
				if (item.name === "undefined"){
					continue
				}
				++i
				addHistory("TxtMiruTopContentsLocalHistory", item, i)
			}
			const local_history_index = this.setting["local_history_index"]
			if (local_history_index && local_history_index.name !== "undefined"){
				++i
				addHistory("TxtMiruTopContentsLocalHistory", local_history_index, "Index")
			}
			const el = document.getElementById(`TxtMiruTopContentsLocalHistoryList`)
			if (i > 0 && el) {
				el.style.display = "block"
			}
		}
		let history = this.setting["history"]
		if (history) {
			history = JSON.parse(history)
			let i = 0
			for (const item of history) {
				++i
				addHistory("TxtMiruTopContentsHistory", item, i)
			}
			const el = document.getElementById(`TxtMiruTopContentsHistoryList`)
			if (i > 0 && el) {
				el.style.display = "block"
			}
		}
		document.title = TxtMiruTitle
		this.mainElement.scrollTo(this.mainElement.scrollWidth, 0)
	}
	//
	CacheLoad = async url => {
		if (this.loading || this.fetchAbortController || !url){
			return
		}
		url = url.replace(/#.*$/, "")
		if (!this.cacheFiles.Get(url)){
			const next_btn = document.getElementById("btn_next_episode")
			next_btn.classList.remove("cached")
			next_btn.classList.add("loading")
			this.fetchAbortController = new AbortController()
			await TxtMiruSiteManager.GetDocument(this, url).then(item => {
				if (item == null) {
					this.fetchAbortController = null
					return
				}
				if (!item["nocache"] && !item["cancel"]){
					item['url'] = url
					this.cacheFiles.Set(item)
				}
				next_btn.classList.add("cached")
				next_btn.classList.remove("loading")
			}).catch(err => {
				next_btn.classList.remove("cached")
				next_btn.classList.remove("loading")
			}).finally(_ => {
				this.fetchAbortController = null
			})
		}
	}
	//
	prefetch = false
	loading = false
	LoadNovel = async (url, scroll_pos = 0, no_history = false) => {
		this.prefetch = false
		if (this.loading) {
			return
		}
		this.loading = true
		const old_url = new URL(window.location)
		const title = document.title
		if (!no_history) {
			this.setHistory(old_url.searchParams.get("url"), title)
		}
		document.getElementById("btn_index").disabled = true
		document.getElementById("btn_next_episode").disabled = true
		document.getElementById("btn_prev_episode").disabled = true
		//
		document.getElementById("btn_next_episode").classList.remove("loading")
		document.getElementById("btn_next_episode").classList.remove("cached")
		//
		this.contentsElement.setAttribute("prev-episode", "")
		this.contentsElement.setAttribute("next-episode", "")
		this.contentsElement.setAttribute("episode-index", "")
		if (!url) {
			this.setTxtMiruIndexSite()
			const new_url = new URL(window.location)
			new_url.searchParams.delete('url')
			if (old_url.href !== new_url.href){
				history.pushState({'TxtMiru': true}, document.title, new_url)
			}
			this.loading = false
			return
		}
		//
		this.txtMiruLoading.begin(`取得中...`)
		const makeContents = item => {
			for (const key of ["className", "prev-episode", "next-episode", "episode-index", "next-episode-text", "prev-episode-text", "episode-index-text"]) {
				const v = item[key]
				if (v == null || v == "undefined") {
					item[key] = ""
				}
			}
			const setEpisodeText = (id_text, id_url, text) => {
				if (item[id_text].length === 0 && item[id_url].length > 0) {
					item[id_text] = text
				}
			}
			const setIndexHtml = (id_text, id_url) => {
				item[id_url] = "./index.html"
				item[id_text] = TxtMiruTitle
			}
			setEpisodeText("next-episode-text", "next-episode", "次へ")
			setEpisodeText("prev-episode-text", "prev-episode", "前へ")
			setEpisodeText("episode-index-text", "episode-index", "目次へ")
			if (item["next-episode-text"].length === 0 && item["episode-index-text"].length === 0) {
				setIndexHtml("next-episode-text", "next-episode")
			}
			if (item["prev-episode-text"].length === 0 && item["episode-index-text"].length === 0) {
				setIndexHtml("prev-episode-text", "prev-episode")
			}
			if (item["episode-index-text"].length === 0) {
				setIndexHtml("episode-index-text", "episode-index")
			}
			if (!no_history) {
				const new_url = new URL(window.location)
				new_url.searchParams.set('url', url)
				if (old_url.href !== new_url.href){
					history.pushState({'TxtMiru': true}, document.title, new_url)
				}
			}
			this.contentsElement.className = `contents ${item["className"]}`
			let html = item.html
			if (html === "undefined") {
				html = `<P>${url}</P><P>ページにつながりませんでした。</P>`
				setIndexHtml("next-episode-text", "next-episode")
				setIndexHtml("prev-episode-text", "prev-episode")
				setIndexHtml("episode-index-text", "episode-index")
			}
			this.contentsElement.setAttribute("prev-episode", item["prev-episode"])
			this.contentsElement.setAttribute("next-episode", item["next-episode"])
			this.contentsElement.setAttribute("episode-index", item["episode-index"])
			this.contentsElement.innerHTML = html
			for (const el_a of this.contentsElement.getElementsByTagName("A")) {
				let m = null
				const href = el_a.getAttribute("href")
				if (href && href.match(/^(?:http|https|txtmiru):\/\//i)) {
					for (let site of TxtMiruSiteManager.SiteList()) {
						if (site.Match(href)) {
							el_a.addEventListener("click", e => {
								e.preventDefault()
								e.stopPropagation()
								this.LoadNovel(`${href}`)
							})
							break
						}
					}
				} else if (href && (m = href.match(/^#(.*)/))) {
					const name = m[1]
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
			for (const key of ["prev", "next"]) {
				for (const el of this.mainElement.getElementsByClassName(`${key}-episode`)) {
					if (item[`${key}-episode`]) {
						el.innerHTML = `<a href="${item[`${key}-episode`]}" class="${item["className"]}">${item[`${key}-episode-text`]}</a>`
					} else if (item["episode-index"]) {
						el.innerHTML = `<a href="${item["episode-index"]}" class="${item["className"]}">${item["episode-index-text"]}</a>`
					}
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
			//
			if (item["episode-index"]) {
				document.getElementById("btn_index").disabled = false
			}
			if (item["prev-episode"] || item["episode-index"] ){
				document.getElementById("btn_prev_episode").disabled = false
			}
			if (item["next-episode"]) {
				document.getElementById("btn_next_episode").disabled = false
				if (!item["nocache"] && !item["cancel"]){
					this.prefetch = true
				}
			}
			//
			if (typeof scroll_pos == "string") {
				if(scroll_pos.match(/^[\-0-9\.]+$/)){
					this.mainElement.scrollTo(this.mainElement.scrollWidth * parseFloat(scroll_pos), 0)
				} else {
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
				}
			} else if (scroll_pos) {
				this.mainElement.scrollTo(this.mainElement.scrollWidth * scroll_pos, 0)
			} else {
				this.mainElement.scrollTo(this.mainElement.scrollWidth, 0)
			}
			document.title = item["title"]
			this.setHistory(url, document.title)
			this.txtMiruFavorite.setCurrentPage(this, url, item)
		}
		const cacheUrl = url.replace(/#.*$/, "")
		const cache = this.cacheFiles.Get(cacheUrl)
		if (cache){
			makeContents(cache)
			this.mainElement.focus()
			this.txtMiruLoading.end()
			this.loading = false
			return
		}
		await TxtMiruSiteManager.GetDocument(this, url).then(item => {
			if (item == null) {
				return
			}
			if (!item["nocache"] && !item["cancel"]){
				item['url'] = cacheUrl
				this.cacheFiles.Set(item)
			}
			makeContents(item)
		}).catch(err => {
			this.setTxtMiruIndexSite()
		}).finally(_ => {
			this.mainElement.focus()
			this.txtMiruLoading.end()
			this.loading = false
		})
	}
	setButtonBind = _ => {
		const hideMenu = _ => {
			document.getElementById("btn_show").className = "menu-trigger"
			document.getElementById("control-button-panel").className = "hide-control"
		}
		const showMenu = _ => {
			document.getElementById("btn_show").className = "menu-trigger active"
			document.getElementById("control-button-panel").className = "show-control"
		}
		document.getElementById("btn_show").addEventListener("click", e => {
			if (document.getElementById("control-button-panel").className == "show-control") {
				hideMenu()
			} else {
				showMenu()
			}
		})
		document.getElementById("btn_favorite").addEventListener("click", e => {
			hideMenu();
			this.showFavorite()
		})
		document.getElementById("btn_config").addEventListener("click", e => {
			hideMenu()
			this.showConfig()
		})
		document.getElementById("btn_oepn").addEventListener("click", e => this.loadLocalFile())
		document.getElementById("btn_url").addEventListener("click", e => {
			hideMenu()
			this.inputURL()
		})
		document.getElementById("control-button-panel").addEventListener("click", e => hideMenu())
		document.getElementById("btn_first").addEventListener("click", e => this.pageTop())
		document.getElementById("btn_prev").addEventListener("click", e => this.pagePrev())
		document.getElementById("btn_index").addEventListener("click", e => this.gotoIndex())
		document.getElementById("btn_next").addEventListener("click", e => this.pageNext())
		document.getElementById("btn_end").addEventListener("click", e => this.pageEnd())
		document.getElementById("btn_next_episode").addEventListener("click", e => this.gotoNextEpisode())
		document.getElementById("btn_prev_episode").addEventListener("click", e => {
			if (this.contentsElement.hasAttribute("prev-episode")){
				this.gotoPrevEpisode()
			} else {
				this.gotoIndex()
			}
		})
		document.getElementById("txtmiru_top_page").addEventListener("click", e => {
			e.preventDefault()
			e.stopPropagation()
			hideMenu()
			this.LoadNovel()
		})
	}
}
