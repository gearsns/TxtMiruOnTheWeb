import { TxtMiruLib } from './TxtMiruLib.js?1.3'
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

class TxtMiruSitePlugin {
	Match = url => false
	GetInfo = (txtMiru, url, callback = null) => false
	GetPageNo = (txtMiru, url) => { }
	Name = () => ""
}

export class TxtMiruSiteManager {
	static site_list = []
	static AddSite = site => this.site_list.push(site)
	static SiteList = () => this.site_list
	static GetDocument = (txtMiru, url) => {
		for (let site of this.site_list) {
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

class Narou extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/ncode\.syosetu\.com/)
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
				let item = { className: "Narou" }
				//
				for (let el_a of doc.getElementsByTagName("A")) {
					let href = el_a.getAttribute("href")
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
				for (let el of doc.getElementsByClassName("long_update")) {
					let el_rev = null
					for (let el_span of el.getElementsByTagName("SPAN")) {
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
		if (url.match(/https:\/\/ncode\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
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
			for (let u of url) {
				if (this.Match(u)) {
					let ncode = u
					if (u.match(/https:\/\/ncode\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
						ncode = `n${RegExp.$1}`
					}
					item_list.push(u)
					requests.push(ncode.toUpperCase())
					if (requests.length > 10) {
						if (callback) {
							callback(item_list)
						}
						for (let item of await this.getUpdateInfo(requests.join("-"))) {
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
				for (let item of await this.getUpdateInfo(requests.join("-"))) {
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
			for (let u of url) {
				let ncode = u
				if (u.match(/https:\/\/ncode\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
					ncode = `n${RegExp.$1}`.toUpperCase()
				}
				ncode = ncode.toUpperCase()
				for (let ret of results) {
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
			if (url.match(/https:\/\/ncode\.syosetu\.com\/n([A-Za-z0-9]+)/)) {
				ncode = `n${RegExp.$1}`.toUpperCase()
			}
			ncode = ncode.toUpperCase()
			if (callback) {
				callback([url])
			}
			for (let item of await this.getUpdateInfo(url)) {
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
			if (url.match(/(https:\/\/ncode\.syosetu\.com\/n[A-Za-z0-9]+)\/([0-9]+)/)) {
				let page_no = RegExp.$2 | 0
				let index_url = RegExp.$1
				index_url = appendSlash(index_url)
				return { url: url, page_no: page_no, index_url: index_url }
			} else if (url.match(/https:\/\/ncode\.syosetu\.com\/n[A-Za-z0-9]+\/$/)) {
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
					"episode-index-text": "目次へ"
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
					let href = el_a.getAttribute("href")
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
		if(this.cache.length > 5){
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
			for (let main_e of doc.getElementsByClassName("main_text")) {
				let remove_nodes = []
				for (let e of main_e.childNodes) {
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
				for(let e of remove_nodes){
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
		let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
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
			let target_url = url
			if (url.match(/\/cards\/[0-9]+\/files\/[0-9_]+.*\.html/)) {
				target_url = url.replace(/\.html\?[0-9]+?/, ".html")
			} else if (url.match(/^(.*\/cards\/.+\/)files\/([0-9_]+)/)) {
				target_url = `${RegExp.$1}card${RegExp.$2}.html`
			}
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${target_url}`,
				charset: "Auto"
			})}`
			let html = await fetch(req_url)
				.then(response => response.text())
				.then(text => text)
			let parser = new DOMParser()
			let doc = parser.parseFromString(html, "text/html")

			let item = {
				url: url,
				max_page: 1,
				name: "",
				author: ""
			}
			let e_title = doc.getElementsByClassName("title")
			if (e_title.length > 0) {
				item.name = e_title[0].innerText
			} else {
				let h1 = doc.getElementsByTagName("h1")
				if (h1.length > 0) {
					item.name = h1[0].innerText
				}
			}
			let e_author = doc.getElementsByClassName("author")
			if (e_author.length > 0) {
				item.author = e_author[0].innerText
			} else {
				let h2 = doc.getElementsByTagName("h2")
				if (h2.length > 0) {
					item.author = h2[0].innerText
				}
			}
			for (let e of doc.getElementsByClassName("header")) {
				if (e.innerText == "作品名：") {
					item.name = e.nextElementSibling.innerText
				} else if (e.innerText == "著者名：") {
					item.author = e.nextElementSibling.innerText
				}
			}
			let n = 0
			for (let main_e of doc.getElementsByClassName("main_text")) {
				for (let e of main_e.childNodes) {
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
