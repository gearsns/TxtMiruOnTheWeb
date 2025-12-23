const setEvent = (urlElement, localFileElement, txtMiru) => {
	const hideLocalFile = _ => {
		urlElement.className = "hide-local-file"
		txtMiru.display_popup = false
	}
	document.getElementById("local-file-box-inner").addEventListener("click", e => {
		e.stopPropagation()
	}, false)
	document.getElementById("local-file-box-outer").addEventListener("click", hideLocalFile)
	document.getElementById("close-local-file").addEventListener("click", hideLocalFile)
	const load = files => {
		const url_list = []
		txtMiru.clearCache()
		const id = crypto.randomUUID()
		const index_url = `txtmiru://localfile/${id}`
		const narouOrAozora = document.getElementById("local-file-narou").checked ? "narou" : "aozora"
		for (const item of files) {
			const url = `${index_url}/${item.fullpath || item.webkitRelativePath || item.name}`
			// support types
			if (item.name.match(/\.(?:htm|html|xhtml|txt|zip|epub)$/i)) {
				const cache = { url: url, html: null, file: item }
				if (item.name.match(/\.(?:txt)$/i)) {
					cache[narouOrAozora] = true
				} else if (item.name.match(/\.(?:zip|epub)$/i)) {
					cache.zip = true
					cache[narouOrAozora] = true
				}
				url_list.push({ url: url, cache: cache, name: item.fullpath || item.webkitRelativePath || item.name })
			} else if (item.name.match(/\.(?:jpg|jpeg|png|gif)$/i)) {
				console.log(item.name)
				txtMiru.addCache({ url: url, html: null, file: item })
			}
		}
		if (url_list.length === 1) {
			const cache = url_list[0].cache
			cache.url = index_url
			txtMiru.addCache(cache)
			txtMiru.LoadNovel(index_url)
			hideLocalFile()
		} else if (url_list.length > 1) {
			// Create Index
			let r
			const cache = { url: index_url, html: null }
			let title = url_list[0].name
			if (r = url_list[0].name.match(/(.*?)\//)){
				title = r[1]
			}
			const topFolder = `${title}/`
			const compareSeg = (a, b) => {
				const a1 = a.match(/^([0-9]+)/)
				const b1 = b.match(/^([0-9]+)/)
				if (a1 && b1){
					const a11 = parseInt(a1[1])
					const b11 = parseInt(b1[1])
					return (a11 === b11)
						? a.localeCompare(b)
						: a11 - b11
				}
				if (a1){
					return -1
				} else if (b1){
					return 1
				}
				return a.localeCompare(b)
			}
			url_list.sort((a, b) => {
				const a0 = a.name.split('/')
				const b0 = b.name.split('/')
				const minLength = Math.min(a0.length, b0.length)
				for (let i = 0; i < minLength; i++) {
					const result = compareSeg(a0[i], b0[i])
					if (result !== 0) {
						if (i === a0.length-1 && i === b0.length-1){
						} else if (i === a0.length-1){
							return -1
						} else if (i === b0.length-1){
							return 1
						}
						return result
					}
				}
				return a0.length - b0.length
			})
			const arr = [`<h1 class='title'>${title}</h1>`,`<div class="index_box">`]
			let preFolder = ""
			for (const item of url_list) {
				let name = item.name
				if (r = item.name.match(/(.*)\/(.*)/)){
					name = r[2]
					if (preFolder !== r[1]){
						let chapter_title = r[1]
						if (chapter_title !== title){
							if (chapter_title.slice(0, topFolder.length) === topFolder){
								chapter_title = chapter_title.slice(topFolder.length)
							}
							arr.push(`<dl class="novel_sublist2"><dd class="subtitle">${chapter_title}</dd></dl>`)
						}
					}
					preFolder = r[1]
				}
				arr.push(`<dl class="novel_sublist2"><dd class="subtitle"><a href='${item.url.replace(/^txtmiru:\/\/localfile\//, '')}'>${name}</a></dd></dl>`)
				txtMiru.addCache(item.cache)
			}
			arr.push("</div>")
			cache.html = arr.join("")
			cache.title = title
			txtMiru.addCache(cache)
			txtMiru.LoadNovel(index_url)
			hideLocalFile()
		} else {
			document.getElementById("txtmiru-local-file-message").textContent = "対象ファイルが見つかりませんでした。"
		}
	}
	document.getElementById("local-file-box-inner").addEventListener("dragover", e => {
		e.stopPropagation()
		e.preventDefault()
	})
	document.getElementById("local-file-box-inner").addEventListener("dragleave", e => {
		e.stopPropagation()
		e.preventDefault()
	})
	document.getElementById("local-file-box-inner").addEventListener("drop", async e => {
		e.stopPropagation()
		e.preventDefault()
		const items = e.dataTransfer.items
		if (items) {
			const items = e.dataTransfer.items
			const fileList = []
			const traverseFileTree = async (entry, path) => {
				const _path = path || ""
				if (entry.isFile) {
					const file = await new Promise(resolve => {
						entry.file(file => resolve(file))
					})
					file.fullpath = _path + file.name
					fileList.push(file)
				} else if (entry.isDirectory) {
					const directoryReader = entry.createReader()
					const entries = await new Promise(resolve => {
						directoryReader.readEntries(entries => resolve(entries))
					})
					for(const entry of entries){
						await traverseFileTree(entry, _path + entry.name + "/")
					}
				}
			}
			for (const item of items) {
				await traverseFileTree(item.webkitGetAsEntry())
			}
			if (fileList.length > 0) {
				load(fileList)
				return
			}
		}
		load(e.dataTransfer.files)
	})
	localFileElement.addEventListener("click", e => {e.target.value = ""})
	localFileElement.addEventListener("change", e => load(e.target.files))
	document.getElementById("local-file-folder").addEventListener("click", e => {
		localFileElement.webkitdirectory = e.target.checked
	})
	if (!('webkitdirectory' in localFileElement)) {
		document.getElementById("local-file-folder-area").style.display = "none"
	}
}
export class TxtMiruLocalFile {
	constructor(txtMiru) {
		this.txtMiru = txtMiru
		this.urlElement = document.createElement("div")
		this.urlElement.className = "hide-local-file"
		this.urlElement.innerHTML = `<div class="local-file-box-outer" id="local-file-box-outer"><div class="local-file-box-inner" id="local-file-box-inner">
<dl>
<dt>テキストファイルまたはHTMLファイルを選択してください。
<dd>
<hr>
<input type="file" name="url" id="local-file">
<div id="local-file-folder-area"><input type="checkbox" id="local-file-folder" name="local-file-folder" value="folder"><label for="local-file-folder">フォルダ単位で読み込み</label></div>
</dl>
<input type="radio" id="local-file-aozora" name="local-file-type" value="aozora" checked><label for="local-file-aozora">青空文庫形式</label>
<input type="radio" id="local-file-narou" name="local-file-type" value="narou"><label for="local-file-narou">小説家になろう形式</label>
<hr>
<div id="txtmiru-local-file-message"></div>
<button id="close-local-file" class="seigaiha_blue">閉じる</button>
</div></div>`
		document.body.appendChild(this.urlElement)
		this.localFileElement = document.getElementById("local-file")
		setEvent(this.urlElement, this.localFileElement, txtMiru)
	}
	show = _ => {
		if (this.txtMiru.display_popup) {
			return
		}
		this.txtMiru.display_popup = true
		this.urlElement.className = "show-local-file"
		this.localFileElement.focus()
		this.localFileElement.select()
	}
}