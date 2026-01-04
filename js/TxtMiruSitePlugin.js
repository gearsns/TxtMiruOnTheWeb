import { TxtMiruLib } from './TxtMiruLib.js?1.0.20.1'
import fetchJsonp from './lib/fetch-jsonp.js'
import { narou2html } from './lib/narou.js?1.0.20.1'
import { AozoraText2Html } from './lib/aozora.js?1.0.20.1'
import { CacheFiles } from './TxtMiruCacheFiles.js?1.0.20.1'

const sleep = time => new Promise(resolve => setTimeout(resolve, time))
const appendSlash = text => text.match(/\/$/) ? text : text + "/"
const removeSlash = text => text.replace(/\/$/, "")
const removeNodes = remove_nodes => {
	for (const e of remove_nodes) {
		e?.parentNode?.removeChild(e)
	}
}
const setItemEpisodeText = (id, href, text, item) => {
	item[id] = href
	item[`${id}-text`] = text
}
const setItemEpisodeElement = (id, el_a, item) => setItemEpisodeText(id, el_a.href, el_a.textContent, item)
const checkForcePager = (doc, item) => {
	const elTxtMiruCurPage = doc.getElementById("TxtMiruCurPage")
	const elTxtMiruPrevPage = doc.getElementById("TxtMiruPrevPage")
	const elTxtMiruTocPage = doc.getElementById("TxtMiruTocPage")
	const elTxtMiruNextPage = doc.getElementById("TxtMiruNextPage")
	if (elTxtMiruCurPage) {
		item["page_no"] = elTxtMiruCurPage.getAttribute("page_no")
	}
	if (elTxtMiruPrevPage) {
		setItemEpisodeElement("prev-episode", elTxtMiruPrevPage, item)
	}
	if (elTxtMiruTocPage) {
		setItemEpisodeElement("episode-index", elTxtMiruTocPage, item)
	}
	if (elTxtMiruNextPage) {
		setItemEpisodeElement("next-episode", elTxtMiruNextPage, item)
	}
	const func = {}
	if (elTxtMiruPrevPage || elTxtMiruTocPage || elTxtMiruNextPage) {
		func.setPrevEpisode = (el_a, _) => el_a.style.display = "none"
		func.setNextEpisode = (el_a, _) => el_a.style.display = "none"
		func.setEpisodeIndex = (el_a, _) => el_a.style.display = "none"
	} else {
		func.setPrevEpisode = (el_a, item) => setItemEpisodeElement("prev-episode", el_a, item)
		func.setNextEpisode = (el_a, item) => setItemEpisodeElement("next-episode", el_a, item)
		func.setEpisodeIndex = (el_a, item) => setItemEpisodeText("episode-index", el_a.href, "目次へ", item)
	}
	return func
}
const parseHtml = (url, index_url, html, class_name) => {
	const item = {
		className: class_name
	}
	const doc = TxtMiruLib.HTML2Document(html)
	if (doc.getElementsByClassName("main_text").length === 0) {
		doc.body.innerHTML = `<div class="main_text">${doc.body.innerHTML}</div>`
	}
	// title
	item["title"] = doc.title
	for (const e of doc.querySelectorAll(".title")) {
		if (e.textContent) {
			item["title"] = e.textContent
		}
	}
	for (const e of doc.querySelectorAll(".author")) {
		if (e.textContent) {
			item["title"] += " - " + e.textContent
			break
		}
	}
	item["top-title"] = item["title"]
	// ファイルサイズが大きいと処理が遅くなるので章ごとにページを分ける
	html = doc.body.innerHTML
	if (html.length > 50000) {
		const m = url.match(/\?([0-9]+)/i)
		const target_no = m ? parseInt(m[1]) : 0
		const main_e = doc.querySelector(".main_text")
		let page = 0
		let type = 0
		const e_list = []
		if (target_no === 0) { // 目次ページの作成
			const e_div = doc.createElement("div")
			e_div.className = "index_box"
			for (const e of main_e.childNodes) {
				if (e.className && e.className.match(/jisage/)) {
					const e_o_midashi = e.querySelector(".o-midashi")
					const e_naka_midashi = e.querySelector(".naka-midashi")
					if (e_o_midashi) {
						++page
						type = 1
						const e_ctitle = doc.createElement("div")
						e_ctitle.className = "chapter_title"
						e_ctitle.innerHTML = e_o_midashi.textContent
						e_div.appendChild(e_ctitle)
					} else if (e_naka_midashi) {
						if (type !== 1) {
							++page
						}
						type = 2
						const sub_html = e_naka_midashi.textContent
						if (page === 1) {
							setItemEpisodeText("next-episode", `${index_url}?1`, sub_html || "次へ", item)
						}
						const e_dl_stitle = doc.createElement("dl")
						e_dl_stitle.className = "novel_sublist2"
						const e_dd_stitle = doc.createElement("dd")
						e_dd_stitle.className = "subtitle"
						const e_a_stitle = doc.createElement("a")
						e_a_stitle.innerHTML = sub_html
						e_a_stitle.href = `${index_url.replace(/.*\//, "./")}?${page}`
						e_dd_stitle.appendChild(e_a_stitle)
						e_dl_stitle.appendChild(e_dd_stitle)
						e_div.appendChild(e_dl_stitle)
					}
				}
				if (page === 0) {
					e_list.push(e)
				}
			}
			e_list.push(e_div)
		} else if (target_no > 0) {
			setItemEpisodeText("prev-episode", index_url, "目次へ", item)
			for (const e of main_e.childNodes) {
				if (e.className && e.className.match(/jisage/)) {
					const e_naka_midashi = e.querySelector(".naka-midashi")
					if (e.querySelector(".o-midashi")) {
						++page
						type = 1
					} else if (e_naka_midashi) {
						if (type !== 1) {
							++page
						}
						type = 2
						if (page === target_no) {
							item["title"] += " " + e_naka_midashi.textContent
						} else if (page === target_no - 1) {
							setItemEpisodeText("prev-episode", `${index_url}?${target_no - 1}`, e_naka_midashi.textContent || "前へ", item)
						} else if (page === target_no + 1) {
							setItemEpisodeText("next-episode", `${index_url}?${target_no + 1}`, e_naka_midashi.textContent || "次へ", item)
							break
						}
					}
				}
				if (page === target_no || (page === 0 && (e.className === "title" || e.className === "author"))) {
					if (e.className === "title") {
						const e_anchor = document.createElement("a")
						e_anchor.href = `${index_url.replace(/.*\//, "./")}`
						e_anchor.appendChild(e)
						e_list.push(e_anchor)
					} else {
						e_list.push(e)
					}
				}
			}
		}
		main_e.textContent = ""
		for (const e of e_list) {
			main_e.appendChild(e)
		}
	}
	TxtMiruLib.KumihanMod(url, doc)
	item["html"] = doc.body.innerHTML
	return [item, doc]
}
const getHtmlDocument = async url => {
	const html = await fetch(url)
		.then(response => response.text())
		.then(text => text)
	const parser = new DOMParser()
	return parser.parseFromString(html, "text/html")
}
class TxtMiruSitePlugin {
	Match = url => false
	GetDocument = (txtMiru, url) => null
	GetInfo = async (txtMiru, url, callback = null) => false // お気に入りで使用
	GetPageNo = (txtMiru, url) => { } // お気に入りで使用
	Name = _ => ""
	GetArrayInfo = async (txtMiru, url, callback = null) => {
		const results = []
		for (const u of url) {
			if (this.Match(u)) {
				const item = await this.GetInfo(txtMiru, u, callback)
				if (item !== null) {
					results.push(item)
				}
			}
		}
		return results
	}
	TryFetch = async (txtMiru, url, url_params, callback) => {
		url_params["url"] ??= url
		const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams(url_params)}`
		let item = null
		const fetchOpt = getFetchOption(txtMiru)
		for(let i=1; i<=5; ++i){
			try {
				item = await callback(fetchOpt, req_url)
			} catch(e){
				console.log(e)
			}
			if (item instanceof Error){
				item = checkFetchAbortError(item, url)
				if (item instanceof Error){
					console.log(item)
				} else {
					break
				}
			} else {
				break
			}
			for(let j=0; j<(i+1)*3; j++){
				console.log(`retry:${i} x [${j+1}/${(i+1)*3}]`)
				txtMiru.txtMiruLoading.update(`待機中 ${i}回目 [${(i+1)*3-j}]`)
				await sleep(1000)
				if (txtMiru.fetchAbortController && txtMiru.fetchAbortController.signal.aborted){
					return {html: `キャンセルされました<br><a href='${url}'>${url}</a>`, cancel: true}
				}
			}
			txtMiru.txtMiruLoading.update(`取得中...`)
		}
		return (item instanceof Error)
			? {html: `キャンセルされました<br><a href='${url}'>${url}</a>`, cancel: true}
			: item
	}
}

export class TxtMiruSiteManager {
	static site_list = []
	static AddSite = site => this.site_list.unshift(site)
	static SiteList = _ => this.site_list
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
const getFetchOption = txtMiru => txtMiru.fetchAbortController
	? {signal: txtMiru.fetchAbortController.signal}
	: {}
const checkFetchAbortError = (err, url) => (err === "cancel" || err.name === 'AbortError')
	? {html: `キャンセルされました<br><a href='${url}'>${url}</a>`, cancel: true}
	: err
function string_to_buffer(src) {
	return (new Uint8Array([].map.call(src, function (c) {
		return c.charCodeAt(0)
	}))).buffer;
}
const buffer_to_string = buf => String.fromCharCode.apply("", new Uint8Array(buf))
const large_buffer_to_string = buf => {
	const tmp = []
	const len = 1024
	for (let p = 0; p < buf.byteLength; p += len) {
		tmp.push(buffer_to_string(buf.slice(p, p + len)))
	}
	return tmp.join("")
}
const messageFileCannotRead = "ファイルを読み込めませんでした。"
let loadedEncoding = null
const arrayBufferToUnicodeString = async arraybuffer => {
	if (loadedEncoding === false) {
		return messageFileCannotRead
	} else if (loadedEncoding === null) {
		try {
			await TxtMiruLib.LoadScript("js/lib/encoding.min.js")
			loadedEncoding = true
		} catch {
			loadedEncoding = false
			return messageFileCannotRead
		}
	}
	const array = new Uint8Array(arraybuffer)
	return Encoding.codeToString(Encoding.convert(array, "UNICODE"))
}
let loadedJSZip = null
const arrayBufferUnZip = async arraybuffer => {
	if (loadedJSZip === false) {
		return messageFileCannotRead
	} else if (loadedJSZip === null) {
		try {
			await TxtMiruLib.LoadScript("js/lib/jszip.min.js")
			loadedJSZip = true
		} catch {
			loadedJSZip = false
			return messageFileCannotRead
		}
	}
	await arrayBufferToUnicodeString([])
	const new_zip = new JSZip()
	return await new_zip.loadAsync(arraybuffer, { decodeFileName: fileNameBinary => Encoding.codeToString(Encoding.convert(fileNameBinary, "UNICODE")) }).then(zip => {
		const ret = []
		zip.forEach((relativePath, zipEntry) => {
			ret.push(zipEntry)
		})
		return ret
	})
}

const epubIndex = async (txtMiru, index_url, cache) => {
	await new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = async () => {
			if (cache.zip) {
				let opf_filename = null
				let arr = await arrayBufferUnZip(reader.result)
				for (const item of arr) {
					let item_cache = { url: `${index_url}/${item.name}`, html: null, zipEntry: item }
					if (item.name.match(/\.(?:txt)$/i)) {
						item_cache.narou = cache.narou
						item_cache.aozora = cache.aozora
					} else if (item.name === "META-INF/container.xml") {
						const str_container_xml = await arrayBufferToUnicodeString(await item.async("arraybuffer"))
						const parser = new DOMParser()
						const container_xml = parser.parseFromString(str_container_xml, "text/xml")
						for (const rootfile of container_xml.getElementsByTagName("rootfile")) {
							opf_filename = rootfile.getAttribute("full-path")
						}
					}
					txtMiru.addCache(item_cache)
				}
				let html = ""
				console.log(opf_filename)
				if (opf_filename) {
					for (const item of arr) {
						if (item.name === opf_filename) {
							// opf_filename 相対パス
							const str_opf_xml = await arrayBufferToUnicodeString(await item.async("arraybuffer"))
							const parser = new DOMParser()
							const opf_xml = parser.parseFromString(str_opf_xml, "text/xml")
							let toc_flag = false
							for (const itemref of opf_xml.getElementsByTagName("spine")) {
								const toc = itemref.getAttribute("properties")
								if (toc === "nav") {
									toc_flag = true
								}
							}
							let toc_array = []
							for (const itemref of opf_xml.getElementsByTagName("itemref")) {
								const id = itemref.getAttribute("idref")
								const e = opf_xml.getElementById(id)
								if (e) {
									toc_array.push({
										href: e.getAttribute("href")
									})
								}
							}
							cache.toc = toc_array
							break
						}
					}
				}
				resolve(html)
			} else {
				resolve("html")
			}
		}
		reader.readAsArrayBuffer(cache.file)
	})
}

class TxtMiruCacheSite extends TxtMiruSitePlugin {
	Match = url => url.match(/^TxtMiru:/i)
	loadImg = async file => {
		return await new Promise((resolve, _) => {
			const reader = new FileReader()
			reader.onload = _ => resolve(reader.result)
			reader.readAsDataURL(file)
		}).then(result => result)
	}
	IndexUrl = url => url.replace(/\?[0-9]+$/i, "") // 拡張子?数値の?数値部分を削除
	GetDocument = async (txtMiru, url) => {
		const arrayBufferToHtml = async (array, cache) => {
			const html = await arrayBufferToUnicodeString(array)
			if (cache.narou) {
				return narou2html(html)
			} else if (cache.aozora) {
				return AozoraText2Html(html)
			}
			return html
		}
		const index_url = this.IndexUrl(url)
		const cache = txtMiru.getCache(index_url)
		if (cache) {
			if (!cache.html && cache.zipEntry) {
				cache.html = await arrayBufferToHtml(await cache.zipEntry.async("arraybuffer"), cache)
			} else if (!cache.html && cache.file) {
				// ローカルファイルの読み込み
				await new Promise((resolve, reject) => {
					const reader = new FileReader()
					reader.onload = async _ => {
						if (cache.zip) {
							if (cache.url.match(/\.epub$/)) {
								//epubIndex(txtMiru, index_url, cache)
							}
							const target_cache = []
							// Create Index
							const arr = [`<h1 class="title">${cache.file?.name}</h1>`,`<div class="index_box">`]
							for (const item of await arrayBufferUnZip(reader.result)) {
								arr.push(`<dl class="novel_sublist2"><dd class="subtitle"><a href='${index_url.replace(/^.*\//i, "./")}/${item.name}'>${item.name}</a></dd></dl>`)
								const item_cache = { url: `${index_url}/${item.name}`, html: null, zipEntry: item }
								if (item.name.match(/\.(?:txt)$/i)) {
									item_cache.narou = cache.narou
									item_cache.aozora = cache.aozora
									target_cache.push(item_cache)
								}
								txtMiru.addCache(item_cache)
							}
							arr.push("</div>")
							if (target_cache.length === 1){
								console.log(target_cache[0])
								url = target_cache[0].url
								target_cache[0].html = await arrayBufferToHtml(await target_cache[0].zipEntry.async("arraybuffer"), target_cache[0])
								txtMiru.addCache(target_cache[0])
								resolve(target_cache[0].html)
							} else {
								resolve(arr.join(""))
							}
						} else {
							resolve(arrayBufferToHtml(reader.result, cache))
						}
					}
					reader.readAsArrayBuffer(cache.file)
				}).then(html => {
					cache.html = html
				})
			}
			const [item, doc] = parseHtml(url, this.IndexUrl(url)/*urlが変更されているかもなのでIndelUrl再取得*/, `<div class="main_text">${cache.html}</div>`, "TxtMiruCache Aozora")
			let html = doc.body.innerHTML
			if (html.match(/img/i)) {
				// イメージファイルは、blobで読んでおく
				for (const el of doc.getElementsByTagName("IMG")) {
					const cache_img = txtMiru.getCache( el.getAttribute("src"))
					if (cache_img) {
						try {
							if (cache_img.zipEntry) {
								el.src = URL.createObjectURL(await cache_img.zipEntry.async("blob"))
							} else if (cache_img.file) {
								el.src = await this.loadImg(cache_img.file)
							}
						} catch(error) {
							console.log(error)
						}
						break
					}
				}
				html = doc.body.innerHTML
			}
			item["html"] = html
			if (item["title"].length === 0){
				item["title"] = cache.name
			}
			setItemEpisodeText("episode-index", url.replace(/\?[0-9]+$/, ""), item["top-title"], item)
			return Promise.resolve(item)
		}
		return Promise.resolve({ html: "Not found" })
	}
	GetInfo = (txtMiru, url, callback = null) => false
	GetPageNo = (txtMiru, url) => { }
	Name = _ => "TxtMiru"
}
TxtMiruSiteManager.AddSite(new TxtMiruCacheSite())

class TxtMiruWebCacheSite extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/txtmiru\.web\.cache/)
	makeItem = (url, text) => {
		const doc = TxtMiruLib.HTML2Document(text)
		const item = { className: "Narou TxtMiruCacheWeb", "url": url, "title": doc.title }
		TxtMiruLib.KumihanMod(url, doc)
		//
		const forcePager = checkForcePager(doc, item)
		for (const el_a of doc.getElementsByTagName("A")) {
			const href = el_a.getAttribute("href") || ""
			if (!href.match(/^http/)) {
				el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href)
			}
			const classlist = el_a.classList
			if (el_a.textContent === "前へ"
				|| classlist.contains("c-pager__item--before")) {
				forcePager.setPrevEpisode(el_a, item)
			} else if (el_a.textContent === "次へ"
				|| classlist.contains("c-pager__item--next")) {
				forcePager.setNextEpisode(el_a, item)
			} else if (el_a.textContent === "目次" && el_a.id !== "TxtMiruTocPage") {
				forcePager.setEpisodeIndex(el_a, item)
			}
		}
		item["html"] = doc.body.innerHTML
		return item
	}
	GetDocument = async (txtMiru, url) =>
		this.TryFetch(txtMiru, url, {
			charset: "UTF-8"
		},
		async (fetchOpt, req_url) => 
			fetch(req_url, fetchOpt)
			.then(response => response.text())
			.then(text => this.makeItem(url, text))
			.catch(err => checkFetchAbortError(err, url))
		)
	GetInfo = (txtMiru, url, callback = null) => false
	GetPageNo = (txtMiru, url) => { }
	Name = _ => "TxtMiruWeb"
}
TxtMiruSiteManager.AddSite(new TxtMiruWebCacheSite())

class Narou extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/.*\.syosetu\.com/)
	makeItem = (url, text) => {
		const doc = TxtMiruLib.HTML2Document(text)
		const item = { className: "Narou", "url": url, "title": doc.title }
		TxtMiruLib.KumihanMod(url, doc)
		//
		const forcePager = checkForcePager(doc, item)
		for (const el_a of doc.getElementsByTagName("A")) {
			const href = el_a.getAttribute("href") || ""
			if (!href.match(/^http/)) {
				el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href) //`https://ncode.syosetu.com${href}`
			}
			const classlist = el_a.classList
			if (el_a.textContent === "前へ"
				|| classlist.contains("c-pager__item--before")) {
				forcePager.setPrevEpisode(el_a, item)
			} else if (el_a.textContent === "次へ"
				|| classlist.contains("c-pager__item--next")) {
				forcePager.setNextEpisode(el_a, item)
			} else if (el_a.textContent === "目次" && el_a.id !== "TxtMiruTocPage") {
				forcePager.setEpisodeIndex(el_a, item)
			}
		}
		const el_chapter = doc.querySelector(".p-novel__subtitle-chapter")
		if (el_chapter){
			item["title"] += ` ${el_chapter.textContent}`
		}
		const el_episode = doc.querySelector(".p-novel__subtitle-episode")
		if (el_episode){
			item["title"] += ` ${el_episode.textContent}`
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
	}
	GetDocument = async (txtMiru, url) => 
		this.TryFetch(txtMiru, url, {
			charset: "UTF-8",
			cookie: (txtMiru.setting["over18"] === "yes") ? "over18=yes" : ""
		},
		async (fetchOpt, req_url) =>
			fetch(req_url, fetchOpt)
				.then(response => response.text())
				.then(text => this.makeItem(url, text))
				.catch(err => checkFetchAbortError(err, url))
		)
	#getNcode = url => {
		const m = url.match(/https:\/\/.*\.syosetu\.com\/n([A-Za-z0-9]+)/)
		return (m ? `N${m[1]}` : url).toUpperCase()
	}
	getUpdateInfo = async url => {
		if (!url) {
			return []
		}
		const ncode = this.#getNcode(url)
		if (ncode.length === 0) {
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
			const addItem = async _ => {
				if (callback) {
					callback(item_list)
				}
				for (const item of await this.getUpdateInfo(requests.join("-"))) {
					if (item.ncode) {
						results.push({
							url: item.ncode.toUpperCase(),
							max_page: item.novel_type === 2/*短編*/ ? -1 : item.general_all_no,
							name: item.title,
							author: item.writer
						})
					}
				}
			}
			for (const u of url) {
				if (this.Match(u)) {
					item_list.push(u)
					requests.push(this.#getNcode(u))
					if (requests.length > 10) {
						await addItem()
						requests = []
						item_list = []
					}
				}
			}
			if (requests.length > 0) {
				await addItem()
			}
			const out_results = []
			const resultMap = new Map(results.map(r => [r.url, r]))
			for (const u of url) {
				const item = resultMap.get(this.#getNcode(u))
				if (item){
					out_results.push({
						url: appendSlash(u),
						max_page: item.max_page,
						name: item.name,
						author: item.author
					})
				}
			}
			return out_results
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			const ncode = this.#getNcode(url)
			for (const item of await this.getUpdateInfo(url)) {
				if (item.ncode && ncode === item.ncode.toUpperCase()) {
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
			const m = url.match(/(https:\/\/.*\.syosetu\.com\/n[A-Za-z0-9]+)\/([0-9]+)/)
			if (m) {
				const page_no = m[2] | 0
				const index_url = appendSlash(m[1])
				return { url: url, page_no: page_no, index_url: index_url }
			} else if (url.match(/https:\/\/.*\.syosetu\.com\/n[A-Za-z0-9]+\/$/)) {
				return { url: url, page_no: 0, index_url: url }
			}
		}
		return null
	}
	Name = _ => "小説家になろう"
}
TxtMiruSiteManager.AddSite(new Narou())

class Kakuyomu extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/kakuyomu\.jp/)
	GetDocument = async (txtMiru, url) => this._GetDocument(txtMiru, url)
		.then(item => (null !== item && item["html"]?.match(/An existing connection was forcibly closed by the remote host/))
			? this._GetDocument(txtMiru, url)
			: item
	)
	_GetDocument = async (txtMiru, url) => 
		this.TryFetch(txtMiru, url, {
			charset: "UTF-8"
		},
		async (fetchOpt, req_url) =>
			fetch(req_url, fetchOpt)
				.then(response => response.text())
				.then(text => {
					const doc = TxtMiruLib.HTML2Document(text)
					const item = {
						className: "Kakuyomu",
						"title": doc.title,
						"next-episode-text": "次へ",
						"prev-episode-text": "前へ",
						"episode-index-text": "カクヨム",
						"episode-index": "https://kakuyomu.jp/"
					}
					let toc = {}
					if (text.match(/__NEXT_DATA__/)){
						const parser = new DOMParser()
						const tocDodc = parser.parseFromString(text, "text/html")
						toc = this.GetToc(url, tocDodc)
					}
					if (toc.subtitles && toc.subtitles.length > 0 && url.match(/works\/[0-9]+$/)) {
						// Indexページが最初の数件しか目次を表示しないのでページ再生成
						const arrHtml = []
						arrHtml.push(`<h1 class='title'>${TxtMiruLib.EscapeHtml(toc.title)}</h1>`)
						arrHtml.push(`<h2 class='author'>${TxtMiruLib.EscapeHtml(toc.author)}</h2>`)
						arrHtml.push(`<div><p>${TxtMiruLib.EscapeHtml(toc.story).replace(/\n/g, "<br>")}</p></div>`)
						arrHtml.push(`<ul class="subtitles">`)
						let preChpter = ""
						for(const item of toc.subtitles)
						{
							if (item.chapter && preChpter !== item.chapter)
							{
								arrHtml.push(`<li class="chapter">${TxtMiruLib.EscapeHtml(item.chapter)}</li>`)
							}
							preChpter = item.chapter
							const d = new Date(item.subupdate||item.subdate||"")
							const strDate = d.getFullYear()
								? `<span class="sideways_date">${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日</span>`
								: ""
							arrHtml.push(`<li><a href="${item.href}">${TxtMiruLib.EscapeHtml(item.subtitle||"")}</a><span class='long_update'>${strDate}</span></li>`)
						}
						arrHtml.push(`</ul>`)
						arrHtml.push(`<div>`)
						arrHtml.push(`<a class='txtmiru_pager' id='TxtMiruNextPage' href='${toc.subtitles[0].href}'>次へ （${TxtMiruLib.EscapeHtml(toc.subtitles[0].subtitle.trim())}）</a>`)
						arrHtml.push("</div>")
						doc.body.innerHTML = arrHtml.join("")
					}
					TxtMiruLib.KumihanMod(url, doc)
					const remove_nodes = []
					for(const el of doc.querySelectorAll("h2,h3")){
						if (el.textContent.match(/^(新着おすすめレビュー|おすすめレビュー|関連小説)$/)){
							remove_nodes.push(el.parentNode)
						}
					}
					removeNodes(remove_nodes)
					const forcePager = checkForcePager(doc, item)
					let title = ""
					for (const el_a of doc.getElementsByTagName("A")) {
						const href = el_a.getAttribute("href") || ""
						if (!href.match(/^http/)) {
							el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href) //`https://kakuyomu.jp${href}`
						}
						if (el_a.getAttribute("data-link-click-action-name") === "WorksEpisodesEpisodeHeaderPreviousEpisode") {
							forcePager.setPrevEpisode(el_a, item)
							el_a.style.display = "none"
						} else if (el_a.getAttribute("data-link-click-action-name") === "WorksEpisodesEpisodeFooterNextEpisode") {
							forcePager.setNextEpisode(el_a, item)
							el_a.style.display = "none"
						} else if (el_a.getAttribute("itemprop") === "item") {
							forcePager.setEpisodeIndex(el_a, item)
							title = `<a class="kakuyomu_title" href="${el_a.href}">${el_a.getAttribute("title")}</a>`
							el_a.style.display = "none"
						}
					}
					item["html"] = title + doc.body.innerHTML
					return item
				})
				.catch(err => checkFetchAbortError(err, url))
		)
	GetToc = (index_url, doc) => {
		const toc = {
			title: "",
			author: "",
			story: "",
			subtitles: []
		}
		try {
			const script_data = doc.getElementById("__NEXT_DATA__")
			if (!script_data) {
				return toc
			}
			const m0 = index_url.match(/works\/(.*)/)
			const base_name = (m0 && m0.length > 0) ? m0[1] : ""
			const json = JSON.parse(script_data.innerHTML)
			const apollo_state = json["props"]["pageProps"]["__APOLLO_STATE__"]
			const root_query = apollo_state["ROOT_QUERY"]
			const top_work_id = root_query["work({\"id\":\"" + base_name + "\"})"]["__ref"]
			const top_work = apollo_state[top_work_id]
			toc.title = top_work["title"]
			toc.author = apollo_state[top_work["author"]["__ref"]]["activityName"]
			toc.story = `${top_work["catchphrase"]}\n${top_work["introduction"]}`
			let chapter = ""
			let index = 0
			for(const tableOfContent of top_work["tableOfContents"]){
				const subTableOfContents = apollo_state[tableOfContent["__ref"]]
				if(subTableOfContents["chapter"]) {
					chapter = apollo_state[subTableOfContents["chapter"]["__ref"]]["title"]
				}
				const episodes = subTableOfContents["episodeUnions"]
				for(const item of (episodes||[])){
					++index;
					const episode = apollo_state[item["__ref"]]
					toc.subtitles.push({
						subtitle: episode["title"],
						href: `/works/${base_name}/episodes/${episode["id"]}`,
						index: index,
						subdate: episode["publishedAt"],
						subupdate: "",
						chapter: chapter,
					})
				}
			}
		} catch(e) {
			console.log(e)
		}
		return toc
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			return await this.GetArrayInfo(txtMiru, url, callback)
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			url = appendSlash(url)
			const m = url.match(/(https:\/\/kakuyomu\.jp\/works\/.*?)\//)
			if (!m) {
				return null
			}
			const index_url = m[1]
			const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8"
			})}`
			const doc = await getHtmlDocument(req_url)
			let max_page = 1
			let title = ""
			let author = ""
			try {
				max_page = doc.getElementsByClassName("widget-toc-episode-titleLabel").length
				title = doc.getElementById("workTitle").innerText
				author = doc.getElementById("workAuthor-activityName").innerText
			} catch (e) {}
			const toc = this.GetToc(index_url, doc)
			author = toc.author || author
			title = toc.title || title
			max_page = toc.subtitles.length || max_page
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
			const m = url.match(/(https:\/\/kakuyomu\.jp\/works\/.*?)\/(episodes\/.*)\/$/)
			if (m && m.length > 0) {
				const page_url = m[2]
				const index_url = m[1]
				const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: `${url}episode_sidebar`,
					charset: "UTF-8"
				})}`
				const doc = await getHtmlDocument(req_url)
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
	Name = _ => "カクヨム"
}
TxtMiruSiteManager.AddSite(new Kakuyomu())

