export class TxtMiruLoading {
	constructor() {
		this.loadingElement = document.createElement("div")
		this.loadingElement.className = "hide-loading"
		this.loadingElement.innerHTML = `<div class="loader"></div>`
	}
	begin = messages => {
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
	}
	end = () => {
		this.loadingElement.className = "hide-loading"
		if(this.loadingElement.parentElement){
			document.body.removeChild(this.loadingElement)
		}
	}
}
