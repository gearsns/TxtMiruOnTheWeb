import { TxtMiruLib } from './TxtMiruLib.js?1.0.9.0'
import fetchJsonp from './fetch-jsonp.js'

const appendSlash = text => {
	if (!text.match(/\/$/)) {
		text += "/"
	}
	return text
}
const removeSlash = text => {
	return text.replace(/\/$/, "")
}

const getChildFullLevel = node => {
	let arr = []
	if (node instanceof Array) {
		for (const n of node) {
			arr = arr.concat(getChildFullLevel(n))
		}
		return arr
	}
	if (!node.childNodes) {
		return arr
	}
	for (const child of node.childNodes) {
		arr.push(child)
		if (child.nodeType === 1) {
			arr = arr.concat(getChildFullLevel(child))
		}
	}
	return arr
}

const hasParentClassName = (node, name) => {
	var p = node.parentNode
	if (p) {
		if (p.className == name) {
			return true
		}
		return hasParentClassName(p, name)
	}
	return false
}

class TxtMiruSitePlugin {
	Match = url => false
	GetDocument = (txtMiru, url) => null
	GetInfo = (txtMiru, url, callback = null) => false
	GetPageNo = (txtMiru, url) => { }
	Name = () => ""
}

export class TxtMiruSiteManager {
	static site_list = []
	static AddSite = site => this.site_list.push(site)
	static SiteList = () => this.site_list
	static GetDocument = (txtMiru, url) => {
		for (const site of this.site_list) {
			if (site.Match(url) && site.GetDocument) {
				return site.GetDocument(txtMiru, url)
			}
		}
		return new Promise((resolve, reject) => {
			setTimeout(() => reject(null))
		})
	}
}

class LocalSite extends TxtMiruSitePlugin {
	Match = url => {
		let base_url = document.location + ""
		base_url.replace(/https:\/\/.*?\//, "")
		if (url.substring(0, base_url.length) == base_url) {
			return true
		}
		return url.match(/^\.\/TxtMiru\/novel\//)
	}
	GetDocument = (txtMiru, url) => {
		return fetch(url, null)
			.then(response => response.text())
			.then(text => {
				let doc = TxtMiruLib.HTML2Document(text)
				document.title = doc.title
				TxtMiruLib.KumihanMod(url, doc)
				return {
					className: "LocalSite",
					"html": doc.body.innerHTML,
					"next-episode-text": "次へ",
					"prev-episode-text": "前へ",
					"episode-index-text": "目次へ"
				}
			})
			.catch(err => {
				return err
			})
	}
}
TxtMiruSiteManager.AddSite(new LocalSite())

class TxtMiruCacheSite extends TxtMiruSitePlugin {
	Match = url => url.match(/^TxtMiru:/)
	GetDocument = (txtMiru, url) => {
		for (const cache of txtMiru.getCache()) {
			if (cache.url == url) {
				let doc = TxtMiruLib.HTML2Document(cache.html)
				document.title = doc.title
				TxtMiruLib.KumihanMod(url, doc)
				let item = {
					className: "TxtMiruCache Aozora",
					html: `<div class="main_text">${doc.body.innerHTML}</div>`
				}
				return Promise.resolve(item)
			}
		}
		return Promise.resolve({ html: "Not found" })
	}
	GetInfo = (txtMiru, url, callback = null) => false
	GetPageNo = (txtMiru, url) => { }
	Name = () => "TxtMiru"
}
TxtMiruSiteManager.AddSite(new TxtMiruCacheSite())

class Narou extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/.*\.syosetu\.com/)
	GetDocument = (txtMiru, url) => {
		const cookie = (txtMiru.setting["over18"] == "yes") ? "over18=yes" : ""
		const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "UTF-8",
			cookie: cookie
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(text => {
				let doc = TxtMiruLib.HTML2Document(text)
				document.title = doc.title
				TxtMiruLib.KumihanMod(url, doc)
				let item = { className: "Narou" }
				//
				for (const el_a of doc.getElementsByTagName("A")) {
					const href = el_a.getAttribute("href") || ""
					if (!href.match(/^http/)) {
						el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href) //`https://ncode.syosetu.com${href}`
					}
					if (el_a.innerText == "<< 前へ") {
						item["prev-episode"] = el_a.href
						item["prev-episode-text"] = "前へ"
					} else if (el_a.innerText == "次へ >>") {
						item["next-episode"] = el_a.href
						item["next-episode-text"] = "次へ"
					} else if (el_a.innerText == "目次") {
						item["episode-index"] = el_a.href
						item["episode-index-text"] = "目次へ"
					}
				}
				for (const el of doc.getElementsByClassName("long_update")) {
					let el_rev = null
					for (const el_span of el.getElementsByTagName("SPAN")) {
						if (el_span.getAttribute("title")) {
							el_rev = el_span
						}
					}
					if (el_rev) {
						el.insertBefore(el_rev, el.firstChild)
					}
				}
				item["html"] = doc.body.innerHTML
				return item
			})
			.catch(err => {
				return err
			})
	}
	getUpdateInfo = async url => {
		let ncode = url
		if (!url) {
			return []
		}
		if (url.match(/https:\/\/.*\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
			ncode = `N${RegExp.$1}`.toUpperCase()
		}
		if (ncode.length == 0) {
			return []
		}
		url = `https://api.syosetu.com/novelapi/api/?out=jsonp&ncode=${ncode}&callback=callback`
		return await fetchJsonp(url, { mode: 'cors', credentials: 'include' })
			.then(async response => await response.json())
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			let requests = []
			let item_list = []
			for (const u of url) {
				if (this.Match(u)) {
					let ncode = u
					if (u.match(/https:\/\/.*\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
						ncode = `n${RegExp.$1}`
					}
					item_list.push(u)
					requests.push(ncode.toUpperCase())
					if (requests.length > 10) {
						if (callback) {
							callback(item_list)
						}
						for (const item of await this.getUpdateInfo(requests.join("-"))) {
							if (item.ncode) {
								results.push({
									url: item.ncode.toUpperCase(),
									max_page: item.novel_type == 2/*短編*/ ? -1 : item.general_all_no,
									name: item.title,
									author: item.writer
								})
							}
						}
						requests = []
						item_list = []
					}
				}
			}
			if (requests.length > 0) {
				if (callback) {
					callback(item_list)
				}
				for (const item of await this.getUpdateInfo(requests.join("-"))) {
					if (item.ncode) {
						results.push({
							url: item.ncode.toUpperCase(),
							max_page: item.novel_type == 2/*短編*/ ? -1 : item.general_all_no,
							name: item.title,
							author: item.writer
						})
					}
				}
			}
			let out_results = []
			for (const u of url) {
				let ncode = u
				if (u.match(/https:\/\/.*\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
					ncode = `n${RegExp.$1}`.toUpperCase()
				}
				ncode = ncode.toUpperCase()
				for (const ret of results) {
					if (ret.url == ncode) {
						out_results.push({
							url: appendSlash(u),
							max_page: ret.max_page,
							name: ret.name,
							author: ret.author
						})
						break
					}
				}
			}
			return out_results
		} else if (this.Match(url)) {
			let ncode = url
			if (url.match(/https:\/\/.*\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
				ncode = `n${RegExp.$1}`.toUpperCase()
			}
			ncode = ncode.toUpperCase()
			if (callback) {
				callback([url])
			}
			for (const item of await this.getUpdateInfo(url)) {
				if (item.ncode && ncode == item.ncode.toUpperCase()) {
					return {
						url: appendSlash(url),
						max_page: item.general_all_no,
						name: item.title,
						author: item.writer
					}
				}
			}
		}
		return null
	}
	GetPageNo = (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/(https:\/\/.*\.syosetu\.com\/n[A-Za-z0-9]+)\/([0-9]+)/)) {
				let page_no = RegExp.$2 | 0
				let index_url = RegExp.$1
				index_url = appendSlash(index_url)
				return { url: url, page_no: page_no, index_url: index_url }
			} else if (url.match(/https:\/\/.*\.syosetu\.com\/n[A-Za-z0-9]+\/$/)) {
				return { url: url, page_no: 0, index_url: url }
			}
		}
		return null
	}
	Name = () => "小説家になろう"
}
TxtMiruSiteManager.AddSite(new Narou())