class Aozora extends TxtMiruSitePlugin {
	#cache = new CacheFiles(5)
	IndexUrl = url => url.replace(/\.html\?[0-9]+$/, ".html")
	Match = url => url.match(/https*:\/\/www\.aozora\.gr\.jp/)
	ParseHtml = (url, index_url, html) => {
		html = html
			.replace(/［＃(.*?)］/g, (_, m) => {
				let r
				if (m.match(/底本/)) {
					return `<sup title='${m}'>※</sup>`
				} else if (r = m.match(/、U\+([0-9A-Za-z]+)/)) {
					return `&#x${r[1]};`
				}
				return ""
			})
		const [item, doc] = parseHtml(url, index_url, html, "Aozora")
		item["episode-index-text"] = item["top-title"]
		item["episode-index"] = (index_url !== url) ? index_url : "https://www.aozora.gr.jp"
		if (index_url !== url){
			item["nocache"] = true
		}
		return item
	}
	GetDocument = async (txtMiru, url) => {
		const index_url = this.IndexUrl(url)
		const html = this.#cache.Get(index_url)?.html
		return html
			? new Promise(resolve => {
				setTimeout(() => resolve(this.ParseHtml(url, index_url, html)))
			})
			: this.TryFetch(txtMiru, url, {
					charset: "Auto"
				},
				async (fetchOpt, req_url) =>
					fetch(req_url, fetchOpt)
					.then(response => response.text())
					.then(text => {
						this.#cache.Set({ url: index_url, html: text })
						return this.ParseHtml(url, index_url, text)
					})
					.catch(err => checkFetchAbortError(err, url))
				)
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			return await this.GetArrayInfo(txtMiru, url, callback)
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let target_url = url
			let r
			if (url.match(/\/cards\/[0-9]+\/files\/[0-9_]+.*\.html/)) {
				target_url = url.replace(/\.html\?[0-9]+?/, ".html")
			} else if (r = url.match(/^(.*\/cards\/.+\/)files\/([0-9_]+)/)) {
				target_url = `${r[1]}card${r[2]}.html`
			}
			const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${target_url}`,
				charset: "Auto"
			})}`
			const doc = await getHtmlDocument(req_url)
			const getText = cond => {
				for(const id of cond){
					const el = doc.querySelector(id)
					if (el){
						return el.innerText
					}
				}
				return ""
			}
			const item = {
				url: url,
				max_page: 1,
				name: getText([".title, h1"]),
				author: getText([".author, h2"])
			}
			for (const e of doc.getElementsByClassName("header")) {
				if (e.innerText === "作品名：") {
					item.name = e.nextElementSibling.innerText
				} else if (e.innerText === "著者名：") {
					item.author = e.nextElementSibling.innerText
				}
			}
			item.max_page = doc.querySelectorAll('[class^="jisage"]:has(.naka-midashi)').length
			return item
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			let r
			return (r = url.match(/^(.*\.html)\?([0-9]+)$/))
				? { url: url, page_no: parseInt(r[2]), index_url: r[1] }
				: { url: url, page_no: 1, index_url: url }
		}
		return null
	}
	Name = _ => "青空文庫"
}
TxtMiruSiteManager.AddSite(new Aozora())

