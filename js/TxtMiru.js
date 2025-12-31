import { TxtMiruSiteManager } from './TxtMiruSitePlugin.js?1.0.20.0'
import { TxtMiruFavorite } from './TxtMiruFavorite.js?1.0.20.0'
import { TxtMiruLocalFile } from './TxtMiruLocalFile.js?1.0.20.0'
import { TxtMiruInputURL } from './TxtMiruInputURL.js?1.0.20.0'
import { TxtMiruLoading } from './TxtMiruLoading.js?1.0.20.0'
import { TxtMiruConfig } from './TxtMiruConfig.js?1.0.20.0'
import { TxtMiruDB } from './TxtMiruDB.js?1.0.20.0'
import { TxtMiruLib } from './TxtMiruLib.js?1.0.20.0'
import { CacheFiles } from './TxtMiruCacheFiles.js?1.0.20.0'

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
	if (elem.nodeType === elem.TEXT_NODE) {
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
	}
	for (let i = 0, n = elem.childNodes.length; i < n; ++i) {
		results.push(retrieveCharactersRects(elem.childNodes[i]))
	}
	return Array.prototype.concat.apply([], results)
}
export class TxtMiru {
	set_scroll_pos_state_timer_id = null
	scroll_timer_id = null
	scroll_timer_func = null
	touchTimer = null
	touchCount = 0
	display_popup = false
	#localCacheList = new CacheFiles()
	default_setting = {
		"WebServerUrl": "https://script.google.com/macros/s/AKfycbxf6f5omc-p0kTdmyPh92wdpXv9vfQBqa9HJYtypTGD5N5Aqf5S5CWf-yQ6x6sIj4pf3g/exec",
		"delay-set-scroll-pos-state": 10000,
		"page-scroll-effect-animation": true,
		"page-prefetch": true,
	}
	setting = { ...this.default_setting }
	fetchAbortController = null
	cacheFiles = new CacheFiles(10)

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
				this.setting["local_history"] = this.setting["local_history_index"] = null
			}).finally(_ => {
				TxtMiruSiteManager.txtMiru = this
				this.txtMiruLoading = new TxtMiruLoading(this)
				this.setEvent()
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
		el.classList.remove("zoom_p2", "zoom_p1", "zoom_m1", "no_zoom")
		const font_size_map = {
			"large-p": "zoom_p2",
			"large":   "zoom_p1",
			"small":   "zoom_m1",
		}
		el.classList.add(font_size_map[this.setting["font-size"]]||"no_zoom")
		this.setting["font-name"]
		 ? document.documentElement.style.setProperty('--contents-font', this.setting["font-name"])
		 : document.documentElement.style.removeProperty('--contents-font')
		document.documentElement.style.setProperty('--font-feature-settings', this.setting["font-feature-settings"]  || '"vchw"')
		document.body.className =  (this.setting["theme"] === "dark")  ? "dark" : ""
		if (this.setting["menu-position"] === "bottom") {
			document.body.classList.add("bottom_menu")
		}
		const btn_episode = this.setting["show-episode-button"] !== "true"
		document.getElementById("btn_prev_episode").classList.toggle("hidden", btn_episode)
		document.getElementById("btn_next_episode").classList.toggle("hidden", btn_episode)
		document.getElementById("btn_index").classList.toggle("hidden",
			this.setting["show-index-button"] !== "true")
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
			const sock = new WebSocket(url)
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
	saveSetting = _ => this.txtMiruDB.setSetting(
		Object.entries(this.setting).map(([id, value]) => ({ id, value }))
  	)
	//
	clearCache = this.#localCacheList.Clear
	getCache = this.#localCacheList.Get
	addCache = this.#localCacheList.Set
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
				if (item.tagName === "RT") {
					for (const ch of retrieveCharactersRects(item)) {
						const item_right = ch.rect.right
						if (ch.rect.left < right && right < item_right) {
							check_right += ch.rect.left
							break
						}
					}
				}
				const ruby_tags = ["RT", "RB", "RUBY"];
				while (ruby_tags.includes(item.tagName)) {
 				   item = item.parentNode
				}
				for (const ch of retrieveCharactersRectsRange(item, 0, 30)) {
					if (ch.rect.left < check_right && check_right < ch.rect.right) {
						const item_right = ch.rect.right + ch.rect.width / 5 - right //2.3
						if (offset < item_right) {
							offset = item_right
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
				el_effect.className = el_effect.className === 'fadeInAnime1' ? 'fadeInAnime2' : 'fadeInAnime1'
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
		const loop = _ => {
			this.restartScrollTimeout()
			if (index < count) {
				++index
				el.scrollBy({left: scroll_step})
				requestAnimationFrame(loop)
			} else {
				if ((height < 0 && el.scrollLeft < scroll_last)
					|| (height >= 0 && el.scrollLeft > scroll_last)) {
					return
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
		const url = this.contentsElement?.getAttribute(name)
		url && this.LoadNovel(url)
	}
	gotoIndex = _ => this.gotoAttributeUrl("episode-index")
	gotoNextEpisode = _ => this.gotoAttributeUrl("next-episode")
	gotoNextEpisodeOrIndex = _ => {
		this.contentsElement.getAttribute("next-episode")
		? this.gotoNextEpisode() : this.gotoIndex()
	}
	gotoPrevEpisode = _ => this.gotoAttributeUrl("prev-episode")
	gotoPrevEpisodeOrIndex = _ => {
		this.contentsElement.getAttribute("prev-episode")
		? this.gotoPrevEpisode() : this.gotoIndex()
	}
	//
	getHistory = curl_url => {
		const history = this.setting["history"]
		return (history)
			? JSON.parse(history).find(item => item.url === curl_url) ?? {}
			: {}
	}
	setHistory = (check_url, title) => {
		if (!check_url) {
			return
		}
		const _sethistory = name => {
			const scroll_pos = this.mainElement.scrollLeft / this.mainElement.scrollWidth
			let buf_history = [{ url: check_url, name: title, scroll_pos: scroll_pos }]
			const history = this.setting[name]
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
			this.setting[name] = JSON.stringify(buf_history)
		}
		let r
		if (r = check_url.match(/^(txtmiru:\/\/localfile\/[a-z0-9\-]+)/i)){
			if (r[1] === check_url){
				this.setting["local_history_index"] = { url: check_url, name: title }
			}
			_sethistory("local_history")
		} else {
			_sethistory("history")
			this.txtMiruDB.setSetting([{ id: "history", value: this.setting["history"] }])
		}
	}
	setScrollPosState = _ => {
		clearTimeout(this.set_scroll_pos_state_timer_id)
		const cur_url = new URL(window.location)
		this.setHistory(cur_url.searchParams.get("url"), document.title)
	}
	//
	loadLocalFile = _ => {
		this.txtMiruLocalFile ??= new TxtMiruLocalFile(this)
		this.txtMiruLocalFile.show()
	}
	inputURL = _ => {
		this.txtMiruInputURL ??= new TxtMiruInputURL(this)
		this.txtMiruInputURL.show()
	}
	showFavorite = _ => {
		this.txtMiruFavorite ??= new TxtMiruFavorite(this)
		this.txtMiruFavorite.show()
	}
	showConfig = _ => {
		this.txtMiruConfig ??= new TxtMiruConfig(this)
		this.txtMiruConfig.show()
	}
	///////////////////////////////
	// イベント
	key_mapping = {
		"Shift+Space": this.pagePrev,
		"Space": this.pageNext,
		"PageUp": this.pagePrev,
		"PageDown": this.pageNext,
		"Home": this.pageTop,
		"End": this.pageEnd,
		"KeyL": this.inputURL,
		"KeyO": this.loadLocalFile,
		"KeyF": this.showFavorite,
		"KeyC": this.showConfig,
		"Ctrl+ArrowLeft": this.gotoNextEpisode,
		"Ctrl+ArrowRight":this.gotoPrevEpisode,
	}
	setEvent = _ => {
		this.isComposing = false
		document.addEventListener("compositionstart", e => { this.isComposing = true })
		document.addEventListener("compositionend", e => { this.isComposing = false })
		document.addEventListener("keydown", e => {
			if (!this.display_popup && !this.isComposing) {
				let code = e.code
				if (e.shiftKey) { code = `Shift+${code}` }
				if (e.altKey) { code = `Alt+${code}` }
				if (e.metaKey) { code = `Meta+${code}` }
				if (e.ctrlKey) { code = `Ctrl+${code}` }
				const func = this.key_mapping[code]
				if (func) {
					TxtMiruLib.PreventEverything(e)
					func(e)
				}
			}
		})
		this.mainElement.addEventListener("click", e => { 
			const r = this.setting["tap-scroll-next-per"] || 0
			if (r && e.clientX < this.mainElement.clientWidth * (r / 100)){
				if (e.target && e.target.tagName === "A") {
					return
				}
				TxtMiruLib.PreventEverything(e)
				this.pageNext()
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
					this.CacheLoad()
				}
			}
		})
		const wheelScroll = dir => {
			const el = this.mainElement
			this.scrollToAnim(el.scrollLeft + el.clientWidth * 0.1 * (dir ? 1 : -1))
		}
		this.mainElement.addEventListener("wheel", e => {
			if (!this.display_popup) {
				wheelScroll(e.deltaY < 0)
			}
		}, { passive: true })
		this.mainElement.addEventListener("mousewheel", e => {
			if (!this.display_popup) {
				wheelScroll(e.wheelDelta > 0)
			}
		}, { passive: true })
		for(const el of this.mainElement.getElementsByClassName("prev-episode")){
			el.addEventListener("click", e => {
				TxtMiruLib.PreventEverything(e)
				this.gotoPrevEpisodeOrIndex()
			})
		}
		for(const el of this.mainElement.getElementsByClassName("next-episode")){
			el.addEventListener("click", e => {
				TxtMiruLib.PreventEverything(e)
				this.gotoNextEpisodeOrIndex()
			})
		}
		const loadNovel = _ => {
			const url = new URL(window.location)
			const item = this.getHistory(url.searchParams.get('url'))
			this.LoadNovel(url.searchParams.get('url'), item['scroll_pos'], true)
		}
		window.addEventListener("load", loadNovel)
		window.addEventListener("popstate", loadNovel)
		const el_effect = document.getElementById("TxtMiruPageEffect")
		el_effect.addEventListener("animationend", _ => { el_effect.style.display = "none" })
		//
		window.addEventListener('beforeunload', this.setScrollPosState)
		window.addEventListener('unload', this.setScrollPosState)
	}
	//
	setTxtMiruIndexSite = _ => {
		this.contentsElement.innerHTML = document.getElementById("TxtMiruTopContents").innerHTML
		this.contentsElement.className = "contents"
		for (const el of this.mainElement.querySelectorAll(".prev-episode, .next-episode")) {
			el.innerHTML = `<a href="./index.html">${TxtMiruTitle}</a>`
		}
		const addHistory = (id, item, i) => {
			const el = document.getElementById(`${id}${i}`)
			if (el) {
				el.style.display = "list-item"
				el.innerHTML = `<a href='${item.url}' id='${id}Anchor${i}'>${item.name}</a>`
				const el_a = document.getElementById(`${id}Anchor${i}`)
				el_a.addEventListener("click", e => {
					TxtMiruLib.PreventEverything(e)
					this.LoadNovel(`${item.url}`, parseFloat(item.scroll_pos))
				})
			}
		}
		const local_history = this.setting["local_history"]
		if (local_history){
			let i = 0
			for (const item of JSON.parse(local_history)) {
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
		const history = this.setting["history"]
		if (history) {
			let i = 0
			for (const item of JSON.parse(history)) {
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
	CacheLoad = async _ => {
		let url = this.contentsElement.getAttribute("next-episode")
		if (this.loading || this.fetchAbortController || !url){
			return
		}
		url = url.replace(/#.*$/, "")
		if (!this.cacheFiles.Get(url)){
			const next_btn = document.getElementById("btn_next_episode")
			if (!next_btn.disabled){
				next_btn.classList.remove("cached")
				next_btn.classList.add("loading")
				this.fetchAbortController = new AbortController()
				await TxtMiruSiteManager.GetDocument(this, url).then(item => {
					if (item == null) {
						this.fetchAbortController = null
						next_btn.classList.remove("loading")
						return
					}
					if (!item["nocache"] && !item["cancel"]){
						item['url'] = url
						this.cacheFiles.Set(item)
					}
				}).catch(_ => {
				}).finally(_ => {
					this.fetchAbortController = null
				})
			}
			this.SetCacheIcon()
		}
	}
	SetCacheIcon = _ => {
		const next_btn = document.getElementById("btn_next_episode")
		let url = this.contentsElement.getAttribute("next-episode")
		if (url){
			url = url.replace(/#.*$/, "")
			if (this.cacheFiles.Get(url)){
				next_btn.classList.add("cached")
				next_btn.classList.remove("loading")
				return
			}
		}
		next_btn.classList.remove("cached")
		next_btn.classList.remove("loading")
	}
	setCurrentPage = async (url, item) => {
		if (item["episode-index"] && item["page_no"]) {
			await this.txtMiruDB.getFavoriteByUrl(item["episode-index"], item["page_no"], url)
			return
		}
		for (const site of TxtMiruSiteManager.SiteList()) {
			if (site.Match(url)) {
				const page = await site.GetPageNo(this, url)
				if (page && page.index_url) {
					const item = await this.txtMiruDB.getFavoriteByUrl(page.index_url, page.page_no, url)
					if (item && item.length > 0 && item[0].cur_page < page.page_no) {
						await this.txtMiruDB.setFavorite(item[0].id, { cur_page: page.page_no, cur_url: url })
					}
				}
				break
			}
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
		const loadingEnd = _ => {
			this.mainElement.focus()
			this.txtMiruLoading.end()
			this.loading = false
			this.SetCacheIcon()
		}
		this.loading = true
		this.txtMiruLoading.begin(`取得中...`)
		const old_url = new URL(window.location)
		const title = document.title
		if (!no_history) {
			this.setHistory(old_url.searchParams.get("url"), title)
		}
		document.getElementById("btn_index").disabled = true
		document.getElementById("btn_next_episode").disabled = true
		document.getElementById("btn_prev_episode").disabled = true
		//
		this.contentsElement.setAttribute("prev-episode", "")
		this.contentsElement.setAttribute("next-episode", "")
		this.contentsElement.setAttribute("episode-index", "")
		this.SetCacheIcon()
		if (!url || !url.match(/:/)) {
			this.setTxtMiruIndexSite()
			const new_url = new URL(window.location)
			new_url.searchParams.delete('url')
			if (old_url.href !== new_url.href){
				history.pushState({'TxtMiru': true}, document.title, new_url)
			}
			loadingEnd()
			return
		}
		//
		const makeContents = item => {
			for (const key of ["className", "prev-episode", "next-episode", "episode-index", "next-episode-text", "prev-episode-text", "episode-index-text"]) {
				const v = item[key]
				if (v == null || v == "undefined") {
					item[key] = ""
				}
			}
			const setEpisodeText = (id, text) => {
				if (item[`${id}-text`].length === 0 && item[id].length > 0) {
					item[`${id}-text`] = text
				}
			}
			const setIndexHtml = id => {
				item[id] = "./index.html"
				item[`${id}-text`] = TxtMiruTitle
			}
			setEpisodeText("next-episode", "次へ")
			setEpisodeText("prev-episode", "前へ")
			setEpisodeText("episode-index", "目次へ")
			if (item["next-episode-text"].length === 0 && item["episode-index-text"].length === 0) {
				setIndexHtml("next-episode")
			}
			if (item["prev-episode-text"].length === 0 && item["episode-index-text"].length === 0) {
				setIndexHtml("prev-episode")
			}
			if (item["episode-index-text"].length === 0) {
				setIndexHtml("episode-index")
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
				setIndexHtml("next-episode")
				setIndexHtml("prev-episode")
				setIndexHtml("episode-index")
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
								TxtMiruLib.PreventEverything(e)
								this.LoadNovel(`${href}`)
							})
							break
						}
					}
				} else if (href && (m = href.match(/^#(.*)/))) {
					const name = m[1]
					el_a.addEventListener("click", e => {
						TxtMiruLib.PreventEverything(e)
						const target = document.querySelector(`*[name=${name}]`)
						if (target) {
							this.mainElement.scrollTo(-this.mainElement.clientWidth + target.getBoundingClientRect().right, 0)
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
			if (typeof scroll_pos === "string") {
				if(scroll_pos.match(/^[\-0-9\.]+$/)){
					this.mainElement.scrollTo(this.mainElement.scrollWidth * parseFloat(scroll_pos), 0)
				} else {
					const anchor_name = scroll_pos.replace(/#/, "")
					const target = document.querySelector(`*[name=${anchor_name}],#${anchor_name}`)
					scroll_pos = target
						? this.mainElement.scrollWidth
						: -this.mainElement.clientWidth + target.getBoundingClientRect().right + this.mainElement.scrollLeft
					this.mainElement.scrollTo(scroll_pos, 0)
				}
			} else {
				this.mainElement.scrollTo(this.mainElement.scrollWidth * (scroll_pos || 1), 0)
			}
			document.title = item["title"]
			this.setHistory(url, document.title)
			this.setCurrentPage(url, item)
		}
		const cacheUrl = url.replace(/#.*$/, "")
		const cache = this.cacheFiles.Get(cacheUrl)
		if (cache){
			makeContents(cache)
			loadingEnd()
			return
		}
		await TxtMiruSiteManager.GetDocument(this, url).then(item => {
			if (item === null) {
				return
			}
			if (!item["nocache"] && !item["cancel"]){
				item['url'] = cacheUrl
				this.cacheFiles.Set(item)
			}
			makeContents(item)
		}).catch(err => {
			console.log(err)
			this.setTxtMiruIndexSite()
		}).finally(_ => {
			loadingEnd()
		})
	}
	setButtonBind = _ => { // TOPメニューボタン
		const hideMenu = _ => {
			document.getElementById("btn_show").className = "menu-trigger"
			document.getElementById("control-button-panel").className = "hide-control"
		}
		const showMenu = _ => {
			document.getElementById("btn_show").className = "menu-trigger active"
			document.getElementById("control-button-panel").className = "show-control"
		}
		document.getElementById("btn_show").addEventListener("click", e => {
			document.getElementById("control-button-panel").className === "show-control"
			? hideMenu()
			: showMenu()
		})
		document.getElementById("btn_favorite").addEventListener("click", e => {
			hideMenu()
			this.showFavorite()
		})
		document.getElementById("btn_config").addEventListener("click", e => {
			hideMenu()
			this.showConfig()
		})
		document.getElementById("btn_oepn").addEventListener("click", this.loadLocalFile)
		document.getElementById("btn_url").addEventListener("click", e => {
			hideMenu()
			this.inputURL()
		})
		document.getElementById("control-button-panel").addEventListener("click", hideMenu)
		document.getElementById("btn_first").addEventListener("click", this.pageTop)
		document.getElementById("btn_prev").addEventListener("click", this.pagePrev)
		document.getElementById("btn_index").addEventListener("click", this.gotoIndex)
		document.getElementById("btn_next").addEventListener("click", this.pageNext)
		document.getElementById("btn_end").addEventListener("click", this.pageEnd)
		document.getElementById("btn_next_episode").addEventListener("click", this.gotoNextEpisode)
		document.getElementById("btn_prev_episode").addEventListener("click", this.gotoPrevEpisodeOrIndex)
		document.getElementById("txtmiru_top_page").addEventListener("click", e => {
			TxtMiruLib.PreventEverything(e)
			hideMenu()
			this.LoadNovel()
		})
	}
}
