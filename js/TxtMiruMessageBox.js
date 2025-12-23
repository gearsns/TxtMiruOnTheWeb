export const TxtMiruMessageBox = {
	show: (message, options = {}) => new Promise((resolve, reject) => {
			const buttons = typeof options["buttons"] === "undefined" ? ["OK"] : options["buttons"]
			let button_html = ""
			for(const button of buttons){
				button_html += (typeof button === "string")
					? `<button value="${button}">${button}</button>`
					: `<button class="${button.className}" value="${button.value}">${button.text}</button>`
			}
			const messageElement = document.createElement("div")
			messageElement.className = "show-messagebox"
			messageElement.innerHTML = `<div class="message-inner">${message}<div>${button_html}</div></div>`

			for(const element of messageElement.getElementsByTagName("button")){
				element.addEventListener("click", event => {
					if(messageElement.parentElement){
						document.body.removeChild(messageElement)
					}
					resolve(element.value)
				})
			}
			for(const element of messageElement.getElementsByClassName("message-inner")){
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
