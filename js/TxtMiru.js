import { TxtMiruSiteManager } from './TxtMiruSitePlugin.js?1.5'
import { TxtMiruFavorite } from './TxtMiruFavorite.js?1.0'
import { TxtMiruInputURL } from './TxtMiruInputURL.js'
import { TxtMiruLoading } from './TxtMiruLoading.js'
import { TxtMiruConfig } from './TxtMiruConfig.js'
import { TxtMiruDB } from './TxtMiruDB.js?1.1'

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
		let range = elem.ownerDocument.createRange()
		range.selectNodeContents(elem)
		for (let current_pos = 0, end_pos = range.endOffse; current_pos + 1 < end_pos; ++current_pos) {
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
	scroll_timer_id = null
	scroll_timer_func = null
	cur_location = ""
	scroll_pos = {}
	site_list = []
	touchTimer = null
	touchCount = 0
	display_popup = false
	setting = {
		"WebServerUrl": "https://script.google.com/macros/s/AKfycbytotf75BrlNwTrkRqxW2Bt0TMopbxK4EzE7cp4zXhEsk3vh2NmDZcM_wxyecRFLi1ooQ/exec"
	}

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
					for (let item of ret) {
						this.setting[item.id] = item.value
					}
				}
			}).finally(() => {
				TxtMiruSiteManager.txtMiru = this
				this.txtMiruLoading = new TxtMiruLoading()
				this.txtMiruInputURL = new TxtMiruInputURL(this)
				this.txtMiruFavorite = new TxtMiruFavorite(this)
				this.txtMiruConfig = new TxtMiruConfig(this)
				//
				this.setKeyBind()
				this.setEvent()
				//
				const url = new URL(window.location)
				this.cur_location = url
				//
				this.reflectSetting()
				//
				this.LoadNovel(url.searchParams.get('url'), url.searchParams.get('scroll_pos'), true)
			})
		})
	}
	reflectSetting = () => {
		let el = document.getElementById("TxtMiruMain")
		let classNameList = []
		for (let cn of el.className.split(/ +/)) {
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
	}
	saveSetting = () => {
		let item_list = []
		for (let key of Object.keys(this.setting)) {
			item_list.push({ id: key, value: this.setting[key] })
		}
		return this.txtMiruDB.setSetting(item_list)
	}
	///////////////////////////////
	// ページ移動
	// アニメーションでスクロール
	scrollToAnim = scroll_last => {
		let el = this.mainElement
		let height = scroll_last - el.scrollLeft
		const count = 10
		let scroll_step = height / count
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
		let el = this.mainElement
		this.scrollToAnim(el.scrollLeft + el.clientWidth + 10)
		this.scroll_timer_func = this.fixPagePrev
		this.scroll_timer_id = setTimeout(this.fixPagePrev, 100)
	}
	pageNext = () => {
		if (this.scroll_timer_id) {
			clearTimeout(this.scroll_timer_id)
		}
		let el = this.mainElement
		this.scrollToAnim(el.scrollLeft - el.clientWidth + 10)
		this.scroll_timer_func = this.fixPageNext
		this.scroll_timer_id = setTimeout(this.fixPageNext, 100)
	}
	pageTop = () => {
		this.scrollToAnim(1)
	}
	pageEnd = () => {
		let el = this.mainElement
		this.scrollToAnim(-el.scrollWidth)
	}
	//
	gotoNextEpisode = () => {
		let el = this.contentsElement
		if (el.hasAttribute("next-episode")) {
			let url = el.getAttribute("next-episode")
			if (url && url.length > 0) {
				this.LoadNovel(url)
			}
		}
	}
	gotoPrevEpisode = () => {
		let el = this.contentsElement
		if (el.hasAttribute("prev-episode")) {
			let url = el.getAttribute("prev-episode")
			if (url && url.length > 0) {
				this.LoadNovel(url)
			}
		}
	}
	gotoIndex = () => {
		let el = this.contentsElement
		if (el.hasAttribute("episode-index")) {
			let url = el.getAttribute("episode-index")
			if (url && url.length > 0) {
				this.LoadNovel(url)
			}
		}
	}
	//
	scrollFitRuby = () => {
		let el = this.mainElement
		let abl_pos = cumulativeOffset(el)
		let right = abl_pos.left + el.clientWidth - 1
		let pos = el.scrollLeft
		const targets = new Set()
		for (let i = 0; i < el.clientHeight; i += 10) {
			let t = document.elementsFromPoint(right, abl_pos.top + i)
			if (t.length > 3 && el.contains(t[0])) {
				targets.add(t[0])
				break
			}
		}
		let ch_width = 0
		for (const item of targets) {
			for (ch of retrieveCharactersRects(item)) {
				if (ch_width < ch.rect.width) {
					ch_width = ch.rect.width
				}
			}
		}
		ch_width *= 0.8
		let offset = 0
		for (const item of targets) {
			for (ch of retrieveCharactersRects(item)) {
				if (ch.rect.width > ch_width) {
					continue
				}
				if (ch.rect.left < right && right < ch.rect.right) {
					if (offset < ch.rect.right - right) {
						offset = ch.rect.right - right - 2
					}
				}
			}
		}
		el.scrollTo(pos + offset, 0)
	}
	fixPagePrev = () => {
		this.scroll_timer_id = null
		let el = this.mainElement
		let abl_pos = cumulativeOffset(el)
		let right = abl_pos.left + el.clientWidth - 1
		let pos = el.scrollLeft
		const targets = new Set()
		for (let i = 0; i < el.clientHeight; i += 10) {
			let t = document.elementsFromPoint(right, abl_pos.top + i)
			if (t.length > 3 && el.contains(t[0])) {
				targets.add(t[0])
				break
			}
		}
		let offset = 0
		for (const item of targets) {
			for (ch of retrieveCharactersRects(item)) {
				if (ch.rect.left < right && right < ch.rect.right) {
					if (offset < right - ch.rect.left) {
						offset = right - ch.rect.left - 2
					}
				}
			}
		}
		el.scrollTo(pos - offset, 0)
		this.scrollFitRuby()
	}
	fixPageNext = () => {
		this.scroll_timer_id = null
		let el = this.mainElement
		let abl_pos = cumulativeOffset(el)
		let right = abl_pos.left + el.clientWidth - 1
		let pos = el.scrollLeft
		const targets = new Set()
		for (let i = 0; i < el.clientHeight; i += 10) {
			let t = document.elementsFromPoint(right, abl_pos.top + i)
			if (t.length > 3 && el.contains(t[0])) {
				targets.add(t[0])
				break
			}
		}
		let offset = 0
		for (const item of targets) {
			for (ch of retrieveCharactersRects(item)) {
				if (ch.rect.left < right && right < ch.rect.right) {
					if (offset < ch.rect.right - right) {
						offset = ch.rect.right - right - 2
					}
				}
			}
		}
		el.scrollTo(pos + offset + 5, 0)
		this.scrollFitRuby()
	}
	//
	inputURL = () => {
		this.txtMiruInputURL.show(this)
	}
	//
	showFavorite = () => {
		this.txtMiruFavorite.show(this)
	}
	//
	showConfig = () => {
		this.txtMiruConfig.show(this)
	}
	key_mapping = {
		"Shift+Space": (e) => this.pagePrev(),
		"Space": (e) => this.pageNext(),
		"PageUp": (e) => this.pagePrev(),
		"PageDown": (e) => this.pageNext(),
		"Home": (e) => this.pageTop(),
		"End": (e) => this.pageEnd(),
		"KeyL": (e) => this.inputURL(),
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
		this.mainElement.addEventListener("wheel", e => {
			if (!this.display_popup) {
				let el = this.mainElement
				if (e.deltaY < 0) {
					this.scrollToAnim(el.scrollLeft + el.clientWidth * 0.1)
				} else {
					this.scrollToAnim(el.scrollLeft - el.clientWidth * 0.1)
				}
			}
		}, { passive: true })
		this.mainElement.addEventListener("mousewheel", e => {
			if (!this.display_popup) {
				let el = this.mainElement
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
	UpdateParamScrollPos = () => {
		let el = this.mainElement
		const state = {
			'TxtMiru': true
		}
		const title = this.cur_location.searchParams.get('url')
		document.title = this.cur_location.searchParams.get('url') + " " + (el.scrollLeft / el.offsetWidth)
		this.cur_location.searchParams.set('scroll_pos', el.scrollLeft / el.offsetWidth)
		this.scroll_pos[this.cur_location.searchParams.get('url')] = el.scrollLeft / el.offsetWidth
		history.replaceState(state, title, this.cur_location)
	}
	setEvent = () => {
		window.addEventListener("beforeunload", e => {
			this.UpdateParamScrollPos()
		})
		window.addEventListener("load", e => {
			const url = new URL(window.location)
			this.cur_location = url
			this.LoadNovel(url.searchParams.get('url'), url.searchParams.get('scroll_pos'), true)
		})
		window.addEventListener("popstate", e => {
			const url = new URL(window.location)
			let el = this.mainElement
			this.scroll_pos[this.cur_location.searchParams.get('url')] = el.scrollLeft / el.offsetWidth
			this.LoadNovel(url.searchParams.get('url'), this.scroll_pos[url.searchParams.get('url')], true)
		})
		//
		this.txtMiruInputURL.setEvent(this)
		this.txtMiruFavorite.setEvent(this)
		this.txtMiruConfig.setEvent(this)
	}
	//
	pageInfo = async url => {
		if (!url) {
			this.cur_location = new URL(window.location)
			url = this.cur_location.searchParams.get('url')
			if (!url) {
				return
			}
		}
		for (let site of TxtMiruSiteManager.SiteList()) {
			if (site.Match(url)) {
				return site.Info(url)
			}
		}
		return null
	}
	setTxtMiruIndexSite = () => {
		this.cur_location = new URL(window.location)
		document.getElementById("contents").innerHTML = document.getElementById("TxtMiruTopContents").innerHTML
		const oldPrevFunc = this.prevFunc
		for (let el of this.mainElement.getElementsByClassName("prev-episode")) {
			el.innerHTML = `<a href="./index.html">${TxtMiruTitle}</a>`
			if (oldPrevFunc) {
				el.removeEventListener("click", oldPrevFunc)
			}
		}
		this.prevFunc = null
		//
		const oldNextFunc = this.nextFunc
		for (let el of this.mainElement.getElementsByClassName("next-episode")) {
			el.innerHTML = `<a href="./index.html">${TxtMiruTitle}</a>`
			if (oldNextFunc) {
				el.removeEventListener("click", oldNextFunc)
			}
		}
		this.nextFunc = null
	}
	//
	LoadNovel = (url, scroll_pos = 0, no_history = false) => {
		this.contentsElement.setAttribute("prev-episode", "")
		this.contentsElement.setAttribute("next-episode", "")
		this.contentsElement.setAttribute("episode-index", "")
		if (!url) {
			this.setTxtMiruIndexSite()
			//
			url = this.cur_location.searchParams.get('url')
			if (!url) {
				return
			}
			scroll_pos = this.cur_location.searchParams.get('scroll_pos')
		}
		//
		const title = document.title
		const new_url = new URL(window.location)
		new_url.searchParams.set('url', url)
		new_url.searchParams.set('scroll_pos', scroll_pos)
		if (!no_history) {
			const state = {
				'TxtMiru': true
			}
			history.pushState(state, title, new_url)
		}
		this.txtMiruLoading.begin()
		this.txtMiruFavorite.setCurrentPage(this, url)
		TxtMiruSiteManager.GetDocument(this, url).then(item => {
			if (item == null) {
				return
			}
			for (let key of ["className", "prev-episode", "next-episode", "episode-index", "next-episode-text", "prev-episode-text", "episode-index-text"]) {
				let v = item[key]
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
			let el = this.mainElement
			this.cur_location = new_url
			this.scroll_pos[this.cur_location.searchParams.get('url')] = scroll_pos
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
			for (let el_a of this.contentsElement.getElementsByTagName("A")) {
				let href = el_a.getAttribute("href")
				if (href && href.match(/^http/)) {
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
					let name = RegExp.$1
					el_a.addEventListener("click", e => {
						e.preventDefault()
						e.stopPropagation()
						let target_list = document.getElementsByName(name)
						if (target_list.length > 0) {
							this.mainElement.scrollTo(-el.clientWidth + target_list[0].getBoundingClientRect().right, 0)
						}
					})
				}
			}
			for (let el of this.mainElement.getElementsByClassName("prev-episode")) {
				if (item["prev-episode"]) {
					el.innerHTML = `<a href="${item["prev-episode"]}" class="${item["className"]}">${item["prev-episode-text"]}</a>`
				} else if (item["episode-index"]) {
					el.innerHTML = `<a href="${item["episode-index"]}" class="${item["className"]}">${item["episode-index-text"]}</a>`
				}
			}
			for (let el of this.mainElement.getElementsByClassName("next-episode")) {
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
			for (let el of this.mainElement.getElementsByClassName("prev-episode")) {
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
			for (let el of this.mainElement.getElementsByClassName("next-episode")) {
				if (oldNextFunc) {
					el.removeEventListener("click", oldNextFunc)
				}
				el.addEventListener("click", this.nextFunc)
			}
			if (scroll_pos) {
				this.mainElement.scrollTo(el.offsetWidth * scroll_pos, 0)
			} else {
				this.mainElement.scrollTo(0, 0)
			}
		}).catch(err => {
			this.setTxtMiruIndexSite()
		}).finally(() => {
			this.mainElement.focus()
			this.txtMiruLoading.end()
		})
	}
}