class Kakuyomu extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/kakuyomu\.jp/)
	GetDocument = (txtMiru, url) => {
		let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "UTF-8"
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(text => {
				let doc = TxtMiruLib.HTML2Document(text)
				document.title = doc.title
				TxtMiruLib.KumihanMod(url, doc)

				let item = {
					className: "Kakuyomu",
					"next-episode-text": "次へ",
					"prev-episode-text": "前へ",
					"episode-index-text": "カクヨム",
					"episode-index": "https://kakuyomu.jp/"
				}
				for (let el of doc.getElementsByClassName("widget-toc-episode-datePublished")) {
					for (let el_span of el.getElementsByTagName("SPAN")) {
						if (el_span.innerText.match(/([0-9]+)年([0-9]+)月([0-9]+)日/)) {
							el_span.innerText = `${RegExp.$1}年${("0" + RegExp.$2).slice(-2)}月${("0" + RegExp.$3).slice(-2)}日`.replace(/[0-9]/g, s => {
								return String.fromCharCode(s.charCodeAt(0) + 0xFEE0)
							})
						}
					}
				}
				let title = ""
				for (let el_a of doc.getElementsByTagName("A")) {
					const href = el_a.getAttribute("href") || ""
					if (!href.match(/^http/)) {
						el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href) //`https://kakuyomu.jp${href}`
					}
					if (el_a.getAttribute("data-link-click-action-name") == "WorksEpisodesEpisodeHeaderPreviousEpisode") {
						item["prev-episode"] = el_a.href
						item["prev-episode-text"] = el_a.innerHTML
						el_a.style.display = "none"
					} else if (el_a.getAttribute("data-link-click-action-name") == "WorksEpisodesEpisodeFooterNextEpisode") {
						item["next-episode"] = el_a.href
						item["next-episode-text"] = el_a.innerHTML
						el_a.style.display = "none"
					} else if (el_a.getAttribute("itemprop") == "item") {
						item["episode-index"] = el_a.href
						item["episode-index-text"] = "目次へ"
						title = `<a class="kakuyomu_title" href="${el_a.href}">${el_a.getAttribute("title")}</a>`
						el_a.style.display = "none"
					}
				}
				item["html"] = title + doc.body.innerHTML
				return item
			})
			.catch(err => {
				return err
			})
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (let u of url) {
				if (this.Match(u)) {
					let item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let index_url = ""
			url = appendSlash(url)
			if (url.match(/(https:\/\/kakuyomu\.jp\/works\/.*?)\//)) {
				index_url = RegExp.$1
			} else {
				return null
			}
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8"
			})}`
			let html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			let parser = new DOMParser()
			let doc = parser.parseFromString(html, "text/html")
			return {
				url: removeSlash(url),
				max_page: doc.getElementsByClassName("widget-toc-episode-titleLabel").length,
				name: doc.getElementById("workTitle").innerText,
				author: doc.getElementById("workAuthor-activityName").innerText
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/(https:\/\/kakuyomu\.jp\/works\/.*?)\/(episodes\/.*)\/$/)) {
				let page_url = RegExp.$2
				let index_url = RegExp.$1
				let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: `${url}episode_sidebar`,
					charset: "UTF-8"
				})}`
				let html = await fetch(req_url)
					.then(response => response.text())
					.then(text => text)
				let parser = new DOMParser()
				let doc = parser.parseFromString(html, "text/html")
				let page_no = 0
				for (let anchor of doc.getElementsByClassName("widget-toc-episode-episodeTitle")) {
					++page_no
					if (anchor.href.includes(page_url)) {
						break
					}
				}
				return { url: removeSlash(url), page_no: page_no, index_url: index_url }
			} else if (url.match(/https:\/\/kakuyomu\.jp\/works\/[^\/]+\/$/)) {
				return { url: removeSlash(url), page_no: 0, index_url: removeSlash(url) }
			}
		}
		return null
	}
	Name = () => "カクヨム"
}
TxtMiruSiteManager.AddSite(new Kakuyomu())

