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
<button id="jump-url-close" class="seigaiha_blue">閉じる</button>
</div></div>`
		document.body.appendChild(this.urlElement)
		this.setEvent()
	}
	show = _ => {
		if (this.txtMiru.display_popup) {
			return
		}
		this.txtMiru.display_popup = true
		this.urlElement.className = "show-input-url"
		const el = document.getElementById("input-url")
		el.value = (new URL(window.location)).searchParams.get('url') || ""
		el.focus()
		el.select()
	}
	hideUrl = _ => {
		this.urlElement.className = "hide-input-url"
		this.txtMiru.display_popup = false
	}
	jump = _ => {
		let url = document.getElementById("input-url").value
		if (url.match(/^n/)) {
			url = `https://ncode.syosetu.com/${url}`
		}
		this.txtMiru.LoadNovel(url)
		this.hideUrl()
	}
	setEvent = _ => {
		this.isComposing = false
		document.getElementById("input-url").addEventListener("compositionstart", e => { this.isComposing = true })
		document.getElementById("input-url").addEventListener("compositionend", e => { this.isComposing = false })
		document.getElementById("input-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		document.getElementById("input-box-outer").addEventListener("click", this.hideUrl)
		document.getElementById("jump-url-close").addEventListener("click", this.hideUrl)
		document.getElementById("input-url").addEventListener("keydown", e => {
			if (!this.isComposing) {
				if (e.code === "Enter" || e.code === "NumpadEnter") {
					this.jump()
					e.preventDefault()
					e.stopPropagation()
				} else if (e.code === "Escape") {
					this.hideUrl()
					e.preventDefault()
					e.stopPropagation()
				}
			}
		})
		document.getElementById("jump-url").addEventListener("click", this.jump)
	}
}