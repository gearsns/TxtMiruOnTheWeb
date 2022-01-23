import { narou2html } from './narou.js?1.0.10.0'
import { AozoraText2Html } from './aozora.js?1.0.10.0'

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
			let url1 = null
			for (const item of files) {
				const url = `txtmiru://localfile/${item.webkitRelativePath||item.name}`
				if (!url1 && item.name.match(/\.(?:html|html|txt)$/i)) {
					url1 = url
				}
				let cache = { url: url, html: null, file: item }
				if (item.name.match(/\.(?:txt)$/i)) {
					if (document.getElementById("local-file-narou").checked) {
						cache.narou = true
					} else {
						cache.aozora = true
					}
				}
				txtMiru.addCache(cache)
			}
			if (url1) {
				txtMiru.LoadNovel(url1)
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
		document.getElementById("local-file-box-inner").addEventListener("drop", e => {
			e.stopPropagation()
			e.preventDefault()
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