class Aozora extends TxtMiruSitePlugin {
	cache = []
	IndexUrl = url => url.replace(/\.html\?[0-9]+$/, ".html")
	GetCacheHtml = url => {
		for (const item of this.cache) {
			if (item.url == url) {
				return item.html
			}
		}
		return null
	}
	SetCacheHtml = (url, html) => {
		if (this.cache.length > 5) {
			this.cache.shift()
		}
		this.cache.push({ url: url, html: html })
	}
	Match = url => url.match(/https*:\/\/www\.aozora\.gr\.jp/)
	ParseHtml = (url, index_url, html) => {
		html = html
			.replace(/［＃(.*?)］/g, (all, m) => {
				if (m.match(/底本/)) {
					return `<sup title='${m}'>※</sup>`
				} else if (m.match(/、U\+([0-9A-Za-z]+)/)) {
					return `&#x${RegExp.$1};`
				}
				return ""
			})
		let doc = TxtMiruLib.HTML2Document(html)
		if (doc.getElementsByClassName("main_text").length == 0) {
			doc.body.innerHTML = `<div class="main_text">${doc.body.innerHTML}</div>`
		}
		document.title = doc.title
		TxtMiruLib.KumihanMod(url, doc)

		let item = {
			className: "Aozora",
			"next-episode-text": "次へ",
			"prev-episode-text": "前へ",
			"episode-index-text": "青空文庫",
			"episode-index": "https://www.aozora.gr.jp"
		}
		const next_episode = doc.getElementById("next-episode")
		if (next_episode) {
			next_episode.style.display = "none"
			item["next-episode"] = next_episode.href
			item["next-episode-text"] = next_episode.innerText
		}
		const prev_episode = doc.getElementById("prev-episode")
		if (prev_episode) {
			prev_episode.style.display = "none"
			item["prev-episode"] = prev_episode.href
			item["prev-episode-text"] = prev_episode.innerText
		}
		if (html.length > 50000) {
			let target_no = 1
			if (url.match(/\.html\?([0-9]+)/)) {
				target_no = parseInt(RegExp.$1)
			}
			let subtitle = {}
			let n = 0
			for (const main_e of doc.getElementsByClassName("main_text")) {
				let remove_nodes = []
				for (const e of main_e.childNodes) {
					if ((e.className && e.className.match(/jisage/))
						&& (e.innerHTML && e.innerHTML.match(/naka\-midashi/))) {
						++n
						subtitle[n] = e.innerText
					}
					if (n > 0 && n < target_no) {
						remove_nodes.push(e)
					}
					if (n > target_no) {
						remove_nodes.push(e)
					}
				}
				for (const e of remove_nodes) {
					main_e.removeChild(e)
				}
				main_e.setAttribute("max-page", n)
			}
			if (target_no > 1) {
				item["prev-episode"] = `${index_url}?${target_no - 1}`
				item["prev-episode-text"] = subtitle[target_no - 1] || "前へ"
			}
			if (target_no < n) {
				item["next-episode"] = `${index_url}?${target_no + 1}`
				item["next-episode-text"] = subtitle[target_no + 1] || "次へ"
			}
		}
		let title = ""
		//
		item["html"] = title + doc.body.innerHTML
		doc.innerHTML = ""
		return item
	}
	GetDocument = (txtMiru, url) => {
		const index_url = this.IndexUrl(url)
		const html = this.GetCacheHtml(index_url)
		if (html) {
			return new Promise(resolve => {
				setTimeout(() => resolve(this.ParseHtml(url, index_url, html)))
			})
		}
		let charset = "UTF-8"
		if (url.match(/files/)) {
			charset = "Shift_JIS"
		}
		const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "Auto"
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(text => {
				this.SetCacheHtml(index_url, text)
				return this.ParseHtml(url, index_url, text)
			})
			.catch(err => err)
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (const u of url) {
				if (this.Match(u)) {
					const item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let target_url = url
			if (url.match(/\/cards\/[0-9]+\/files\/[0-9_]+.*\.html/)) {
				target_url = url.replace(/\.html\?[0-9]+?/, ".html")
			} else if (url.match(/^(.*\/cards\/.+\/)files\/([0-9_]+)/)) {
				target_url = `${RegExp.$1}card${RegExp.$2}.html`
			}
			const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${target_url}`,
				charset: "Auto"
			})}`
			let html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			const parser = new DOMParser()
			let doc = parser.parseFromString(html, "text/html")

			let item = {
				url: url,
				max_page: 1,
				name: "",
				author: ""
			}
			const e_title = doc.getElementsByClassName("title")
			if (e_title.length > 0) {
				item.name = e_title[0].innerText
			} else {
				let h1 = doc.getElementsByTagName("h1")
				if (h1.length > 0) {
					item.name = h1[0].innerText
				}
			}
			const e_author = doc.getElementsByClassName("author")
			if (e_author.length > 0) {
				item.author = e_author[0].innerText
			} else {
				const h2 = doc.getElementsByTagName("h2")
				if (h2.length > 0) {
					item.author = h2[0].innerText
				}
			}
			for (const e of doc.getElementsByClassName("header")) {
				if (e.innerText == "作品名：") {
					item.name = e.nextElementSibling.innerText
				} else if (e.innerText == "著者名：") {
					item.author = e.nextElementSibling.innerText
				}
			}
			let n = 0
			for (const main_e of doc.getElementsByClassName("main_text")) {
				for (const e of main_e.childNodes) {
					if ((e.className && e.className.match(/jisage/))
						&& (e.innerHTML && e.innerHTML.match(/naka\-midashi/))) {
						++n
					}
				}
				item.max_page = n
			}
			return item
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			if (url.match(/^(.*\.html)\?([0-9]+)$/)) {
				return { url: url, page_no: parseInt(RegExp.$2), index_url: RegExp.$1 }
			} else {
				return { url: url, page_no: 1, index_url: url }
			}
		}
		return null
	}
	Name = () => "青空文庫"
}
TxtMiruSiteManager.AddSite(new Aozora())

class Alphapolis extends TxtMiruSitePlugin {
	Match = url => url.match(/www\.alphapolis\.co\.jp\//)
	GetDocument = async (txtMiru, url) => {
		let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "UTF-8",
			cookie: "request"
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(text => {
				const doc = TxtMiruLib.HTML2Document(text)
				document.title = doc.title
				TxtMiruLib.KumihanMod(url, doc)
				let remove_nodes = []
				for (const id of ["gnbid", "breadcrumbs", "navbar", "header", "footer"]) {
					remove_nodes.push(doc.getElementById(id))
				}
				for (const className of ["novel-freespace", "novel-action", "bookmark", "ScrollUpDown", "ranking-banner", "change-font-size", "alphapolis_title"]) {
					for (const e of doc.getElementsByClassName(className)) {
						remove_nodes.push(e)
					}
				}
				for (const e of remove_nodes) {
					if (e) {
						e.parentNode.removeChild(e)
					}
				}
				let item = {
					className: "Alphapolis",
					"next-episode-text": "次へ",
					"prev-episode-text": "前へ",
					"episode-index-text": "アルファポリス",
					"episode-index": "https://www.alphapolis.co.jp"
				}
				for (let el of doc.getElementsByClassName("episode")) {
					for (let el_span of el.getElementsByTagName("SPAN")) {
						if (el_span.innerText.match(/([0-9]+)年([0-9]+)月([0-9]+)日/)) {
							el_span.innerText = `${RegExp.$1}年${("0" + RegExp.$2).slice(-2)}月${("0" + RegExp.$3).slice(-2)}日`.replace(/[0-9]/g, s => {
								return String.fromCharCode(s.charCodeAt(0) + 0xFEE0)
							})
						}
						if (el_span.innerText.match(/([0-9]+)\.([0-9]+)\.([0-9]+) ([0-9]+):([0-9]+)/)) {
							el_span.innerText = `${RegExp.$1}/${("0" + RegExp.$2).slice(-2)}/${("0" + RegExp.$3).slice(-2)} ${("0" + RegExp.$4).slice(-2)}:${("0" + RegExp.$5).slice(-2)}`
						}
					}
				}
				let title = ""
				for (const el_a of doc.getElementsByTagName("A")) {
					const href = el_a.getAttribute("href") || ""
					if (!href.match(/^http/)) {
						el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href)
					}
					if (el_a.className == "label-circle prev") {
						item["prev-episode"] = el_a.href
						item["prev-episode-text"] = el_a.innerHTML
						el_a.style.display = "none"
					} else if (el_a.className == "label-circle next") {
						item["next-episode"] = el_a.href
						item["next-episode-text"] = el_a.innerHTML
						el_a.style.display = "none"
					} else if (el_a.className == "label-circle cover") {
						item["episode-index"] = el_a.href
						el_a.style.display = "none"
					}
				}
				item["html"] = title + doc.body.innerHTML
				return item
			})
			.catch(err => {
				return err
			})
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (const u of url) {
				if (this.Match(u)) {
					const item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let index_url = ""
			url = appendSlash(url)
			if (url.match(/(https:\/\/www\.alphapolis\.co\.jp\/novel\/[0-9]+\/[0-9]+\/)/)) {
				index_url = RegExp.$1
			} else {
				return null
			}
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8",
				cookie: "request"
			})}`
			let html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			let parser = new DOMParser()
			let doc = parser.parseFromString(html, "text/html")
			let name = doc.title
			let author = ""
			let max_page = 0
			for (const el_main of doc.getElementsByClassName("content-main")) {
				for (const e_name of el_main.getElementsByClassName("title")) {
					name = e_name.innerText.replace(/[\n\t]/g, "")
				}
				for (const e_author of el_main.getElementsByClassName("author")) {
					let remove_nodes = []
					for (const className of ["diary-count"]) {
						for (const e of e_author.getElementsByClassName(className)) {
							remove_nodes.push(e)
						}
					}
					for (const e of remove_nodes) {
						if (e) {
							e.parentNode.removeChild(e)
						}
					}
					author = e_author.innerText.replace(/[\n\t]/g, "")
				}
			}
			for (const el_main of doc.getElementsByClassName("body")) {
				max_page = el_main.getElementsByClassName("episode").length
			}
			return {
				url: removeSlash(url),
				max_page: max_page,
				name: name,
				author: author
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/(https:\/\/www\.alphapolis\.co\.jp\/novel\/.*?)\/(episode\/.*)\/$/)) {
				let page_url = RegExp.$2
				let index_url = RegExp.$1
				let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: index_url,
					charset: "UTF-8",
					cookie: "request"
				})}`
				let html = await fetch(req_url)
					.then(response => response.text())
					.then(text => text)
				let parser = new DOMParser()
				let doc = parser.parseFromString(html, "text/html")
				let page_no = 0
				for (let anchor of doc.getElementsByTagName("A")) {
					if (anchor.getElementsByClassName("title").length > 0) {
						++page_no
						if (anchor.href.includes(page_url)) {
							break
						}
					}
				}
				return { url: removeSlash(url), page_no: page_no, index_url: index_url }
			} else if (url.match(/https:\/\/www\.alphapolis\.co\.jp\/novel\/[0-9]+\/[0-9]+\/$/)) {
				return { url: removeSlash(url), page_no: 0, index_url: removeSlash(url) }
			}
		}
		return null
	}
	Name = () => "アルファポリス"
}
TxtMiruSiteManager.AddSite(new Alphapolis())

