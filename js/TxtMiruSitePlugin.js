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
	Match = url => url.match(/https*:\/\/www\.aozora\.gr\.jp/)
	GetDocument = (txtMiru, url) => {
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
				text = text
					.replace(/［＃(.*?)］/g, (all, m) => {
						if (m.match(/底本/)) {
							return `<sup title='${m}'>※</sup>`
						} else if (m.match(/、U\+([0-9A-Za-z]+)/)) {
							return `&#x${RegExp.$1};`
						}
						console.log(m)
						return ""
					})
				let doc = TxtMiruLib.HTML2Document(text)
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
				if (text.length > 500000) {
					let style = ""
					let pre_e = null
					for (let main_e of doc.getElementsByClassName("main_text")) {
						for (let e of main_e.childNodes) {
							if (!e.className || !e.className.match(/jisage/) || !e.innerHTML.match(/naka\-midashi/)) {
								continue
							}
							if (pre_e) {
								let div = doc.createElement("div")
								div.style = style
								style = "display:none"
								let i = pre_e.nextSibling
								i.parentNode.insertBefore(div, i)
								while (i && i != e) {
									let n = i.nextSibling
									div.appendChild(i)
									i = n
								}
							}
							pre_e = e
						}
					}
					if (pre_e) {
						let div = doc.createElement("div")
						div.style = style
						style = "display:none"
						let i = pre_e.nextSibling
						i.parentNode.insertBefore(div, i)
						while (i) {
							let n = i.nextSibling
							div.appendChild(i)
							i = n
						}
					}
				}
				let title = ""
				//
				item["html"] = title + doc.body.innerHTML
				doc.innerHTML = ""
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
			if (url.match(/^(.*\/cards\/.+\/)files\/([0-9]+)/)) {
				url = `${RegExp.$1}card${RegExp.$2}.html`
			}
			let req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${url}`,
				charset: "shift-jis"
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
			for (let e of doc.getElementsByClassName("header")) {
				if (e.innerText == "作品名：") {
					item.name = e.nextElementSibling.innerText
				} else if (e.innerText == "著者名：") {
					item.author = e.nextElementSibling.innerText
				}
			}
			return item
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			return { url: url, page_no: 1, index_url: url }
		}
		return null
	}
	Name = () => "青空文庫"
}
TxtMiruSiteManager.AddSite(new Aozora())
