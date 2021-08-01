export let TxtMiruMessageBox = {
	show: (message, options) => {
		options = typeof options == "undefined" ? {} : options
		return new Promise((resolve, reject) => {
			let buttons = typeof options["buttons"] == "undefined" ? ["OK"] : options["buttons"]
			let button_html = ""
			for(let button of buttons){
				if(typeof button == "string"){
					button_html += `<button value="${button}">${button}</button>`
				} else {
					button_html += `<button class="${button.className}" value="${button.value}">${button.text}</button>`
				}
			}
			let messageElement = document.createElement("div")
			messageElement.className = "show-messagbox"
			messageElement.innerHTML = `<div class="message-inner">${message}<div>${button_html}</div></div>`

			for(let element of messageElement.getElementsByTagName("button")){
				element.addEventListener("click", event => {
					if(messageElement.parentElement){
						document.body.removeChild(messageElement)
					}
					resolve(element.value)
				})
			}
			for(let element of messageElement.getElementsByClassName("message-inner")){
				element.addEventListener("click", event => {
					event.stopPropagation()
				}, false)
			}
			messageElement.addEventListener("click", event => {
				if(messageElement.parentElement){
					document.body.removeChild(messageElement)
				}
				resolve(false)
			})
			document.body.appendChild(messageElement)
		})
	}
}