class Hameln extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/syosetu\.org\//)
	GetDocument = async (txtMiru, url) => {
		let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "UTF-8"
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(text => {
				const doc = TxtMiruLib.HTML2Document(text)
				document.title = doc.title
				let dummy_url = url
				if (!dummy_url.match(/\.html$/)) {
					dummy_url = appendSlash(url) + "index.html"
				}
				TxtMiruLib.KumihanMod(dummy_url, doc)
				let remove_nodes = []
				for (const id of ["gnbid", "breadcrumbs", "navbar", "header", "footer"]) {
					remove_nodes.push(doc.getElementById(id))
				}
				for (const e of remove_nodes) {
					if (e) {
						e.parentNode.removeChild(e)
					}
				}
				let item = {
					className: "Hameln",
					"episode-index-text": "ハーメルン",
					"episode-index": "https://syosetu.org"
				}
				let title = ""
				for (const el_p of doc.getElementsByTagName("P")) {
					if (el_p.innerText.match(/\s\S*作：/)) {
						const el_a_arr = el_p.getElementsByTagName("A")
						if (el_a_arr.length == 2) {
							el_a_arr[0].className = "title"
							el_a_arr[1].className = "author"
							el_p.innerHTML = el_a_arr[0].outerHTML + el_a_arr[1].outerHTML
						}
						break
					}
				}
				for (const el_a of doc.getElementsByTagName("A")) {
					const href = el_a.getAttribute("href") || ""
					if (!href.match(/^http/)) {
						el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href)
					}
					if (el_a.innerText == "<< 前の話") {
						item["prev-episode"] = el_a.href
						item["prev-episode-text"] = "前へ"
					} else if (el_a.innerText == "次の話 >>") {
						item["next-episode"] = el_a.href
						item["next-episode-text"] = "次へ"
					} else if (el_a.innerText == "目 次") {
						item["episode-index"] = el_a.href
						item["episode-index-text"] = "目次へ"
					}
				}
				item["html"] = title + doc.body.innerHTML
				return item
			})
			.catch(err => {
				return err
			})
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (const u of url) {
				if (this.Match(u)) {
					const item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let index_url = ""
			url = appendSlash(url)
			if (url.match(/(https:\/\/syosetu\.org\/novel\/[0-9]+)\//)) {
				index_url = RegExp.$1
			} else {
				return null
			}
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8"
			})}`
			let html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			let parser = new DOMParser()
			let doc = parser.parseFromString(html, "text/html")
			let name = doc.title
			let author = ""
			let max_page = 0
			for (const el of doc.getElementsByTagName("SPAN")) {
				const itemprop = el.getAttribute("itemprop")
				if (itemprop == "name") {
					name = el.innerText
				} else if (itemprop == "author") {
					author = el.innerText
				} else {
					const id = el.id || ""
					if (id.match(/^[0-9]+$/)) {
						max_page = Math.max(max_page, parseInt(id))
					}
				}
			}
			return {
				url: removeSlash(url),
				max_page: max_page,
				name: name,
				author: author
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/(https:\/\/syosetu\.org\/novel\/.*?)\/([0-9]+).html\/$/)) {
				let page_no = RegExp.$2
				let index_url = RegExp.$1
				return { url: removeSlash(url), page_no: page_no, index_url: index_url }
			} else if (url.match(/(https:\/\/syosetu\.org\/novel\/[0-9]+)\//)) {
				return { url: removeSlash(url), page_no: 0, index_url: removeSlash(url) }
			}
		}
		return null
	}
	Name = () => "ハーメルン"
}
TxtMiruSiteManager.AddSite(new Hameln())

class Akatsuki extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/www\.akatsuki\-novels\.com\//)
	GetDocument = async (txtMiru, url) => {
		let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "UTF-8"
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(text => {
				const doc = TxtMiruLib.HTML2Document(text)
				document.title = doc.title
				let dummy_url = url
				if (!dummy_url.match(/\.html$/)) {
					dummy_url = appendSlash(url) + "index.html"
				}
				TxtMiruLib.KumihanMod(dummy_url, doc)
				let remove_nodes = []
				for (const id of ["trace", "header", "footer"]) {
					remove_nodes.push(doc.getElementById(id))
				}
				for (const className of ["spacer"]) {
					for (const e of doc.getElementsByClassName(className)) {
						remove_nodes.push(e)
					}
				}
				for (const e of doc.getElementsByTagName("SPAN")) {
					if (e.innerText.match(/しおりを利用するにはログインしてください。会員登録がまだの場合はこちらから。/)) {
						remove_nodes.push(e)
					}
				}
				for (const e of remove_nodes) {
					if (e) {
						e.parentNode.removeChild(e)
					}
				}
				remove_nodes = []
				let item = {
					className: "Akatsuki",
					"episode-index-text": "暁",
					"episode-index": "https://www.akatsuki-novels.com/"
				}
				for (const el of doc.getElementsByTagName("H3")) {
					if (el.innerText.match(/作者：/)) {
						const el_a_arr = el.getElementsByTagName("A")
						if (el_a_arr.length == 1) {
							el_a_arr[0].className = "author"
							el.innerHTML = el_a_arr[0].outerHTML
						}
					}
				}
				for (const el of doc.getElementsByTagName("DIV")) {
					if (el.innerText.match(/作者：/)) {
						const el_a_arr = el.getElementsByTagName("A")
						if (el_a_arr.length == 1) {
							el_a_arr[0].className = "author"
							el.innerHTML = el_a_arr[0].outerHTML
						}
					}
				}
				let title = ""
				for (const el_a of doc.getElementsByTagName("A")) {
					const href = el_a.getAttribute("href") || ""
					if (!href.match(/^http/)) {
						el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href)
					}
					if (href.match(/https:\/\/twitter\.com/)) {
						remove_nodes.push(el_a)
					}
					if (el_a.innerText == "< 前ページ") {
						item["prev-episode"] = el_a.href
						item["prev-episode-text"] = "前へ"
					} else if (el_a.innerText == "次ページ >") {
						item["next-episode"] = el_a.href
						item["next-episode-text"] = "次へ"
					} else if (el_a.innerText == "目次") {
						item["episode-index"] = el_a.href
						item["episode-index-text"] = "目次へ"
					}
				}
				for (const e of remove_nodes) {
					if (e) {
						e.parentNode.removeChild(e)
					}
				}
				item["html"] = title + doc.body.innerHTML
				return item
			})
			.catch(err => {
				return err
			})
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (const u of url) {
				if (this.Match(u)) {
					const item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let index_url = ""
			url = appendSlash(url)
			if (url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/view\/[0-9]+\/novel_id~([0-9]+)\/$/)) {
				index_url = `https://www.akatsuki-novels.com/stories/index/novel_id~${RegExp.$1}`
			} else if (url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/index\/novel_id~[0-9]+\/$/)) {
				index_url = removeSlash(url)
			} else {
				return null
			}
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8"
			})}`
			let html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			let parser = new DOMParser()
			let doc = parser.parseFromString(html, "text/html")
			let name = doc.title
			let author = ""
			let max_page = 0
			for (const table of doc.getElementsByClassName("list")) {
				for (const anchor of table.getElementsByTagName("A")) {
					++max_page
				}
			}
			const el_title = doc.getElementById("LookNovel")
			if (el_title) {
				name = el_title.innerText
			}
			for (const el of doc.getElementsByTagName("H3")) {
				if (el.innerText.match(/作者：/)) {
					const el_a_arr = el.getElementsByTagName("A")
					if (el_a_arr.length == 1) {
						author = el_a_arr[0].innerText
						break
					}
				}
			}
			return {
				url: removeSlash(url),
				max_page: max_page,
				name: name,
				author: author
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/view\/([0-9]+)\/novel_id~([0-9]+)\/$/)) {
				const page_url = RegExp.$1
				const index_url = `https://www.akatsuki-novels.com/stories/index/novel_id~${RegExp.$2}`
				const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: `${index_url}`,
					charset: "UTF-8"
				})}`
				let html = await fetch(req_url)
					.then(response => response.text())
					.then(text => text)
				const parser = new DOMParser()
				const doc = parser.parseFromString(html, "text/html")
				let page_no = 0
				for (const table of doc.getElementsByClassName("list")) {
					for (const anchor of table.getElementsByTagName("A")) {
						++page_no
						if (anchor.href.includes(page_url)) {
							break
						}
					}
				}
				return { url: removeSlash(url), page_no: page_no, index_url: index_url }
			} else if (url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/index\/novel_id~[0-9]+\/$/)) {
				return { url: removeSlash(url), page_no: 0, index_url: removeSlash(url) }
			}
		}
		return null
	}
	Name = () => "暁"
}
TxtMiruSiteManager.AddSite(new Akatsuki())

class Everystar extends TxtMiruSitePlugin {
	cache = []
	GetCacheHtml = url => {
		for (const item of this.cache) {
			if (item.url == url) {
				return item.html
			}
		}
		return null
	}
	SetCacheHtml = (url, html) => {
		if (this.cache.length > 5) {
			this.cache.shift()
		}
		this.cache.push({ url: url, html: html })
	}
	Match = url => url.match(/https:\/\/estar\.jp/)
	getIndexes = async (txtMiru, id) => {
		let indexes = []
		let max_page = 1
		for (let page = 1; page <= max_page; ++page) {
			const url = `https://estar.jp/novels/${id}/episodes?page=${page}`
			const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: url,
				charset: "UTF-8",
			})}`
			await fetch(req_url, null)
				.then(response => response.text())
				.then(text => {
					const doc = TxtMiruLib.HTML2Document(text)
					for (const node of getChildFullLevel(doc.body)) {
						if (node.className == "link link" && hasParentClassName(node, "episodeList")) {
							if (node.innerText && node.innerText.match(/…([0-9]+)ページ/)) {
								indexes.push({ type: "index", href: `./viewer?page=${RegExp.$1 | 0}`, name: node.innerText, update_date: "", page: RegExp.$1 | 0 })
							}
						} else if (max_page == 1 && node.className == "currentPage" && hasParentClassName(node, "pager")) {
							if (node.innerText.match(/[0-9]+\/([0-9]+)/)) {
								max_page = RegExp.$1 | 0;
							}
						}
					}
				})
		}
		return indexes
	}
	GetDocument = async (txtMiru, url) => {
		let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "UTF-8",
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(async text => {
				const doc = TxtMiruLib.HTML2Document(text)
				let indexes = []
				if (url.replace(/\?.*/, "").match(/novels\/([0-9]+)\/*$/)) {
					indexes = await this.getIndexes(txtMiru, RegExp.$1)
				}
				document.title = doc.title
				let dummy_url = url
				if (!dummy_url.match(/viewer/)) {
					dummy_url = appendSlash(url) + "index.html"
				}
				TxtMiruLib.KumihanMod(dummy_url, doc)
				let remove_nodes = []
				for (const id of ["trace", "header", "footer"]) {
					remove_nodes.push(doc.getElementById(id))
				}
				for (const className of ["spacer"]) {
					for (const e of doc.getElementsByClassName(className)) {
						remove_nodes.push(e)
					}
				}
				for (const e of doc.getElementsByTagName("IFRAME")) {
					remove_nodes.push(e)
				}
				for (const e of remove_nodes) {
					if (e) {
						e.parentNode.removeChild(e)
					}
				}
				remove_nodes = []
				let item = {
					className: "Everystar",
					"episode-index-text": "エブリスタ",
					"episode-index": "https://estar.jp"
				}
				if (indexes.length > 0) {
					let title = ""
					let author = ""
					let copy = ""
					let description = ""
					let index = ""
					for (const el of doc.getElementsByClassName("title")) {
						if (hasParentClassName(el, "main")) {
							title = el.innerText
							break
						}
					}
					for (const el of doc.getElementsByClassName("copy")) {
						if (hasParentClassName(el, "main")) {
							copy = el.innerText
							break
						}
					}
					for (const el of doc.getElementsByClassName("nickname")) {
						author = el.innerText
						break
					}
					for (const meta of doc.getElementsByTagName("META")) {
						if (meta.name == "description") {
							const el = doc.getElementsByClassName("textMore")
							if (el.length > 0) {
								description = meta.content
							}
						}
					}
					for (const i of indexes) {
						index += `<div class="novel-toc-episode"><a href="${TxtMiruLib.ConvertAbsoluteURL(dummy_url, i["href"])}">${i["name"].replace("\n", "").replace(/ +$/, "")}</a></div>`
					}
					document.title = title
					item["html"] = `<div class="title">${title}</div><div class="nickname">${author}</div><div>${copy}</div><h3>あらすじ</h3><div class="content">${description}</div><h3>目次</h3><div class="content">${index}</div>`
				} else {
					for (const e of doc.getElementsByTagName("DIV")) {
						if (e.className == "body") {
							e.style = ""
						}
					}
					let title_author = ""
					let cur_page = 0
					if (url.match(/page=([0-9]+)/)) {
						cur_page = parseInt(RegExp.$1)
						let index_url = ""
						url = appendSlash(url)
						if (url.match(/(https:\/\/estar\.jp\/novels\/[0-9]+)/)) {
							index_url = RegExp.$1
							title_author = this.GetCacheHtml(index_url)
							if (!title_author) {
								const item = await this.GetInfo(txtMiru, url)
								title_author = `<div class="title"><a href='${index_url}'>${item.name}</a></div><div class="nickname">${item.author}</div>`
								if (title_author) {
									this.SetCacheHtml(index_url, title_author)
								} else {
									title_author = ""
								}
							}
						}
					}
					let max_page = cur_page
					for (const el of doc.getElementsByClassName("pageNumber")) {
						if (el.innerText && el.innerText.match(/([0-9]+)ページ/)) {
							max_page = parseInt(RegExp.$1)
						}
					}
					for (const el_a of doc.getElementsByTagName("A")) {
						const href = el_a.getAttribute("href") || ""
						if (!href.match(/^http/)) {
							el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href)
						}
						if (href.match(/https:\/\/twitter\.com/)) {
							remove_nodes.push(el_a)
						}
						if (el_a.className == "link link") {
							if (el_a.innerText && el_a.innerText.match(/…([0-9]+)ページ/)) {
								const page = RegExp.$1
								el_a.href = TxtMiruLib.ConvertAbsoluteURL(dummy_url, href) + "viewer?page=" + page
							}
						}
					}
					if (cur_page > 1) {
						item["prev-episode"] = removeSlash(TxtMiruLib.ConvertAbsoluteURL(dummy_url, "viewer?page=" + (cur_page - 1)))
						item["prev-episode-text"] = "前へ"
					}
					if (cur_page < max_page) {
						item["next-episode"] = removeSlash(TxtMiruLib.ConvertAbsoluteURL(dummy_url, "viewer?page=" + (cur_page + 1)))
						item["next-episode-text"] = "次へ"
					}
					item["episode-index"] = TxtMiruLib.ConvertAbsoluteURL(dummy_url, "")
					item["episode-index-text"] = "目次へ"
					for (const e of remove_nodes) {
						if (e) {
							e.parentNode.removeChild(e)
						}
					}
					item["html"] = `${title_author}<br>${cur_page}/${max_page}<br><br>${doc.body.innerHTML}`
				}
				return item
			})
			.catch(err => {
				return err
			})
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (const u of url) {
				if (this.Match(u)) {
					const item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let index_url = ""
			url = appendSlash(url)
			if (url.match(/(https:\/\/estar\.jp\/novels\/[0-9]+)/)) {
				index_url = RegExp.$1
			} else {
				return null
			}
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8"
			})}`
			let html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			let parser = new DOMParser()
			let doc = parser.parseFromString(html, "text/html")
			let title = ""
			let author = ""
			let max_page = 1
			for (const el of doc.getElementsByClassName("title")) {
				if (hasParentClassName(el, "main")) {
					title = el.innerText
					break
				}
			}
			for (const el of doc.getElementsByClassName("nickname")) {
				author = el.innerText
				break
			}
			//
			req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}/viewer?page=1`,
				charset: "UTF-8"
			})}`
			html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			doc = parser.parseFromString(html, "text/html")
			for (const el of doc.getElementsByClassName("pageNumber")) {
				if (el.innerText && el.innerText.match(/([0-9]+)ページ/)) {
					max_page = parseInt(RegExp.$1)
				}
			}
			return {
				url: removeSlash(url),
				max_page: max_page,
				name: title,
				author: author
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/(https:\/\/estar\.jp\/novels\/[0-9]+)\/.*page=([0-9]+)\/$/)) {
				const index_url = RegExp.$1
				const page_no = RegExp.$2
				return { url: removeSlash(url), page_no: page_no, index_url: index_url }
			} else {
				return { url: removeSlash(url), page_no: 0, index_url: removeSlash(url) }
			}
		}
		return null
	}
	Name = () => "エブリスタ"
}
TxtMiruSiteManager.AddSite(new Everystar())

