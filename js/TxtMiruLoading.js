export class TxtMiruLoading {
	constructor(txtMiru) {
		this.txtMiru = txtMiru
		this.loadingElement = document.createElement("div")
		this.loadingElement.className = "hide-loading"
		this.loadingElement.innerHTML = `<div class="loader"></div>`
		this.txtMiru.fetchAbortController = new AbortController()
	}
	cancel = _ => {
		try {
			this.txtMiru.fetchAbortController?.abort("cancel")
		} catch{}
	}
	begin = messages => {
		this.cancel()
		this.txtMiru.fetchAbortController = new AbortController()
		this.update(messages)
		document.body.appendChild(this.loadingElement)
		this.loadingElement.className = "show-loading"
	}
	update = messages => {
		if(Array.isArray(messages)){
			this.loadingElement.innerHTML = `<div class="marquee"><p>${messages.join("<br>")}</p></div><div class="loader"></div>`
		} else if(messages) {
			this.loadingElement.innerHTML = `<div class="marquee"><p>${messages}</p></div><div class="loader"></div>`
		} else {
			this.loadingElement.innerHTML = `<div class="loader"></div>`
		}
		const elmq = this.loadingElement.querySelector(".marquee")
		if (elmq && elmq.scrollHeight <= elmq.clientHeight){
			elmq.className = "nomarquee"
		}
		this.loadingElement.querySelector(".loader").addEventListener("dblclick", this.cancel)
	}
	end = _ => {
		this.cancel()
		this.txtMiru.fetchAbortController = null
		this.loadingElement.className = "hide-loading"
		if(this.loadingElement.parentElement){
			document.body.removeChild(this.loadingElement)
		}
	}
}
