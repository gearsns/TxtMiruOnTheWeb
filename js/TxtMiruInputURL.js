export class TxtMiruInputURL {
	constructor(txtMiru) {
		this.txtMiru = txtMiru
		this.urlElement = document.createElement("div")
		this.urlElement.className = "hide-input-url"
		this.urlElement.innerHTML = `<div class="input-box-outer" id="input-box-outer"><div class="input-box-inner" id="input-box-inner">
<dl>
<dt>URL または 小説家になろうのNコードを指定してください。
<dd>
<input class="url" name="url" id="input-url">
</dl>
<button id="jump-url">開く</button>
</div></div>`
		document.body.appendChild(this.urlElement)
	}
	show = (txtMiru) => {
		if(txtMiru.display_popup){
			return
		}
		txtMiru.display_popup = true
		this.urlElement.className = "show-input-url"
		const url = (new URL(window.location)).searchParams.get('url')
		if(url == null){
			document.getElementById("input-url").value = ""
		} else {
			document.getElementById("input-url").value = url
		}
		document.getElementById("input-url").focus()
		document.getElementById("input-url").select()
	}
	jump = (txtMiru) => {
		let url = document.getElementById("input-url").value
		if(url.match(/^n/)){
			url = `https://ncode.syosetu.com/${url}`
		}
		txtMiru.LoadNovel(url)
		this.urlElement.className = "hide-input-url"
		txtMiru.display_popup = false
	}
	setEvent = (txtMiru) => {
		this.isComposing = false
		document.getElementById("input-url").addEventListener("compositionstart", e => { this.isComposing = true })
		document.getElementById("input-url").addEventListener("compositionend", e => { this.isComposing = false })
		document.getElementById("input-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		document.getElementById("input-box-outer").addEventListener("click", e => {
			this.urlElement.className = "hide-input-url"
			txtMiru.display_popup = false
		})
		document.getElementById("input-url").addEventListener("keydown", e => {
			if(!this.isComposing){
				if(e.code == "Enter" || e.code == "NumpadEnter"){
					this.jump(txtMiru)
					e.preventDefault()
					e.stopPropagation()
				} else if(e.code == "Escape"){
					this.urlElement.className = "hide-input-url"
					txtMiru.display_popup = false
					e.preventDefault()
					e.stopPropagation()
				}
			}
		})
		document.getElementById("jump-url").addEventListener("click", e => { this.jump(txtMiru) })
	}
}