class Magnet extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/www\.magnet\-novels\.com/)
	novelAPI = (func, param) => fetch(`${func}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: param
	}).then(response => response.json())
	GetDocument = async (txtMiru, url) => {
		let item = {
			className: "Magnet",
			"episode-index-text": "マグネット",
			"episode-index": "https://www.magnet-novels.com"
		}
		if (url.match(/novels\/([0-9]+)\/episodes\/([0-9]+)/)) {
			const novel_id = RegExp.$1
			const section_id = RegExp.$2
			const novel_section = await this.novelAPI("https://www.magnet-novels.com/api/web/v2/reader/getNovelSection", `novel_id=${novel_id}&section_id=${section_id}`)
			const novel_info = await this.novelAPI("https://www.magnet-novels.com/api/novel/reader/getNovelInfo", `novel_id=${novel_id}`)
			const novel_contents = await this.novelAPI("https://www.magnet-novels.com/api/web/v2/reader/getNovelContents", `novel_id=${novel_id}`)
			let prev_episode = null
			let next_episode = null
			let sub_title = null
			const contents_data = novel_contents.data
			for (let i = 0; i < contents_data.length; ++i) {
				const data = contents_data[i]
				if (data.type == 0) {
					if (data.id == section_id) {
						if (i < contents_data.length - 1) {
							next_episode = contents_data[i + 1]
						}
						break
					}
					prev_episode = data
				} else {
					sub_title = data
				}
			}
			item["episode-index-text"] = "目次"
			item["episode-index"] = `https://www.magnet-novels.com/novels/${novel_id}`
			if (prev_episode) {
				item["prev-episode"] = `https://www.magnet-novels.com/novels/${novel_id}/episodes/${prev_episode.id}`
				item["prev-episode-text"] = `前へ ${prev_episode.title}`
			}
			if (next_episode) {
				item["next-episode"] = `https://www.magnet-novels.com/novels/${novel_id}/episodes/${next_episode.id}`
				item["next-episode-text"] = `次へ ${next_episode.title}`
			}
			document.title = novel_info.data.name
			item["html"] = `<div class="title"><a href="https://www.magnet-novels.com/novels/${novel_id}">${novel_info.data.name}</a></div><div class="author">${novel_info.data.author.name}</div><div class="subtitle">${sub_title ? sub_title.title : ""}</div><div class="subtitle">${novel_section.data.title}</div><div class="main">${novel_section.data.content_html}</div>`
		} else if (url.match(/novels\/([0-9]+)/)) {
			const novel_id = RegExp.$1
			const novel_info = await this.novelAPI("https://www.magnet-novels.com/api/novel/reader/getNovelInfo", `novel_id=${novel_id}`)
			const novel_contents = await this.novelAPI("https://www.magnet-novels.com/api/web/v2/reader/getNovelContents", `novel_id=${novel_id}`)
			let html_arr = []
			for (const data of novel_contents.data) {
				if (data.type == 0) {
					html_arr.push(`<div class="novel-toc-episode"><a href="https://www.magnet-novels.com/novels/${novel_id}/episodes/${data.id}">${data.title}</a></div>`)
				} else {
					html_arr.push(`<div class="novel-subtitle">${data.title}</div>`)
				}
			}
			document.title = novel_info.data.name
			item["html"] = `<div class="title">${novel_info.data.name}</div><div class="author">${novel_info.data.author.name}</div><div>${html_arr.join("")}</div>`
		} else {
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: url,
				charset: "UTF-8",
			})}`
			return fetch(req_url, null)
				.then(response => response.text())
				.then(async text => {
					const doc = TxtMiruLib.HTML2Document(text)
					document.title = doc.title
					item["html"] = doc.body.innerHTML
					return item
				})
				.catch(err => {
					return err
				})
		}

		return Promise.resolve(item)
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (const u of url) {
				if (this.Match(u)) {
					const item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let novel_id = ""
			let index_url = ""
			if (url.match(/novels\/([0-9]+)/)) {
				novel_id = RegExp.$1
				index_url = `https://www.magnet-novels.com/novels/${novel_id}`
			} else {
				return null
			}
			const novel_info = await this.novelAPI("https://www.magnet-novels.com/api/novel/reader/getNovelInfo", `novel_id=${novel_id}`)
			const novel_contents = await this.novelAPI("https://www.magnet-novels.com/api/web/v2/reader/getNovelContents", `novel_id=${novel_id}`)
			return {
				url: removeSlash(url),
				max_page: novel_contents.data.length,
				name: novel_info.data.name,
				author: novel_info.data.author.name
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/novels\/([0-9]+)\/episodes\/([0-9]+)/)) {
				const novel_id = RegExp.$1
				const section_id = RegExp.$2
				const novel_contents = await this.novelAPI("https://www.magnet-novels.com/api/web/v2/reader/getNovelContents", `novel_id=${novel_id}`)
				let page_no = 0
				for (const item of novel_contents.data) {
					++page_no
					if (item.id == section_id) {
						break
					}
				}
				return { url: removeSlash(url), page_no: page_no, index_url: `https://www.magnet-novels.com/novels/${novel_id}` }
			} else if (url.match(/novels\/([0-9]+)/)) {
				const novel_id = RegExp.$1
				return { url: removeSlash(url), page_no: 0, index_url: `https://www.magnet-novels.com/novels/${novel_id}` }
			}
		}
		return null
	}
	Name = () => "マグネット"
}
TxtMiruSiteManager.AddSite(new Magnet())