class Alphapolis extends TxtMiruSitePlugin {
	Match = url => url.match(/www\.alphapolis\.co\.jp\//)
	makeItem = (url, text) => {
		const doc = TxtMiruLib.HTML2Document(text)
		removeNodes(doc.querySelectorAll("#gnbid, #breadcrumbs, #navbar, #header, #footer, .novel-freespace, .novel-action, .bookmark, .ScrollUpDown, .ranking-banner, .change-font-size, .alphapolis_title"))
		const item = {
			className: "Alphapolis",
			"title": doc.title,
			"next-episode-text": "次へ",
			"prev-episode-text": "前へ",
			"episode-index-text": "アルファポリス",
			"episode-index": "https://www.alphapolis.co.jp"
		}
		TxtMiruLib.KumihanMod(url, doc)
		const forcePager = checkForcePager(doc, item)
		for (const el_span of doc.querySelectorAll(".episode > span")) {
			let r
			if (r = el_span.innerText.match(/([0-9]+)年([0-9]+)月([0-9]+)日/)) {
				el_span.innerText = `${r[1]}年${("0" + r[2]).slice(-2)}月${("0" + r[3]).slice(-2)}日`.replace(/[0-9]/g, s => {
					return String.fromCharCode(s.charCodeAt(0) + 0xFEE0)
				})
			}
			if (r = el_span.innerText.match(/([0-9]+)\.([0-9]+)\.([0-9]+) ([0-9]+):([0-9]+)/)) {
				el_span.innerText = `${r[1]}/${("0" + r[2]).slice(-2)}/${("0" + r[3]).slice(-2)} ${("0" + r[4]).slice(-2)}:${("0" + r[5]).slice(-2)}`
			}
		}
		for (const el_a of doc.getElementsByTagName("A")) {
			const href = el_a.getAttribute("href") || ""
			if (!href.match(/^http/)) {
				el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href)
			}
			if (el_a.className === "label-circle prev") {
				forcePager.setPrevEpisode(el_a, item)
				el_a.style.display = "none"
			} else if (el_a.className === "label-circle next") {
				forcePager.setNextEpisode(el_a, item)
				el_a.style.display = "none"
			} else if (el_a.className === "label-circle cover") {
				forcePager.setEpisodeIndex(el_a, item)
				el_a.style.display = "none"
			}
		}
		item["html"] = doc.body.innerHTML
		return item
	}
	GetDocument = async (txtMiru, url) => 
		this.TryFetch(txtMiru, url, {
			charset: "UTF-8",
			cookie: "request"
		},
		async (fetchOpt, req_url) =>
			fetch(req_url, fetchOpt)
				.then(response => response.text())
				.then(text => this.makeItem(url, text))
				.catch(err => checkFetchAbortError(err, url))
		)
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			return await this.GetArrayInfo(txtMiru, url, callback)
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			url = appendSlash(url)
			const r = url.match(/(https:\/\/www\.alphapolis\.co\.jp\/novel\/[0-9]+\/[0-9]+\/)/)
			if (!r) {
				return null
			}
			const index_url = r[1]
			const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8",
				cookie: "request"
			})}`
			const doc = await getHtmlDocument(req_url)
			let name = doc.title
			let author = ""
			let max_page = 0
			for (const el_main of doc.getElementsByClassName("content-main")) {
				for (const e_name of el_main.getElementsByClassName("title")) {
					name = e_name.innerText.replace(/[\n\t]/g, "")
				}
				for (const e_author of el_main.getElementsByClassName("author")) {
					removeNodes(e_author.getElementsByClassName("diary-count"))
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
			let r
			if (r = url.match(/(https:\/\/www\.alphapolis\.co\.jp\/novel\/.*?)\/(episode\/.*)\/$/)) {
				const page_url = r[2]
				const index_url = r[1]
				const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: index_url,
					charset: "UTF-8",
					cookie: "request"
				})}`
				const doc = await getHtmlDocument(req_url)
				let page_no = 0
				for (const anchor of doc.getElementsByTagName("A")) {
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
	Name = _ => "アルファポリス"
}
TxtMiruSiteManager.AddSite(new Alphapolis())

