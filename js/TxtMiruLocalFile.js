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
<span id="local-file-folder-area"><input type="checkbox" id="local-file-folder" name="local-file-folder" value="folder"><label for="local-file-folder">フォルダ単位で読み込み</label></span>
</dl>
<input type="radio" id="local-file-aozora" name="local-file-type" value="aozora" checked><label for="local-file-aozora">青空文庫形式</label>
<input type="radio" id="local-file-narou" name="local-file-type" value="narou"><label for="local-file-narou">小説家になろう形式</label>
<hr>
<button id="close-local-file" class="seigaiha_blue">閉じる</button>
</div></div>`
		document.body.appendChild(this.urlElement)
	}
	show = (txtMiru) => {
		if (txtMiru.display_popup) {
			return
		}
		txtMiru.display_popup = true
		this.urlElement.className = "show-local-file"
		document.getElementById("local-file").focus()
		document.getElementById("local-file").select()
	}
	setEvent = (txtMiru) => {
		this.isComposing = false
		document.getElementById("local-file-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		document.getElementById("local-file-box-outer").addEventListener("click", e => {
			this.urlElement.className = "hide-local-file"
			txtMiru.display_popup = false
		})
		document.getElementById("close-local-file").addEventListener("click", e => {
			this.urlElement.className = "hide-local-file"
			txtMiru.display_popup = false
		})
		const load = files => {
			let url_list = []
			txtMiru.clearCache()
			const id = new Date().getTime().toString(16)
			for (const item of files) {
				const url = `txtmiru://localfile/${id}/${item.fullpath || item.webkitRelativePath || item.name}`
				if (item.name.match(/\.(?:htm|html|xhtml|txt|zip|epub)$/i)) {
					url_list.push({ url: url, name: item.fullpath || item.webkitRelativePath || item.name })
				}
				let cache = { url: url, html: null, file: item }
				if (item.name.match(/\.(?:txt)$/i)) {
					if (document.getElementById("local-file-narou").checked) {
						cache.narou = true
					} else {
						cache.aozora = true
					}
				} else if (item.name.match(/\.(?:zip|epub)$/i)) {
					cache.zip = true
					if (document.getElementById("local-file-narou").checked) {
						cache.narou = true
					} else {
						cache.aozora = true
					}
				}
				txtMiru.addCache(cache)
			}
			if (url_list.length === 1) {
				txtMiru.LoadNovel(url_list[0].url)
				this.urlElement.className = "hide-local-file"
				txtMiru.display_popup = false
			} else {
				const url = `txtmiru://localfile/${id}`
				let cache = { url: url, html: null }
				let html = "<ul>"
				for (const item of url_list) {
					html += `<li><a href='${item.url.replace(/^txtmiru:\/\/localfile\//, '')}'>${item.name}</a></li>`
				}
				html += "</ul>"
				cache.html = html
				txtMiru.addCache(cache)
				txtMiru.LoadNovel(url)
				this.urlElement.className = "hide-local-file"
				txtMiru.display_popup = false
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
						});
						for (let i = 0; i < entries.length; i++) {
							await traverseFileTree(entries[i], _path + entry.name + "/")
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
		document.getElementById("local-file").addEventListener("change", e => {
			load(e.target.files)
		})
		document.getElementById("local-file-folder").addEventListener("click", e => {
			document.getElementById("local-file").webkitdirectory = e.target.checked
		})
		if (navigator.userAgent.match(/iPhone|Android.+Mobile/)) {
			document.getElementById("local-file-folder-area").style.display = "none"
		}
	}
}