class Pixiv extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/www\.pixiv\.net\/novel\//)
	novelAPI = (txtMiru, func) => fetch(`${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
		url: func,
		charset: "UTF-8"
	})}`).then(response => response.json())
	GetDocument = async (txtMiru, url) => {
		const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: url,
			charset: "UTF-8"
		})}`
		return fetch(req_url, null)
			.then(response => response.text())
			.then(async text => {
				let doc = TxtMiruLib.HTML2Document(text)
				document.title = doc.title
				let author = ""
				TxtMiruLib.KumihanMod(url, doc)
				let item = {
					className: "Pixiv",
					"episode-index-text": "pixiv",
					"episode-index": "https://www.pixiv.net/novel/"
				}
				if (url.match(/https:\/\/www\.pixiv\.net\/novel\/member\.php\?id=/)) {
					// [pixiv] プロフィール
					let nodes = doc.getElementsByTagName("h1")
					for (let i = nodes.length - 1; i >= 0; --i) {
						const node = nodes[i]
						if (node.className.match(/^name$/) && node.innerText.length > 0) {
							author = node.innerText
						}
					}
					nodes = doc.getElementsByTagName("h2");
					for (let i = nodes.length - 1; i >= 0; --i) {
						const node = nodes[i]
						if (node.className.match(/^name$/) && node.innerText.length > 0) {
							author = node.innerText
						}
					}
					let profilecomment = ""
					let html = ""
					nodes = doc.getElementsByTagName("div")
					for (let i = nodes.length - 1; i >= 0; --i) {
						const node = nodes[i]
						if (node.className.match(/novel\-contents/)) {
							profilecomment += node.innerHTML
						} else if (node.className.match(/require\-register/)) {
							html += node.innerHTML
						}
					}
					item["html"] = `${profilecomment}${html}`
				} else if (url.match(/https:\/\/www\.pixiv\.net\/novel\//)) {
					// [pixiv] 小説
					let title = ""
					let author = ""
					let html_arr = []
					if (url.match(/https:\/\/www\.pixiv\.net\/novel\/series\/([0-9]+)/)) {
						const id = RegExp.$1
						const novel_contents = await this.novelAPI(txtMiru, `https://www.pixiv.net/ajax/novel/series/${id}?lang=ja`)
						title = novel_contents.body.title
						author = novel_contents.body.userName
						html_arr.push("<br>")
						html_arr.push(novel_contents.body.extraData.meta.description)
						let order = 0
						html_arr.push(`<h3>目次</h3><ol class="novel-toc-items">`)
						do {
							const json = await this.novelAPI(txtMiru, `https://www.pixiv.net/ajax/novel/series_content/${id}?limit=10&last_order=${order}&order_by=asc&lang=ja`)
							if (json.body["seriesContents"].length <= 0) {
								break
							}
							for (const series_content of json.body["seriesContents"]) {
								let date = new Date()
								date.setTime(series_content.reuploadTimestamp * 1000)
								const date_str = date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日"
								html_arr.push(`<li class="novel-toc-episode"><a href='https://www.pixiv.net/novel/show.php?id=${series_content.id}'>${series_content.title}</a><span class="novel-toc-episode-datePublished">${date_str}</span></li>`)
							}
							order += 10
						} while (true)
						html_arr.push("</ol>")
					} else if (url.match(/https:\/\/www\.pixiv\.net\/novel\/show\.php\?id=([0-9]+)/)) {
						const id = RegExp.$1
						try {
							const meta_content = doc.getElementsByName('preload-data')[0].content
							//
							const json = JSON.parse(meta_content)
							const data = json.novel[id]
							const content = data.content
							author = data.userName
							title = data.title
							try {
								title = `<a href="https://www.pixiv.net/novel/series/${data.seriesNavData.seriesId}">${data.seriesNavData.title}</a>`
								item["episode-index"] = `https://www.pixiv.net/novel/series/${data.seriesNavData.seriesId}`
								item["episode-index-text"] = "目次へ"
							} catch (e) { }
							try {
								item["next-episode"] = `https://www.pixiv.net/novel/show.php?id=${data.seriesNavData.next.id}`
								item["next-episode-text"] = "次へ"
							} catch (e) { }
							try {
								item["prev-episode"] = `https://www.pixiv.net/novel/show.php?id=${data.seriesNavData.prev.id}`
								item["prev-episode-text"] = "前へ"
							} catch (e) { }
							let doc0 = TxtMiruLib.HTML2Document(content)
							TxtMiruLib.KumihanMod(url, doc0)
							html_arr.push(doc0.body.innerHTML)
						} catch (e) {
						}
					}
					item["html"] = `<div class="title">${title}</div><div class="author">${author}</div><div class="main">${html_arr.join("")}</div>`
				}
				return Promise.resolve(item)
			})
			.catch(err => {
				return err
			})
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			let results = []
			for (const u of url) {
				if (this.Match(u)) {
					const item = await this.GetInfo(txtMiru, u, callback)
					if (item != null) {
						results.push(item)
					}
				}
			}
			return results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let novel_id = ""
			let index_url = ""
			if (url.match(/https:\/\/www\.pixiv\.net\/novel\/show\.php\?id=([0-9]+)/)) {
				const novel_contents = await fetch(`${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: removeSlash(url),
					charset: "UTF-8"
				})}`).then(response => response.text())
				let doc = TxtMiruLib.HTML2Document(novel_contents)
				let meta_content = doc.getElementsByName('preload-data')[0].content
				let json = JSON.parse(meta_content)
				let data = json.novel[novel_id]
				index_url = `https://www.pixiv.net/ajax/novel/series/${data.seriesNavData.seriesId}?lang=ja`
			} else if (url.match(/novel\/series\/([0-9]+)/)) {
				novel_id = RegExp.$1
				index_url = `https://www.pixiv.net/ajax/novel/series/${novel_id}?lang=ja`
			} else {
				return null
			}
			//
			const novel_contents = await this.novelAPI(txtMiru, `https://www.pixiv.net/ajax/novel/series/${novel_id}?lang=ja`)
			return {
				url: removeSlash(url),
				max_page: novel_contents.body.displaySeriesContentCount,
				name:  novel_contents.body.title,
				author: novel_contents.body.userName
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			if (url.match(/https:\/\/www\.pixiv\.net\/novel\/show\.php\?id=([0-9]+)/)) {
				const novel_id = RegExp.$1
				const novel_contents = await fetch(`${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: removeSlash(url),
					charset: "UTF-8"
				})}`).then(response => response.text())
				let doc = TxtMiruLib.HTML2Document(novel_contents)
				let meta_content = doc.getElementsByName('preload-data')[0].content
				let json = JSON.parse(meta_content)
				let data = json.novel[novel_id]
				return { url: removeSlash(url), page_no: parseInt(data.pageCount) + 1, index_url: `https://www.pixiv.net/novel/series/${data.seriesNavData.seriesId}` }
			} else if (url.match(/novels\/series\/([0-9]+)/)) {
				const novel_id = RegExp.$1
				return { url: removeSlash(url), page_no: 0, index_url: `https://www.pixiv.net/novel/series/${novel_id}` }
			}
		}
		return null
	}
	Name = () => "pixiv"
}
TxtMiruSiteManager.AddSite(new Pixiv())