class Akatsuki extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/www\.akatsuki\-novels\.com\//)
	GetDocument = async (txtMiru, url) =>
		this.TryFetch(txtMiru, url, {
			charset: "UTF-8"
		},
		async (fetchOpt, req_url) => 
			fetch(req_url, fetchOpt)
			.then(response => response.text())
			.then(text => {
				const doc = TxtMiruLib.HTML2Document(text)
				const dummy_url = url.match(/\.html$/) ? url : appendSlash(url) + "index.html"
				let remove_nodes = doc.querySelectorAll("#trace,#header,#footer,.spacer")
				for (const e of doc.getElementsByTagName("SPAN")) {
					if (e.innerText.match(/しおりを利用するにはログインしてください。会員登録がまだの場合はこちらから。/)) {
						remove_nodes.push(e)
					}
				}
				removeNodes(remove_nodes)
				remove_nodes = []
				const item = {
					className: "Akatsuki",
					"title": doc.title,
					"episode-index-text": "暁",
					"episode-index": "https://www.akatsuki-novels.com/"
				}
				TxtMiruLib.KumihanMod(dummy_url, doc)
				const forcePager = checkForcePager(doc, item)
				for (const el_a of doc.getElementsByTagName("h3 > a:first-of-type, div > a:first-of-type")) {
					if (el_a.parentNode.innerText.match(/作者：/)) {
						el_a.className = "author"
						el.innerHTML = el_a.outerHTML
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
					if (el_a.innerText === "< 前ページ") {
						forcePager.setPrevEpisode(el_a, item)
					} else if (el_a.innerText === "次ページ >") {
						forcePager.setNextEpisode(el_a, item)
					} else if (el_a.innerText === "目次") {
						forcePager.setEpisodeIndex(el_a, item)
					}
				}
				removeNodes(remove_nodes)
				item["html"] = doc.body.innerHTML
				return item
			})
			.catch(err => checkFetchAbortError(err, url))
		)
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			return await this.GetArrayInfo(txtMiru, url, callback)
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			let index_url = ""
			let r
			url = appendSlash(url)
			if (r = url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/view\/[0-9]+\/novel_id~([0-9]+)\/$/)) {
				index_url = `https://www.akatsuki-novels.com/stories/index/novel_id~${r[1]}`
			} else if (url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/index\/novel_id~[0-9]+\/$/)) {
				index_url = removeSlash(url)
			} else {
				return null
			}
			const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8"
			})}`
			const doc = await getHtmlDocument(req_url)
			const el_title = doc.getElementById("LookNovel")
			const name = el_title ? el_title.innerText :  doc.title
			const max_page = doc.querySelectorAll(".list > a").length
			let author = ""
			for (const el of doc.getElementsByTagName("H3")) {
				if (el.innerText.match(/作者：/)) {
					const el_a = el.querySelector("A")
					if (el_a) {
						author = el_a.innerText
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
			let r
			if (r = url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/view\/([0-9]+)\/novel_id~([0-9]+)\/$/)) {
				const page_url = r[1]
				const index_url = `https://www.akatsuki-novels.com/stories/index/novel_id~${r[2]}`
				const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
					url: `${index_url}`,
					charset: "UTF-8"
				})}`
				const doc = await getHtmlDocument(req_url)
				let page_no = 0
				for (const anchor of doc.querySelectorAll(".list > a")) {
					++page_no
					if (anchor.href.includes(page_url)) {
						break
					}
				}
				return { url: removeSlash(url), page_no: page_no, index_url: index_url }
			} else if (url.match(/https:\/\/www\.akatsuki\-novels\.com\/stories\/index\/novel_id~[0-9]+\/$/)) {
				return { url: removeSlash(url), page_no: 0, index_url: removeSlash(url) }
			}
		}
		return null
	}
	Name = _ => "暁"
}
TxtMiruSiteManager.AddSite(new Akatsuki())

class Pixiv extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/www\.pixiv\.net\/novel\//)
	novelAPI = (txtMiru, func) => fetch(`${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
		url: func,
		charset: "UTF-8"
	})}`).then(response => response.json())
	GetDocument = async (txtMiru, url) => {
		const [novel_id, series] = this._getNovelId(url)
		return this.TryFetch(txtMiru, url, {
			url: novel_id
				? (series
					? `https://www.pixiv.net/ajax/novel/series/${novel_id}?lang=ja`
					: `https://www.pixiv.net/ajax/novel/${novel_id}?lang=ja`
				) : url,
			charset: "UTF-8"
		},
		async (fetchOpt, req_url) =>
			fetch(req_url, fetchOpt)
			.then(response => response.text())
			.then(async text => {
				const item = {
					className: "Pixiv",
					"episode-index-text": "pixiv",
					"episode-index": "https://www.pixiv.net/novel/"
				}
				if (novel_id && text[0] === '{') {
					const jsonBody = JSON.parse(text)["body"]
					item["title"] = jsonBody["title"]
					if (series){
						const html_arr = []
						html_arr.push("<br>")
						html_arr.push(jsonBody.extraData.meta.description)
						let order = 0
						html_arr.push(`<h3>目次</h3><ol class="novel-toc-items">`)
						do {
							const json = await this.novelAPI(txtMiru, `https://www.pixiv.net/ajax/novel/series_content/${novel_id}?limit=20&last_order=${order}&order_by=asc&lang=ja`)
							if (json.body.page["seriesContents"].length <= 0) {
								break
							}
							for (const series_content of json.body.page["seriesContents"]) {
								const date = new Date()
								date.setTime(series_content.reuploadTimestamp * 1000)
								const date_str = date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日"
								html_arr.push(`<li class="novel-toc-episode"><a href='https://www.pixiv.net/novel/show.php?id=${series_content.id}'>${series_content.title}</a><span class="novel-toc-episode-datePublished">${date_str}</span></li>`)
							}
							order += 20
							if (order > jsonBody.total) {
								break
							}
						} while (true)
						html_arr.push("</ol>")
						item["html"] = `<div class="title">${item["title"]}</div><div class="author">${jsonBody.userName}</div><div class="main">${html_arr.join("")}</div>`
					} else {
						if (jsonBody["seriesNavData"]) {
							const jsonNext = jsonBody["seriesNavData"]["next"]
							const jsonPrev = jsonBody["seriesNavData"]["prev"]
							if (jsonNext) {
								setItemEpisodeText("next-episode", `https://www.pixiv.net/novel/show.php?id=${jsonNext.id}`, "次へ", item)
							}
							if (jsonPrev) {
								setItemEpisodeText("prev-episode", `https://www.pixiv.net/novel/show.php?id=${jsonPrev.id}`, "前へ", item)
							}
							setItemEpisodeText("episode-index", `https://www.pixiv.net/novel/series/${jsonBody["seriesNavData"].seriesId}`, "目次へ", item)
						}
						const html = jsonBody["content"].replace(/\n|\r\n|\r/g, '<br>').replaceAll("<br>[newpage]<br>", "<hr>")
						const doc = TxtMiruLib.HTML2Document(html)
						TxtMiruLib.KumihanMod(url, doc)
						item["html"] = `<h1>${jsonBody["title"]||""}</h1><h2>${jsonBody["userName"]||""}</h2>${doc.body.innerHTML}`
					}
				} else {
					const doc = TxtMiruLib.HTML2Document(text)
					item["title"] = doc.title
					TxtMiruLib.KumihanMod(url, doc)
					item["html"] = doc.body.innerHTML
				}
				return item
			})
			.catch(err => checkFetchAbortError(err, url))
		)
	}
	_getNovelData = async (txtMiru, url, novel_id) => {
		const novel_contents = await fetch(`${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
			url: removeSlash(url),
			charset: "UTF-8"
		})}`).then(response => response.text())
		const doc = TxtMiruLib.HTML2Document(novel_contents)
		if (doc.getElementsByName('preload-data').length > 0){
			const meta_content = doc.getElementsByName('preload-data')[0].content
			const json = JSON.parse(meta_content)
			return { pageCount: json.novel[novel_id].pageCount, index_url: `https://www.pixiv.net/novel/series/${json.novel[novel_id].seriesNavData.seriesId}` }
		}
		return { pageCount: 0, index_url: url }
	}
	_getNovelId = url => {
		let r
		if (r = url.match(/https:\/\/www\.pixiv\.net\/novel\/show\.php\?id=([0-9]+)/)) {
			return [r[1], false]
		} else if (r = url.match(/novel\/series\/([0-9]+)/)) {
			return [r[1], true]
		}
		return [null, null]
	}
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			return await this.GetArrayInfo(txtMiru, url, callback)
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			const [novel_id, _] = this._getNovelId(url)
			if (!novel_id) {
				return null
			}
			const novel_contents = await this.novelAPI(txtMiru, `https://www.pixiv.net/ajax/novel/series/${novel_id}?lang=ja`)
			return {
				url: removeSlash(url),
				max_page: novel_contents.body.displaySeriesContentCount,
				name: novel_contents.body.title,
				author: novel_contents.body.userName
			}
		}
		return null
	}
	GetPageNo = async (txtMiru, url) => {
		if (this.Match(url)) {
			url = appendSlash(url)
			const [novel_id, series] = this._getNovelId(url)
			if (novel_id){
				if (series) {
					return { url: removeSlash(url), page_no: 0, index_url: `https://www.pixiv.net/novel/series/${novel_id}` }
				}
				const data = await this._getNovelData(txtMiru, url, novel_id)
				return { url: removeSlash(url), page_no: parseInt(data.pageCount) + 1, index_url: data.index_url }
			}
		}
		return null
	}
	Name = _ => "pixiv"
}
TxtMiruSiteManager.AddSite(new Pixiv())

class NovelupPlus extends TxtMiruSitePlugin {
	Match = url => url.match(/https:\/\/novelup\.plus/)
	GetDocument = async (txtMiru, url) =>
		this.TryFetch(txtMiru, url, {
			charset: "UTF-8"
		},
		async (fetchOpt, req_url) =>
			fetch(req_url, fetchOpt)
			.then(response => response.text())
			.then(text => {
				const doc = TxtMiruLib.HTML2Document(text)
				const item = {
					className: "NovelupPlus",
					"title": doc.title,
					"next-episode-text": "次へ",
					"prev-episode-text": "前へ",
					"episode-index-text": "小説投稿サイトノベルアップ＋",
					"episode-index": "https://novelup.plus/"
				}
				TxtMiruLib.KumihanMod(url, doc)
				const forcePager = checkForcePager(doc, item)
				const m_index_url = url.match(/https:\/\/novelup\.plus\/story\/[\d]+(.*)/)
				if (m_index_url && m_index_url[1]) {
					for (const e of doc.getElementsByClassName("novel_title")) {
						setItemEpisodeText("episode-index", m_index_url[0], e.innerText, item)
					}
				}
				for (const anchor of doc.getElementsByTagName("A")) {
					if (anchor.innerText.match(/次へ/)) {
						forcePager.setNextEpisode(anchor, item)
					} else if (anchor.innerText.match(/前へ/)) {
						forcePager.setPrevEpisode(anchor, item)
					}
				}
				for (const el of doc.getElementsByClassName("publishDate")) {
					const m_date = el.innerText.match(/([0-9]+)\/([0-9]+)\/([0-9]+) ([0-9]+):([0-9]+)/)
					if (m_date) {
						let year = parseInt(m_date[1])
						const month = m_date[2]
						const date = m_date[3]
						if (year < 70){
							year += 2000
						} else if (year < 100){
							year += 1900
						}
						const d = new Date(`${year}/${month}/${date}`)
						el.innerHTML = d.getFullYear()
							? `<span class="sideways_date">${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日</span>`
							: ""
					}
				}
				let title = ""
				for (const el_a of doc.getElementsByTagName("A")) {
					const href = el_a.getAttribute("href") || ""
					if (!href.match(/^http/)) {
						el_a.href = TxtMiruLib.ConvertAbsoluteURL(url, href)
					}
					if (el_a.getAttribute("data-link-click-action-name") === "WorksEpisodesEpisodeHeaderPreviousEpisode") {
						forcePager.setPrevEpisode(el_a, item)
						el_a.style.display = "none"
					} else if (el_a.getAttribute("data-link-click-action-name") === "WorksEpisodesEpisodeFooterNextEpisode") {
						forcePager.setNextEpisode(el_a, item)
						el_a.style.display = "none"
					} else if (el_a.getAttribute("itemprop") === "item") {
						forcePager.setEpisodeIndex(el_a, item)
						title = `<a class="kakuyomu_title" href="${el_a.href}">${el_a.getAttribute("title")}</a>`
						el_a.style.display = "none"
					}
				}
				item["html"] = title + doc.body.innerHTML
				return item
			})
			.catch(err => checkFetchAbortError(err, url))
		)
	GetInfo = async (txtMiru, url, callback = null) => {
		if (Array.isArray(url)) {
			return await this.GetArrayInfo(txtMiru, url, callback)
		} else if (this.Match(url)) {
			if (callback) {
				callback([url])
			}
			url = appendSlash(url)
			const m_index_url = url.match(/(https:\/\/novelup\.plus\/story\/.*?)\//)
			if (!m_index_url) {
				return null
			}
			const index_url = m_index_url[1]
			const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
				url: `${index_url}`,
				charset: "UTF-8"
			})}`
			const doc = await getHtmlDocument(req_url)
			let max_page = 1
			let title = doc.title
			let author = doc.title
			for (const e of doc.getElementsByClassName("read_time")) {
				const m = e.innerText.match(/エピソード数：([\d]+)/)
				if (m) {
					max_page = parseInt(m[1])
				}
			}
			for (const e of doc.getElementsByClassName("novel_title")) {
				title = e.innerText
			}
			for (const e of doc.getElementsByClassName("novel_author")) {
				author = e.innerText
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
			const m_url = url.match(/(https:\/\/novelup\.plus\/story\/[\d]+)\/([\d]+)\/$/)
			if (m_url) {
				const page_url = m_url[2]
				const index_url = m_url[1]
				let page_no = 0
				let url_page = 1
				while (true) {
					let bMatchUrl = false
					const req_url = `${txtMiru.setting["WebServerUrl"]}?${new URLSearchParams({
						url: url_page === 1 ? `${index_url}` : `${index_url}?p=${url_page}`,
						charset: "UTF-8"
					})}`
					const doc = await getHtmlDocument(req_url)
					for (const anchor of doc.querySelectorAll(".episodeListItem > a:first-of-type")) {
						++page_no
						if (anchor.href.includes(page_url)) {
							bMatchUrl = true
							break
						}
					}
					if (bMatchUrl) {
						break
					}
					// 目次 次のページ取得
					bMatchUrl = true
					url_page++
					const next_url = `?p=${url_page}`
					for (const anchor of doc.getElementsByTagName("A")) {
						if (anchor.href.includes(next_url)) {
							bMatchUrl = false
							break
						}
					}
					if (bMatchUrl) {
						break
					}
				}
				return { url: removeSlash(url), page_no: page_no, index_url: index_url }
			}
		}
		return null
	}
	Name = _ => "小説投稿サイトノベルアップ＋"
}
TxtMiruSiteManager.AddSite(new NovelupPlus())
